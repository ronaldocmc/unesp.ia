# Atualizar a busca por link pelo Supabase Web

1. Abra Edge Functions → **observatorio-link** → Code.
2. Substitua o conteúdo de `index.ts` pelo conteúdo completo de **index.web.ts**, que reúne todos os módulos em um único arquivo.
3. Publique a atualização da função. Preserve a configuração de autenticação existente.
4. No painel do Observatório, atualize com Ctrl + F5 e busque um link que ainda não esteja cadastrado.

A data é procurada nos dados estruturados JSON-LD do artigo (`datePublished`) e nos metadados de publicação. `dateModified` não é usado como data de publicação. Artigos de outras URLs presentes no JSON-LD são ignorados.

Se não houver data de publicação extraível, um caminho como `/2026/09/29/nome-da-materia` poderá fornecer uma **sugestão**, acompanhada de um aviso de conferência. Datas inválidas e datas em parâmetros de busca não são usadas. Sem informação suficiente, o campo fica vazio para preenchimento manual.

O painel também sugere a data do caminho quando a versão anterior da função retorna uma prévia sem data. Para usar a nova leitura de dados estruturados, é necessário atualizar a função no Supabase.

Registros já cadastrados continuam sendo abertos para edição, preservando os dados salvos. As melhorias não alteram automaticamente datas no banco.

`index.web.ts` é gerado por `node scripts/bundle_observatorio_link.mjs`. Para futuras alterações, edite os módulos de origem e gere novamente o arquivo único.
