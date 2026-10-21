# Atualizar a busca por link pelo Supabase Web

Versão atual `20261021-geral-edge`: remove a lista de veículos do transporte. Qualquer domínio HTTPS público pode ser consultado, sujeito às validações e à permissão de leitura da própria fonte. O adaptador específico Unesp permanece para localizar notícias cujo identificador está em `#!`; isso não limita a importação HTML dos demais sites.

No Deno, `edge-transport.mjs` usa `Deno.connect` com o IPv4 público já validado, depois `Deno.startTls` com o hostname original e verificação normal de certificado/SNI. Não usa `ClientRequest.options.lookup`, segunda resolução DNS pelo transporte, lista de veículos, proxy ou desativação de TLS. O caminho Node com IP fixado é mantido. Cada redirecionamento é revalidado e cada conexão é fechada em sucesso, erro ou timeout.

Limites: apenas HTTPS público sem credenciais, IP literal ou porta personalizada; exige DNS A público (respostas mistas/privadas bloqueadas); até três redirects; prazo total de 12 segundos por leitura incluindo DNS, TCP/TLS e corpo; HTML até 1 MB; cabeçalhos até 32 KB e tamanho de transporte limitado. O parser HTTP/1.0/1.1 suporta Content-Length, corpo encerrado por EOF, chunked e respostas intermediárias controladas; rejeita enquadramento ambíguo, truncamentos e excessos. Solicita `Accept-Encoding: identity`; fonte que insiste em compressão não suportada gera erro e cadastro manual, sem desativar proteções. XML é aceito somente na rota interna validada do adaptador Unesp.

Validação: testes de rede simulada, parser, SSRF, redirects, fechamento/abort e certificado; teste real em Deno 2.1.4 com CNN (data 2026-10-13), OAB-SP (2026-10-07) e Unesp (2026-04-14). A negociação TLS real aceitou o hostname CNN e rejeitou um nome incorreto. Como o DNS UDP do Deno não respondeu no computador de teste, o ensaio real usou IPs públicos resolvidos pelo sistema local; conexão e TLS foram feitos em Deno. Isso não confirma execução no Supabase hospedado: após o Deploy, confira `versao_importador = 20261021-geral-edge` e repita as importações autenticadas. Runtime que não permita TCP/startTls falha de forma fechada, sem fallback inseguro. CAPTCHA, paywall, login, bloqueio de datacenter, páginas apenas JavaScript e formatos não suportados ainda podem exigir cadastro manual. Não há promessa de funcionar com todo link.

Esta versão substitui as restrições de transporte das versões `20261021-unesp-edge` e `20261021-fontes-oficiais-edge`. Nenhum SQL, novo token ou mudança no servidor do site é necessário; é preciso publicar a Edge Function com o bundle atualizado. Publicação no GitHub não executa esse Deploy.

Referências de API: [Deno Network/TCP/TLS](https://docs.deno.com/api/deno/network/), [upgrade TCP para TLS](https://docs.deno.com/examples/starttls/).

Versão `20261021-importador-unesp`: o painel preserva a rota `#!/noticias/v/id::...` do Portal Unesp. O importador lê os metadados oficiais de `sharer.php?post=ID`, confirma o ID e lê o corpo público pelo comando de consulta `exibeCorpo` do portal para obter a data exibida no artigo. O menu do CMS é identificado pelo caminho oficial da imagem da própria notícia. Não executa JavaScript/xajax, não usa IA e não presume que a data da imagem seja a publicação. Ignora datas de notícias relacionadas e de atualização do texto. Se não confirmar a data, mantém o campo vazio com aviso para preenchimento manual. Se o portal mudar o formato, falha de maneira conservadora. Os limites de tamanho, prazo, DNS/IP público e redirecionamentos continuam ativos; XML só é aceito na leitura interna dessa rota.

É necessário publicar **os arquivos do painel e a função observatorio-link**. Não exige SQL nem alteração de tokens. A publicação de arquivos no servidor/GitHub não atualiza a Edge Function.

1. Abra Edge Functions → **observatorio-link** → Code.
2. Substitua o conteúdo de `index.ts` pelo conteúdo completo de **index.web.ts**, que reúne todos os módulos em um único arquivo.
3. Publique a atualização da função. Preserve a configuração de autenticação existente.
4. No painel do Observatório, atualize com Ctrl + F5 e busque um link que ainda não esteja cadastrado.

A data é procurada nos dados estruturados JSON-LD do artigo (`datePublished`) e nos metadados de publicação. `dateModified` não é usado como data de publicação. Artigos de outras URLs presentes no JSON-LD são ignorados.

Se não houver data de publicação extraível, um caminho como `/2026/09/29/nome-da-materia` poderá fornecer uma **sugestão**, acompanhada de um aviso de conferência. Datas inválidas e datas em parâmetros de busca não são usadas. Sem informação suficiente, o campo fica vazio para preenchimento manual.

O painel também sugere a data do caminho quando a versão anterior da função retorna uma prévia sem data. Para usar a nova leitura de dados estruturados, é necessário atualizar a função no Supabase.

Registros já cadastrados continuam sendo abertos para edição, preservando os dados salvos. As melhorias não alteram automaticamente datas no banco.

`index.web.ts` é gerado por `node scripts/bundle_observatorio_link.mjs`. Para futuras alterações, edite os módulos de origem e gere novamente o arquivo único.
