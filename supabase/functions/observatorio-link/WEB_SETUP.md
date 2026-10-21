# Atualizar a busca por link pelo Supabase Web

Correção de transporte `20261021-unesp-edge`: no Edge Runtime, as duas leituras oficiais da Unesp usam `fetch` nativo e `Deno.resolveDns`, sem a opção Node `ClientRequest.options.lookup` incompatível com esse ambiente. A exceção é restrita a `www2.unesp.br/sharer.php?post=ID` e ao comando de leitura `exibeCorpo` com parâmetros validados; não é um fallback genérico e não segue redirecionamentos. Valida DNS público antes da conexão, HTTPS, MIME, prazo e corpo em streaming limitado a 1 MB, inclusive após descompressão. O fetch nativo pode resolver DNS novamente e não fixa o IP: a superfície é limitada aos endpoints oficiais, não a domínios fornecidos livremente. No Node e nos demais destinos, o transporte com IP fixado permanece inalterado. Para blindagem adicional no Edge use saída de rede restrita/proxy com DNS fixado. O retorno da função passa a incluir `versao_importador`, inclusive nos erros. Nenhuma alteração no banco ou nos tokens é necessária.

Validação: a chamada antiga reproduziu `Not implemented: ClientRequest.options.lookup` em Deno 2.1.4. O transporte nativo novo leu título e data `2026-04-14` da notícia 43025 nesse runtime. Como o DNS UDP do Deno não respondeu no computador de teste, esse ensaio usou os endereços públicos resolvidos pelo sistema local (o restante do transporte foi Deno nativo). Isso não confirma execução no Supabase hospedado: após o Deploy, confira `versao_importador = 20261021-unesp-edge` na resposta e repita a importação autenticada.

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
