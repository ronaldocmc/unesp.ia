# Publicação do portal no servidor próprio

Este procedimento publica o portal no servidor `200.145.184.28` por SSH. A automação prepara uma pasta por execução, preserva um backup recuperável da instalação anterior e sincroniza os arquivos validados com a pasta pública já existente.

## Premissas

- servidor Linux com `bash`, `tar` e OpenSSH;
- Nginx configurado para servir `/var/www/html`;
- portal disponível em `/var/www/html/unesp.ia`;
- usuário `iafct` com acesso de escrita a `/var/www/html/unesp.ia`;
- chave SSH exclusiva para a automação;
- porta SSH acessível pelos runners hospedados do GitHub.

## 1. Estrutura confirmada no servidor

O diagnóstico confirmou:

- Ubuntu Linux x86_64;
- Nginx 1.24;
- SSH em `200.145.184.28:2232`;
- usuário `iafct` pertencente ao grupo `sudo`, sem `sudo` não interativo;
- raiz do Nginx em `/var/www/html`;
- portal atual em `/var/www/html/unesp.ia`, gravável por `iafct`;
- `rsync` instalado;
- aproximadamente 33 GB livres no volume.

As versões ficarão fora da pasta pública:

```text
/home/iafct/deployments/unesp-ia/releases
```

Adicione a chave **pública** exclusiva de implantação em:

```text
/home/iafct/.ssh/authorized_keys
```

A chave privada não deve ser enviada ao repositório nem gravada dentro da pasta pública.

## 2. Verificar a identidade do servidor

No próprio servidor, obtenha a impressão digital da chave de host:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Compare essa impressão digital com a apresentada no primeiro acesso SSH. Somente depois da conferência, gere a linha que será armazenada no secret `DEPLOY_KNOWN_HOSTS`:

```bash
ssh-keyscan -t ed25519 -p 2232 200.145.184.28
```

`ssh-keyscan` coleta a chave, mas não comprova sozinho a identidade do servidor; por isso a comparação anterior é necessária.

## 3. Configurar o ambiente `production` no GitHub

No repositório, acesse **Settings → Environments → New environment** e crie `production`. Se disponível no plano, habilite aprovação obrigatória.

Cadastre as variáveis:

| Variável | Exemplo |
|---|---|
| `DEPLOY_HOST` | `200.145.184.28` |
| `DEPLOY_PORT` | `2232` |
| `DEPLOY_USER` | `iafct` |
| `DEPLOY_PATH` | `/var/www/html/unesp.ia` |
| `RELEASES_PATH` | `/home/iafct/deployments/unesp-ia/releases` |
| `DEPLOY_ENABLED` | `false` inicialmente |

Cadastre os secrets:

| Secret | Conteúdo |
|---|---|
| `DEPLOY_SSH_KEY` | chave privada completa da conta de implantação |
| `DEPLOY_KNOWN_HOSTS` | linha `known_hosts` verificada do servidor |

## 4. Configuração atual do Nginx

O Nginx já utiliza `/var/www/html` como raiz. Portanto, não é necessário alterá-lo para a primeira publicação. O portal continuará disponível em:

```text
http://200.145.184.28/unesp.ia/
```

Para autenticação e uso público em produção, ainda será necessário configurar domínio e HTTPS.

## 5. Fazer a primeira publicação

1. Acesse **Actions → Publicar portal no servidor**.
2. Escolha **Run workflow**.
3. Confira o resultado de cada etapa.
4. Abra `http://200.145.184.28/unesp.ia/` e valide a versão publicada.

Depois que a implantação manual funcionar, altere `DEPLOY_ENABLED` para `true`. A partir daí, cada atualização da branch `main` iniciará a publicação automaticamente.

## 6. Voltar para uma versão anterior

Liste as versões disponíveis:

```bash
ls -1 /home/iafct/deployments/unesp-ia/releases
```

Ative uma versão anterior substituindo `VERSAO` pelo diretório desejado:

```bash
rsync -a --delete-delay --delay-updates \
  --exclude '.deploy-managed' \
  /home/iafct/deployments/unesp-ia/releases/VERSAO/ \
  /var/www/html/unesp.ia/
```

## Banco de dados

Este workflow publica somente os arquivos do portal. PostgreSQL, Supabase, migrações, backups e dados possuem um fluxo separado. As migrações nunca devem ser aplicadas automaticamente junto com uma simples alteração visual.
