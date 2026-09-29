# Publicação do portal no servidor próprio

Este procedimento publica o portal no servidor `200.145.184.28` por SSH. A automação cria uma pasta por commit e troca o link simbólico `current` somente depois que o pacote completo foi validado e extraído.

## Premissas

- servidor Linux com `bash`, `tar` e OpenSSH;
- Nginx ou Apache configurado para servir `/var/www/unesp-ia/current`;
- usuário exclusivo de implantação com acesso de escrita a `/var/www/unesp-ia`;
- chave SSH exclusiva para a automação;
- porta SSH acessível pelos runners hospedados do GitHub.

## 1. Preparar o usuário e os diretórios

Execute no servidor com uma conta que possua `sudo`, ajustando o nome do usuário se necessário:

```bash
sudo useradd --create-home --shell /bin/bash deploy-unesp
sudo install -d -o deploy-unesp -g deploy-unesp /var/www/unesp-ia
sudo -u deploy-unesp mkdir -p /var/www/unesp-ia/releases
sudo -u deploy-unesp install -d -m 700 /home/deploy-unesp/.ssh
sudo -u deploy-unesp touch /home/deploy-unesp/.ssh/authorized_keys
sudo chmod 600 /home/deploy-unesp/.ssh/authorized_keys
```

Adicione a chave **pública** exclusiva de implantação em:

```text
/home/deploy-unesp/.ssh/authorized_keys
```

A chave privada não deve ser enviada ao repositório nem gravada dentro da pasta pública.

## 2. Verificar a identidade do servidor

No próprio servidor, obtenha a impressão digital da chave de host:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Compare essa impressão digital com a apresentada no primeiro acesso SSH. Somente depois da conferência, gere a linha que será armazenada no secret `DEPLOY_KNOWN_HOSTS`:

```bash
ssh-keyscan -t ed25519 -p 22 200.145.184.28
```

`ssh-keyscan` coleta a chave, mas não comprova sozinho a identidade do servidor; por isso a comparação anterior é necessária.

## 3. Configurar o ambiente `production` no GitHub

No repositório, acesse **Settings → Environments → New environment** e crie `production`. Se disponível no plano, habilite aprovação obrigatória.

Cadastre as variáveis:

| Variável | Exemplo |
|---|---|
| `DEPLOY_HOST` | `200.145.184.28` |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_USER` | `deploy-unesp` |
| `DEPLOY_PATH` | `/var/www/unesp-ia` |
| `DEPLOY_ENABLED` | `false` inicialmente |

Cadastre os secrets:

| Secret | Conteúdo |
|---|---|
| `DEPLOY_SSH_KEY` | chave privada completa da conta de implantação |
| `DEPLOY_KNOWN_HOSTS` | linha `known_hosts` verificada do servidor |

## 4. Configurar o Nginx

Exemplo inicial usando o IP. Para produção com autenticação, configure um domínio e HTTPS.

```nginx
server {
    listen 80;
    server_name 200.145.184.28;

    root /var/www/unesp-ia/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ /\. {
        deny all;
    }
}
```

Depois de salvar a configuração:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Fazer a primeira publicação

1. Acesse **Actions → Publicar portal no servidor**.
2. Escolha **Run workflow**.
3. Confira o resultado de cada etapa.
4. Abra `http://200.145.184.28/` e valide a versão publicada.

Depois que a implantação manual funcionar, altere `DEPLOY_ENABLED` para `true`. A partir daí, cada atualização da branch `main` iniciará a publicação automaticamente.

## 6. Voltar para uma versão anterior

Liste as versões disponíveis:

```bash
ls -1 /var/www/unesp-ia/releases
```

Ative uma versão anterior substituindo `COMMIT` pelo identificador desejado:

```bash
ln -sfn /var/www/unesp-ia/releases/COMMIT /var/www/unesp-ia/current.next
mv -Tf /var/www/unesp-ia/current.next /var/www/unesp-ia/current
```

## Banco de dados

Este workflow publica somente os arquivos do portal. PostgreSQL, Supabase, migrações, backups e dados possuem um fluxo separado. As migrações nunca devem ser aplicadas automaticamente junto com uma simples alteração visual.
