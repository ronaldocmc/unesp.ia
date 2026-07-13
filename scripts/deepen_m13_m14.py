from __future__ import annotations

from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parents[1]
CSS_VERSION = "20260713-m13-m14-deep"

NAV_UP = (
    '<a href="../index.html">Início</a><a href="../inscricoes.html">Inscrições</a>'
    '<a href="../modulos.html">Módulos</a><a href="../trilhas.html">Trilhas</a>'
    '<a href="../conceitos.html">Conceitos</a><a href="../ferramentas.html">Ferramentas</a>'
    '<a href="../laboratorios.html">Laboratórios</a><a href="../materiais.html">Materiais</a>'
    '<a href="../personagens.html">Personagens</a><a href="../equipe.html">Equipe</a><a href="../mapa-conhecimento.html">Mapa</a><a href="../login.html">Área do aluno</a>'
)

FOOTER = (
    '<footer class="footer"><span class="footer-primary">unesp.IA - Inteligência Artificial para Todos | '
    'Projeto de Extensão Universitária | Coleção Editorial</span>'
    '<span class="footer-unit">Faculdade de Ciências e Tecnologia de Presidente Prudente - FCT/UNESP</span>'
    '<span class="footer-institution">Departamento de Matemática e Computação</span></footer>'
)


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def code(text: str) -> str:
    return f'<pre class="code-block"><code>{esc(text.strip())}</code></pre>'


def topbar() -> str:
    return (
        '<div class="topbar"><a class="brand" href="../index.html">'
        '<img class="brand-logo" src="../assets/img/logo-unesp-ia-portal.jpg" alt="unesp.IA">'
        '<small>Coleção Editorial | Portal Didático dos Participantes</small></a>'
        f'<div class="nav">{NAV_UP}</div></div>'
    )


def html_shell(num: int, title: str, subtitle: str, color: str, soft: str, body: str) -> str:
    return (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>Módulo {num} – {esc(title)} • unesp.IA</title>'
        f'<link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}"><script src="../assets/js/search.js"></script><script type="module" src="../assets/js/python-runner.js"></script>'
        f'<style>.module-full.module-m{num}' + f'{{--module-color:{color};--module-soft:{soft}}}</style>'
        '</head><body>'
        + topbar()
        + f'<main><div class="container content module-full module-m{num}" id="top">'
        f'<div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../modulos.html">Módulos</a> / Módulo {num}</div>'
        f'<div class="hero"><span class="badge">M{num}</span><h1>{esc(title)}</h1></div>'
        + body
        + '</div></main><a class="backtop" href="#top">Topo</a>'
        + FOOTER
        + '</body></html>'
    )


def mini_toc(items: list[tuple[str, str]]) -> str:
    return '<div class="mini-toc"><strong>Unidades e seções deste módulo</strong>' + ''.join(
        f'<a href="#{href}">{esc(label)}</a>' for label, href in items
    ) + '</div>'


def concept_grid(items: list[tuple[str, str, str]]) -> str:
    cards = []
    for title, definition, href in items:
        cards.append(
            f'<article class="concept-mini-card"><h3><a href="{href}">{esc(title)}</a></h3><p>{esc(definition)}</p></article>'
        )
    return '<div class="concept-mini-grid">' + ''.join(cards) + '</div>'


def rm_link(path: str, label: str) -> str:
    return f'<a class="term" href="https://ronaldocmc.github.io/UnespDataLens-RM/{path}" target="_blank" rel="noopener">{esc(label)}</a>'


def rm_deep_dive(unit_code: str) -> str:
    guide = RM_GUIDANCE.get(unit_code)
    if not guide:
        return ""
    unit_anchor = f'implementacao-u{unit_code.replace(".", "")}'
    problem_rows = ''.join(
        f'<tr><td>{rm_link(path, name)}</td><td>{diagnosis}</td><td>{solution}</td><td>{evidence}</td></tr>'
        for name, path, diagnosis, solution, evidence in guide["problems"]
    )
    method_rows = ''.join(
        f'<tr><td>{rm_link(path, name)}</td><td>{purpose}</td><td>{steps}</td><td><a href="#{unit_anchor}">Exemplos e laboratório desta unidade</a></td></tr>'
        for name, path, purpose, steps in guide["methods"]
    )
    metric_rows = ''.join(
        f'<tr><td>{rm_link(path, name)}</td><td><code>{formula}</code></td><td>{analysis}</td><td>{action}</td></tr>'
        for name, path, formula, analysis, action in guide["metrics"]
    )
    artifact_rows = ''.join(
        f'<tr><td>{rm_link(path, name)}</td><td>{minimum}</td><td>{implementation}</td><td>{validation}</td></tr>'
        for name, path, minimum, implementation, validation in guide["artifacts"]
    )
    return (
        '<div class="rm-deep-dive"><h3>Como diagnosticar e resolver os problemas</h3>'
        '<p>A tabela deixa explícito o caminho <strong>problema → diagnóstico → intervenção → evidência</strong>. '
        'A correção somente é considerada concluída quando a evidência pode ser verificada por outra pessoa.</p>'
        '<div class="table-wrap"><table class="table"><tr><th>Problema/conceito</th><th>Como diagnosticar</th><th>Como resolver</th><th>Como comprovar</th></tr>'
        + problem_rows + '</table></div>'
        '<h3>Como aplicar os métodos e técnicas</h3><div class="table-wrap"><table class="table"><tr><th>Método</th><th>Quando e por quê</th><th>Procedimento implementacional</th><th>Onde praticar</th></tr>'
        + method_rows + '</table></div>'
        '<h3>Como calcular, avaliar e interpretar as métricas</h3><p>A meta não deve ser escolhida apenas para “ficar verde”. Ela deriva da finalidade do produto, do risco, do histórico e do acordo entre produtor e consumidor.</p>'
        '<div class="table-wrap"><table class="table"><tr><th>Métrica</th><th>Fórmula operacional</th><th>Leitura e análise</th><th>Ação decorrente</th></tr>'
        + metric_rows + '</table></div>'
        '<h3>Como implementar os artefatos de evidência</h3><div class="table-wrap"><table class="table"><tr><th>Artefato</th><th>Conteúdo mínimo</th><th>Como construir</th><th>Como validar</th></tr>'
        + artifact_rows + '</table></div></div>'
    )


def unit(title: str, objective: str, content: str) -> str:
    number = title.split(" ", 1)[0].replace(".", "")
    anchor = f"u{number}"
    unit_code = title.split(" ", 1)[0]
    learning = {**M13_LEARNING, **M14_LEARNING}.get(unit_code)
    framework_before = ""
    framework_after = ""
    if learning:
        alignment = RM_ALIGNMENT.get(unit_code)
        rm = ""
        if alignment:
            module_links = ', '.join(
                f'<a class="term" href="https://ronaldocmc.github.io/UnespDataLens-RM/modulos/{filename}.html" target="_blank" rel="noopener">{label}</a>'
                for filename, label in alignment["modules"]
            )
            rm = (
                '<h3>Aderência ao UnespDataLens-RM</h3>'
                f'<p>Esta unidade operacionaliza {module_links} do modelo de referência.</p>'
                '<div class="table-wrap"><table class="table">'
                f'<tr><th>Problemas enfrentados</th><td>{alignment["problems"]}</td></tr>'
                f'<tr><th>Métodos e técnicas</th><td>{alignment["methods"]}</td></tr>'
                f'<tr><th>Métricas mínimas</th><td>{alignment["metrics"]}</td></tr>'
                f'<tr><th>Artefatos de evidência</th><td>{alignment["artifacts"]}</td></tr>'
                '</table></div>' + rm_deep_dive(unit_code)
            )
        framework_before = (
            '<h3>Carga horária</h3>'
            f'<p>{learning["hours"]} horas.</p>'
            '<h3>Objetivo da unidade</h3>'
            f'<p>{objective}</p>'
            '<h3>Situação de abertura</h3>'
            f'<p>{learning["opening"]}</p>'
            '<h3>Competências e conceitos principais</h3><ul class="list">'
            + ''.join(f'<li>{item}</li>' for item in learning["skills"])
            + '</ul>' + rm
        )
        framework_after = (
            '<div class="box practice"><strong>Na prática</strong></div>'
            f'<p>{learning["lab"]}</p>'
            '<div class="box warn"><strong>Atenção</strong></div>'
            f'<p>{learning["warning"]}</p>'
            '<div class="box tip"><strong>Teste agora</strong></div><ol class="steps">'
            + ''.join(f'<li>{item}</li>' for item in learning["criteria"])
            + '</ol><h3>Atividade guiada</h3><h4>Objetivo</h4>'
            f'<p>{learning["lab"]}</p><h4>Passo a passo</h4><ol class="steps">'
            '<li>Leia o cenário e identifique entradas, restrições e resultado esperado.</li>'
            '<li>Execute o exemplo inicial sem alterações e registre a saída.</li>'
            '<li>Modifique dados e parâmetros para incluir um caso válido, um caso-limite e uma falha.</li>'
            '<li>Compare os resultados e explique tecnicamente cada diferença.</li>'
            '<li>Organize código, decisões, métricas e limitações em um notebook reexecutável.</li>'
            '</ol><h4>Produto da unidade</h4><ul class="list">'
            + ''.join(f'<li>{item}</li>' for item in learning["deliverables"])
            + '</ul><div class="box tip"><strong>Para refletir</strong></div>'
            f'<p>{learning["reflection"]}</p>'
        )
    if not learning:
        framework_before = f'<h3>Objetivo da unidade</h3><p>{objective}</p>'
    implementation = f'<div id="implementacao-{anchor}"><h3>Base teórica e implementação em Python</h3>{content}</div>'
    return f'<section id="{anchor}"><h2 class="unit-title">{esc(title)}</h2>{framework_before}{implementation}{framework_after}</section>'


def technique(title: str, explanation: str, example: str) -> str:
    """Bloco didático que mantém explicação e exemplo executável juntos."""
    return (
        f'<article class="technique-card"><h3>{esc(title)}</h3>'
        f'<p>{explanation}</p>{code(example)}</article>'
    )


PY_CONCEPTS = [
    ("Python", "linguagem de programação usada para automação, dados, IA e desenvolvimento de soluções.", "../conceitos/python.html"),
    ("Ambiente Python", "conjunto de interpretador, bibliotecas, notebooks, editor e configurações do projeto.", "../conceitos/ambiente-python.html"),
    ("PIP", "gerenciador de pacotes usado para instalar, atualizar e remover bibliotecas Python.", "../conceitos/bibliotecas-python.html"),
    ("Variável", "nome que referencia um valor, como texto, número, lista, dicionário ou DataFrame.", "../conceitos/variavel.html"),
    ("Tipo de dado", "categoria do valor manipulado, como str, int, float, bool, NoneType, list, tuple, dict ou set.", "../conceitos/tipos-dados.html"),
    ("Estruturas de dados", "formas de organizar coleções: listas, tuplas, ranges, conjuntos, dicionários, Series e DataFrames.", "../conceitos/estruturas-dados.html"),
    ("Função", "bloco reutilizável de código com parâmetros, processamento e retorno.", "../conceitos/funcoes.html"),
    ("DataFrame", "estrutura tabular do pandas, com linhas, colunas, índices, filtros, agrupamentos e transformações.", "../conceitos/dataframe.html"),
    ("Análise exploratória", "etapa de observar dados, distribuições, ausências, outliers e padrões antes de concluir.", "../conceitos/analise-exploratoria.html"),
    ("Visualização de dados", "uso de gráficos para comunicar padrões e apoiar interpretação crítica.", "../conceitos/visualizacao-dados.html"),
]

DE_CONCEPTS = [
    ("Engenharia de Dados", "área que coleta, organiza, transforma, valida, armazena e disponibiliza dados para análise e IA.", "../conceitos/engenharia-dados.html"),
    ("ETL", "processo de extrair dados, transformar com regras de qualidade e carregar em um destino confiável.", "../conceitos/etl-elt.html"),
    ("ELT", "variação em que dados são carregados primeiro e transformados depois no ambiente analítico.", "../conceitos/etl-elt.html"),
    ("Pipeline de dados", "sequência reproduzível de etapas de ingestão, validação, transformação, carga, log e monitoramento.", "../conceitos/pipeline-dados.html"),
    ("Qualidade de dados", "critérios de completude, validade, consistência, unicidade, atualidade e conformidade.", "../conceitos/qualidade-dados.html"),
    ("Data lake", "repositório de dados brutos ou semiestruturados, geralmente antes da curadoria analítica.", "../conceitos/data-lake.html"),
    ("Data warehouse", "base organizada, integrada e confiável para relatórios, indicadores e tomada de decisão.", "../conceitos/data-warehouse.html"),
    ("Catálogo de dados", "inventário com descrição, origem, responsável, sensibilidade e regras de uso de cada base.", "../conceitos/catalogo-dados.html"),
    ("Linhagem de dados", "registro da origem, transformações e usos dos dados ao longo do pipeline.", "../conceitos/linhagem-dados.html"),
    ("Pré-processamento", "limpeza, transformação, normalização, tratamento de ausências, duplicidades e outliers.", "../conceitos/pre-processamento-dados.html"),
]


M14_LEARNING = {
    "14.1": {
        "hours": 3, "level": "Projetar e justificar",
        "skills": ["mapear o ciclo de vida de um dado do sistema de origem ao produto analítico;", "distinguir arquitetura operacional e analítica;", "definir zonas, responsáveis, entradas, saídas e critérios de passagem."],
        "lab": "Desenhar a arquitetura reduzida do UnespDataLens-RM para um domínio educacional, conectando inventário, ingestão, integração, transformação, qualidade, armazenamento e consumo.",
        "deliverables": ["diagrama de arquitetura;", "matriz etapa × entrada × processamento × saída;", "registro de decisões arquiteturais."],
        "criteria": ["todas as etapas possuem entradas e saídas identificáveis;", "as escolhas são justificadas por volume, frequência, sensibilidade e consumo;", "o fluxo permite localizar origem e destino de cada ativo."],
    },
    "14.2": {
        "hours": 4, "level": "Implementar com tolerância a falhas",
        "skills": ["ingerir CSV, Excel, JSON, API e SQL com parâmetros explícitos;", "preservar snapshots e manifestos de ingestão;", "implementar timeout, paginação, idempotência e tratamento de rejeições."],
        "lab": "Construir a camada de ingestão do estudo de caso, preservando arquivos brutos, hash, schema observado, horário, origem, volume e status da execução.",
        "deliverables": ["script de ingestão;", "snapshot bruto;", "manifesto e log de rejeições;", "teste de reexecução sem duplicação."],
        "criteria": ["a ingestão é reexecutável e não altera a fonte;", "falhas produzem diagnóstico e não resultados parciais silenciosos;", "o manifesto permite provar o que foi recebido."],
    },
    "14.3": {
        "hours": 4, "level": "Especificar, testar e monitorar",
        "skills": ["formalizar contratos de schema e regras de qualidade;", "calcular completude, validade, consistência, unicidade e atualidade;", "classificar não conformidades por severidade e ação."],
        "lab": "Criar o contrato e o plano de validação do dataset educacional, com registros válidos, quarentena, métricas e relatório de qualidade.",
        "deliverables": ["contrato de dados;", "catálogo de regras;", "dataset de quarentena;", "relatório de qualidade com evidências."],
        "criteria": ["cada regra possui identificador, campo, condição, severidade e ação;", "as métricas são reproduzíveis;", "nenhuma rejeição ocorre sem motivo registrado."],
    },
    "14.4": {
        "hours": 5, "level": "Construir transformação rastreável",
        "skills": ["diagnosticar tipos, formatos, domínios e anomalias;", "implementar limpeza e harmonização sem perder valores originais;", "versionar regras e medir impacto antes/depois."],
        "lab": "Produzir a camada tratada do UnespDataLens-RM, com regras unitárias, campos derivados, comparação antes/depois e manifesto de transformação.",
        "deliverables": ["pipeline de transformação;", "registro versionado de regras;", "dataset tratado;", "relatório de impacto."],
        "criteria": ["transformações são determinísticas e testáveis;", "valores alterados podem ser explicados;", "campos derivados possuem fórmula, finalidade e versão."],
    },
    "14.5": {
        "hours": 4, "level": "Selecionar técnica com justificativa estatística",
        "skills": ["diagnosticar mecanismo e padrão de ausência;", "comparar estratégias de imputação;", "detectar duplicidades e outliers sem confundir exceções legítimas com erros;", "evitar vazamento entre treino e teste."],
        "lab": "Comparar cenários de remoção, imputação, encoding, normalização e winsorização, medindo linhas afetadas e mudanças nas distribuições.",
        "deliverables": ["notebook comparativo;", "registro de parâmetros aprendidos;", "base pré-processada;", "justificativa metodológica."],
        "criteria": ["a técnica é compatível com o significado da variável;", "o impacto por grupo é avaliado;", "parâmetros não são aprendidos com dados de teste."],
    },
    "14.6": {
        "hours": 4, "level": "Integrar com controle de cardinalidade",
        "skills": ["definir entidade, chave e granularidade de cada fonte;", "executar merge, join e concat com validação;", "harmonizar semântica e tempo;", "produzir indicadores sem dupla contagem."],
        "lab": "Integrar inscrições e presenças, registrar correspondências e conflitos e produzir um data mart por módulo e perfil.",
        "deliverables": ["plano de integração;", "matriz de correspondência;", "registro de conflitos;", "dataset integrado e indicadores reconciliados."],
        "criteria": ["a cardinalidade esperada é testada;", "não pareamentos e conflitos são quantificados;", "totais antes e depois são reconciliados."],
    },
    "14.7": {
        "hours": 5, "level": "Projetar, implementar e avaliar armazenamento analítico",
        "skills": ["selecionar entre arquivos, banco relacional, warehouse, lake e lakehouse;", "projetar zonas, schema analítico e data mart;", "aplicar particionamento, índices, snapshots e carga incremental;", "avaliar desempenho, reprocessabilidade, custo e acesso."],
        "lab": "Implementar o armazenamento analítico do UnespDataLens-RM com zonas bronze/prata/ouro, Parquet particionado, DuckDB, data mart educacional, snapshots e benchmark de consultas.",
        "deliverables": ["arquitetura e mapa de armazenamento;", "especificação de schemas e zonas;", "data mart persistido;", "registro de particionamento e snapshots;", "relatório de desempenho e adequação."],
        "criteria": ["cada ativo possui zona, formato, schema, versão e responsável;", "a carga incremental é idempotente;", "consultas de validação reconciliam origem e destino;", "o relatório comprova desempenho e possibilidade de reconstrução."],
    },
    "14.8": {
        "hours": 3, "level": "Operar com rastreabilidade e governança",
        "skills": ["distinguir log, auditoria, linhagem, catálogo e observabilidade;", "instrumentar métricas operacionais;", "classificar sensibilidade, acesso e retenção."],
        "lab": "Instrumentar o pipeline com logs estruturados, catálogo, lineage e indicadores de cobertura, falha e atualidade.",
        "deliverables": ["log estruturado;", "catálogo de dados;", "grafo ou registro de linhagem;", "matriz de acesso e retenção."],
        "criteria": ["incidentes podem ser reconstruídos pelos logs;", "dados pessoais não aparecem em mensagens operacionais;", "origem, transformação e consumo estão conectados."],
    },
    "14.9": {
        "hours": 3, "level": "Preparar e avaliar dados para IA",
        "skills": ["formular alvo e atributos evitando leakage;", "separar treino, validação e teste;", "construir pipeline de pré-processamento;", "avaliar representatividade, desempenho e limitações."],
        "lab": "Preparar um experimento de classificação didático a partir do data mart, documentando riscos, vieses, métricas e usos proibidos.",
        "deliverables": ["notebook de análise exploratória;", "pipeline de preparação;", "relatório de avaliação;", "ficha de limitações."],
        "criteria": ["o experimento é reproduzível;", "não há vazamento de alvo ou de tempo;", "a conclusão não excede a evidência disponível."],
    },
    "14.10": {
        "hours": 5, "level": "Entregar produto de dados operacional",
        "skills": ["orquestrar extração, validação, transformação, carga e monitoramento;", "implementar testes e recuperação de falha;", "documentar execução, arquitetura e operação;", "apresentar evidências de qualidade e reprocessabilidade."],
        "lab": "Construir e demonstrar um mini-UnespDataLens-RM executável de ponta a ponta, partindo de dados fictícios até um data mart consultável e governado.",
        "deliverables": ["repositório executável;", "dados fictícios e contratos;", "pipeline, testes e logs;", "data mart e indicadores;", "documentação técnica e apresentação."],
        "criteria": ["uma execução limpa produz todos os artefatos;", "testes impedem publicação de dados inválidos;", "o pipeline suporta reexecução e falha controlada;", "outro participante consegue reproduzir o resultado pela documentação."],
    },
}


M13_LEARNING = {
    "13.1": {"hours": 3, "level": "Configurar e reproduzir", "opening": "João recebeu um notebook que só funciona no computador de quem o criou. Ele precisa descobrir dependências, ordem das células e arquivos de entrada.", "skills": ["distinguir script, notebook, kernel e ambiente;", "registrar versões e sementes;", "executar um notebook do início ao fim sem estado oculto."], "lab": "Configurar uma sessão Python, registrar versões, fixar uma semente e demonstrar que duas execuções limpas produzem o mesmo resultado.", "deliverables": ["notebook documentado;", "registro de ambiente e dependências;", "evidência de Restart & Run All."], "criteria": ["explique a diferença entre célula Markdown, código e saída;", "identifique uma dependência não declarada;", "reexecute o exemplo e compare os resultados."], "warning": "Um arquivo .ipynb não é automaticamente reprodutível: ordem incorreta, estado oculto, caminhos absolutos e versões não declaradas podem invalidar o resultado.", "reflection": "Outra pessoa conseguiria reproduzir seu notebook sem pedir informações adicionais?"},
    "13.2": {"hours": 3, "level": "Aplicar fundamentos", "opening": "Um cadastro mistura textos, números, valores lógicos e campos ausentes; tipos incorretos geram cálculos e comparações equivocadas.", "skills": ["representar valores com tipos adequados;", "usar operadores aritméticos, lógicos e relacionais;", "inspecionar e converter tipos."], "lab": "Modelar um registro de participante, calcular valores derivados e validar tipos antes do processamento.", "deliverables": ["código executável;", "tabela de variáveis e tipos;", "testes de conversão."], "criteria": ["classifique cinco valores por tipo;", "converta uma entrada textual com tratamento de erro;", "explique o resultado de uma expressão lógica."], "warning": "Conversões silenciosas podem apagar significado, como zeros à esquerda em códigos e identificadores.", "reflection": "O tipo escolhido representa o significado do dado ou apenas permite que o código execute?"},
    "13.3": {"hours": 3, "level": "Construir algoritmos", "opening": "A situação de um participante depende simultaneamente de frequência, nota e exceções; repetir decisões manualmente produz inconsistência.", "skills": ["usar if, elif e else;", "controlar repetições com while e for;", "construir compreensões legíveis."], "lab": "Implementar regras de aprovação e percorrer uma lista de registros, incluindo casos-limite.", "deliverables": ["algoritmo comentado;", "tabela de casos de teste;", "saídas verificadas."], "criteria": ["teste os três ramos da decisão;", "evite um laço infinito;", "reescreva uma repetição simples como compreensão."], "warning": "Uma regra programada sem casos-limite pode parecer correta e ainda falhar justamente nas exceções importantes.", "reflection": "Quais decisões deveriam permanecer sob revisão humana?"},
    "13.4": {"hours": 3, "level": "Selecionar estruturas", "opening": "Listas, conjuntos, tuplas e dicionários podem guardar os mesmos valores, mas oferecem garantias e operações diferentes.", "skills": ["selecionar a estrutura adequada;", "percorrer e transformar coleções;", "usar chaves e eliminar duplicidades conscientemente."], "lab": "Representar participantes e módulos com diferentes coleções e comparar acesso, mutabilidade e unicidade.", "deliverables": ["exemplos comparativos;", "justificativa de estrutura;", "resultado de operações de conjunto."], "criteria": ["identifique quando usar lista, tupla, conjunto e dicionário;", "trate uma chave ausente;", "demonstre união e interseção."], "warning": "Converter uma lista em conjunto remove ordem e duplicidades; isso só é correto quando essas informações não têm significado.", "reflection": "Que propriedade do problema orientou a escolha da estrutura?"},
    "13.5": {"hours": 5, "level": "Manipular dados tabulares", "opening": "Uma planilha com centenas de linhas exige filtros, tipos, índices e resumos que não são viáveis registro a registro.", "skills": ["criar Series e DataFrames;", "selecionar por rótulo e posição;", "inspecionar tipos, ausências e estatísticas."], "lab": "Construir um DataFrame educacional, diagnosticar sua estrutura e responder perguntas com filtros e agrupamentos.", "deliverables": ["DataFrame documentado;", "perfil descritivo;", "consultas reproduzíveis."], "criteria": ["diferencie loc e iloc;", "identifique ausências;", "produza um resumo por grupo."], "warning": "Índices duplicados, tipos inferidos incorretamente e filtros encadeados podem produzir resultados ambíguos.", "reflection": "Qual é a unidade de análise representada por cada linha?"},
    "13.6": {"hours": 4, "level": "Modularizar e testar", "opening": "O mesmo cálculo aparece em várias células e começa a produzir resultados diferentes após pequenas alterações.", "skills": ["definir funções com entradas e retorno;", "reduzir repetição;", "escrever assertivas e funções puras quando possível."], "lab": "Transformar cálculos repetidos em funções pequenas, documentadas e testadas.", "deliverables": ["biblioteca de funções;", "docstrings;", "testes de casos válidos e inválidos."], "criteria": ["separe entrada, processamento e saída;", "teste divisão por zero;", "compare função nomeada e lambda."], "warning": "Funções com estado global e efeitos colaterais ocultos dificultam testes e reprodutibilidade.", "reflection": "Sua função faz uma tarefa clara e pode ser testada isoladamente?"},
    "13.7": {"hours": 5, "level": "Ingerir e preservar", "opening": "A mesma base chega em CSV, TSV, JSON, Excel e SQL, com separadores, codificações e schemas diferentes.", "skills": ["ler e escrever formatos comuns;", "tratar caminhos e exceções;", "registrar hash, versão e proveniência."], "lab": "Importar formatos sintéticos, validar colunas, gravar um resultado e gerar manifesto de reprodução.", "deliverables": ["rotinas de importação;", "manifesto JSON;", "testes de arquivo ausente e schema inválido."], "criteria": ["informe encoding e separador;", "use caminho relativo;", "confirme integridade por hash."], "warning": "CPF, e-mail e endereço não devem ser incorporados a exemplos públicos sem base legal, minimização e proteção.", "reflection": "É possível provar qual arquivo gerou o resultado?"},
    "13.8": {"hours": 3, "level": "Modelar objetos", "opening": "Participantes, turmas e módulos possuem dados e comportamentos relacionados; dicionários soltos começam a ficar difíceis de manter.", "skills": ["definir classes e objetos;", "aplicar encapsulamento e composição;", "representar regras como métodos testáveis."], "lab": "Modelar Participante e Turma, calcular frequência e impedir estados inválidos.", "deliverables": ["classes documentadas;", "objetos de teste;", "validações de invariantes."], "criteria": ["instancie dois objetos;", "teste um estado inválido;", "explique composição versus herança."], "warning": "Orientação a objetos não deve adicionar complexidade quando funções e estruturas simples resolvem o problema.", "reflection": "Quais regras pertencem ao objeto e quais pertencem ao serviço ou pipeline?"},
    "13.9": {"hours": 5, "level": "Explorar e comunicar", "opening": "Médias semelhantes escondem distribuições, grupos e valores extremos diferentes; um gráfico inadequado pode reforçar uma conclusão falsa.", "skills": ["calcular tendência central e dispersão;", "selecionar gráficos compatíveis;", "interpretar correlação sem afirmar causalidade."], "lab": "Produzir uma EDA com resumo numérico, comparação por grupo, gráfico e interpretação limitada pelas evidências.", "deliverables": ["notebook de EDA;", "gráficos rotulados;", "texto de interpretação e limitações."], "criteria": ["compare média e mediana;", "verifique tamanho dos grupos;", "explique por que correlação não implica causalidade."], "warning": "Escalas truncadas, categorias sem contexto e grupos pequenos podem distorcer a leitura.", "reflection": "O gráfico revela o dado ou conduz o leitor a uma conclusão indevida?"},
    "13.10": {"hours": 6, "level": "Integrar e entregar", "opening": "Um código isolado não demonstra competência se não houver objetivo, dados, testes, interpretação e instruções de reprodução.", "skills": ["integrar importação, transformação e análise;", "organizar projeto e documentação;", "entregar evidências reexecutáveis."], "lab": "Construir uma miniaplicação ou notebook completo com dados sintéticos, validação, análise, visualização e manifesto.", "deliverables": ["projeto executável;", "README;", "dados sintéticos;", "testes e relatório final."], "criteria": ["execute em ambiente limpo;", "provoque e trate uma falha;", "peça a outra pessoa para reproduzir."], "warning": "Não publique segredos, credenciais ou dados pessoais junto com o projeto.", "reflection": "Quais evidências demonstram que as habilidades do módulo foram realmente alcançadas?"},
}


RM_ALIGNMENT = {
    "14.1": {"modules": [("m01", "M1 - Fontes e inventário"), ("m07", "M7 - Armazenamento analítico")], "problems": "silos de dados, ausência de metadados, baixa descobribilidade e arquitetura sem responsáveis", "methods": "inventário de fontes, data profiling preliminar, classificação de sensibilidade, mapa de dependências e decisão arquitetural", "metrics": "taxa de fontes documentadas, completude do inventário e cobertura de responsáveis", "artifacts": "inventário de fontes, mapa de bases e sistemas, dicionário preliminar e registro de decisões"},
    "14.2": {"modules": [("m02", "M2 - Extração e ingestão"), ("m15", "M15 - Monitoramento")], "problems": "atraso de atualização, falhas silenciosas, registros rejeitados, mudança de schema e duplicação em reexecuções", "methods": "batch, ingestão incremental, CDC, streaming, paginação, retry, checksum, snapshot e schema validation", "metrics": "taxa de ingestão bem-sucedida, rejeição, conformidade de schema e cobertura de logs", "artifacts": "plano e configuração de ingestão, dataset bruto, snapshot, log e manifesto"},
    "14.3": {"modules": [("m05", "M5 - Qualidade e validação"), ("m09", "M9 - Metadados e semântica")], "problems": "inconsistências, campos inválidos, duplicidade de chave, desatualização e falhas silenciosas", "methods": "data contracts, profiling, regras de qualidade, Pandera, Great Expectations, Deequ, quarentena e testes de regressão de schema", "metrics": "completude, validade, consistência, integridade, unicidade, atualidade e índice geral de qualidade", "artifacts": "contrato e plano de qualidade, catálogo de regras, quarentena, relatório e registro de exceções"},
    "14.4": {"modules": [("m04", "M4 - Transformação e preparação"), ("m12", "M12 - Reprodutibilidade")], "problems": "ausências, ruído, formatos incompatíveis, duplicidades, outliers e transformações não rastreáveis", "methods": "limpeza textual, coerção tipada, imputação, deduplicação, padronização, normalização, encoding, enriquecimento e regras versionadas", "metrics": "ganho de completude, transformações rastreáveis, impacto da transformação e atributos derivados documentados", "artifacts": "plano de transformação, registro de regras, dataset tratado, relatório antes/depois e manifesto"},
    "14.5": {"modules": [("m04", "M4 - Preparação"), ("m06", "M6 - Desbalanceamento e equidade"), ("m14", "M14 - Feature engineering")], "problems": "ausência não aleatória, extremos legítimos confundidos com erros, classes desbalanceadas e data leakage", "methods": "diagnóstico MCAR/MAR/MNAR, remoção justificada, imputação, IQR, winsorização, escalas, one-hot/ordinal encoding e ajuste apenas no treino", "metrics": "percentual imputado, linhas afetadas, razão de desbalanceamento, perda por grupo e taxa de features com vazamento", "artifacts": "notebook comparativo, baseline, parâmetros aprendidos, feature set e justificativa metodológica"},
    "14.6": {"modules": [("m03", "M3 - Integração e harmonização"), ("m09", "M9 - Semântica")], "problems": "silos, chaves instáveis, baixa interoperabilidade semântica, granularidades e janelas temporais incompatíveis", "methods": "merge com cardinalidade, record linkage, entity resolution, tabela de correspondência, harmonização semântica e reconciliação", "metrics": "taxa de integração válida, não pareamento, multiplicação de linhas e coerência semântica", "artifacts": "plano de integração, mapa de chaves, equivalências, conflitos, dataset integrado e reconciliação de totais"},
    "14.7": {"modules": [("m07", "M7 - Armazenamento analítico"), ("m08", "M8 - Disponibilização e consumo")], "problems": "ativos obsoletos, baixa reprocessabilidade, consultas lentas, acesso indevido e baixo reuso", "methods": "bronze/prata/ouro, Parquet, SQLite, DuckDB, warehouse, lake/lakehouse, esquema estrela, particionamento, índices e carga incremental", "metrics": "cobertura, ativos versionados, localização documentada, tempo de consulta, reprocessabilidade e adequação ao uso", "artifacts": "modelo de armazenamento, data mart, snapshot versionado, produto de dados, API/view e política de acesso"},
    "14.8": {"modules": [("m09", "M9 - Catálogo"), ("m10", "M10 - Governança"), ("m11", "M11 - Linhagem"), ("m12", "M12 - Reprodutibilidade")], "problems": "baixa governança, ausência de metadados, baixa rastreabilidade, dados sensíveis sem classificação e análises irreproduzíveis", "methods": "catálogo, glossário, classificação, RBAC, logs estruturados, OpenLineage, grafo de linhagem, versionamento e ambiente fixado", "metrics": "completude de metadados, cobertura de catálogo/linhagem, ativos auditáveis, conformidade e execuções reproduzíveis", "artifacts": "catálogo, dicionário, glossário, matriz de permissões, grafo de linhagem, trilha de auditoria e pacote reprodutível"},
    "14.9": {"modules": [("m13", "M13 - Representações analíticas"), ("m14", "M14 - Feature engineering"), ("m06", "M6 - Equidade")], "problems": "unidade de análise incorreta, leakage temporal, baixa qualidade de rótulos, vieses e features sem proveniência", "methods": "representação tabular/temporal, feature engineering, seleção e PCA, split temporal/estratificado, pipelines de treino, baseline e avaliação por grupo", "metrics": "features documentadas e com lineage, completude, vazamento, cobertura temporal e desempenho por grupo", "artifacts": "plano de representação, catálogo e regra de features, feature set/store, relatório de validação e limitações"},
    "14.10": {"modules": [("m15", "M15 - Monitoramento e drift"), ("m12", "M12 - Reprodutibilidade"), ("m08", "M8 - Produto de dados")], "problems": "falhas silenciosas, dívida de dados, drift, reprocessamento manual e produtos sem responsável", "methods": "orquestração, testes por etapa, idempotência, baseline, observabilidade, detecção de drift, alerta, incidentes, rollback e runbook", "metrics": "ativos monitorados, atualização no prazo, schema/data/feature drift, MTTD, MTTR e sucesso ponta a ponta", "artifacts": "manifesto de execução, painel, alertas, registro de incidentes, runbook, pacote reprodutível e ficha de produto"},
}


M14_OPENINGS = {
    "14.1": "Uma equipe possui planilhas, APIs e bancos, mas não sabe quais fontes existem, quem responde por elas nem como chegam ao produto analítico.",
    "14.2": "A carga diária terminou sem erro aparente, porém recebeu somente parte das páginas da API e duplicou registros ao ser reexecutada.",
    "14.3": "Um dashboard foi publicado com e-mails inválidos, chaves repetidas e datas futuras porque o pipeline verificava apenas se o arquivo existia.",
    "14.4": "Duas equipes limpam a mesma base com regras diferentes e não conseguem explicar por que determinado valor foi alterado.",
    "14.5": "A média preencheu ausências, a escala usou todo o dataset e outliers foram removidos automaticamente; o modelo parece ótimo, mas a avaliação está contaminada.",
    "14.6": "Depois de um merge, mil inscrições viraram quatro mil linhas porque as chaves e a granularidade não foram verificadas.",
    "14.7": "Arquivos chamados final, final2 e final_agora_vai circulam por e-mail; ninguém sabe qual versão alimentou o relatório.",
    "14.8": "Um indicador divergente chega à gestão, mas não há catálogo, log, versão nem linhagem para reconstruir sua origem.",
    "14.9": "Uma feature usa informação registrada depois do evento previsto e cria um resultado excelente que não pode existir em produção.",
    "14.10": "O pipeline funciona no computador do autor, mas falha em ambiente limpo e ninguém recebe alerta quando a qualidade cai.",
}
M14_HOURS = {"14.1": 5, "14.2": 6, "14.3": 6, "14.4": 7, "14.5": 6,
             "14.6": 6, "14.7": 7, "14.8": 5, "14.9": 5, "14.10": 7}
for _code, _learning in M14_LEARNING.items():
    _learning["hours"] = M14_HOURS[_code]
    _learning["opening"] = M14_OPENINGS[_code]
    _learning["warning"] = "Automatizar sem contrato, métrica, registro de decisão e tratamento de falha transforma erros de dados em resultados convincentes, porém não confiáveis."
    _learning["reflection"] = "Quais evidências permitiriam a outra equipe auditar, reproduzir e contestar esta etapa do pipeline?"


def m14_workload_table() -> str:
    rows = ''.join(
        f'<tr><td>{key}</td><td>{data["level"]}</td><td>{data["hours"]}h</td></tr>'
        for key, data in M14_LEARNING.items()
    )
    return '<div class="table-wrap"><table class="table"><tr><th>Unidade</th><th>Domínio esperado</th><th>Carga</th></tr>' + rows + '<tr><th colspan="2">Carga horária total</th><th>60h</th></tr></table></div>'


def rm_portal_map() -> str:
    rows = [
        ("m01", "Fontes e inventário", "Núcleo", "14.1"),
        ("m02", "Extração, ingestão e armazenamento bruto", "Núcleo", "14.2"),
        ("m03", "Integração e harmonização", "Núcleo", "14.6"),
        ("m04", "Transformação, limpeza e preparação", "Núcleo", "14.4–14.5"),
        ("m05", "Qualidade e validação", "Núcleo", "14.3"),
        ("m06", "Desbalanceamento, vieses e equidade", "Aderente", "14.5 e 14.9"),
        ("m07", "Armazenamento analítico", "Núcleo", "14.1 e 14.7"),
        ("m08", "Disponibilização e consumo", "Núcleo", "14.7 e 14.10"),
        ("m09", "Metadados, catálogo e semântica", "Transversal", "14.3, 14.6 e 14.8"),
        ("m10", "Governança, segurança e privacidade", "Transversal", "14.8"),
        ("m11", "Proveniência, linhagem e rastreabilidade", "Transversal", "14.8"),
        ("m12", "Versionamento e reprodutibilidade", "Transversal", "todas; ênfase em 14.8 e 14.10"),
        ("m13", "Representações analíticas", "Aderente", "14.9"),
        ("m14", "Feature engineering e feature store", "Aderente", "14.5 e 14.9"),
        ("m15", "Monitoramento, drift e evolução", "Núcleo operacional", "14.2 e 14.10"),
        ("m16", "Agentes inteligentes de apoio", "Extensão", "projeto 14.10, sem delegar controles críticos"),
    ]
    body = ''.join(
        f'<tr><td><a href="https://ronaldocmc.github.io/UnespDataLens-RM/modulos/{code}.html" target="_blank" rel="noopener">{code.upper()}</a></td><td>{title}</td><td>{relation}</td><td>{units}</td></tr>'
        for code, title, relation, units in rows
    )
    return '<div class="table-wrap"><table class="table"><tr><th>UnespDataLens-RM</th><th>Conteúdo verificado</th><th>Aderência</th><th>Aplicação no M14</th></tr>' + body + '</table></div>'


def build_m13() -> str:
    setup_code = code("""
# Verificar versão do Python
import sys
print(sys.version)

# No portal, as bibliotecas são carregadas automaticamente pelo Pyodide.
# Em ambiente local, use no terminal:
# python -m pip install pandas numpy matplotlib seaborn scikit-learn openpyxl

import pandas as pd
import numpy as np
print("pandas:", pd.__version__)
print("NumPy:", np.__version__)
""")
    notebook_code = code("""
# Células de Markdown documentam objetivo, fonte, hipótese e interpretação.
# Células de código devem ser executadas em ordem, do início ao fim.
SEMENTE = 42
import random, numpy as np
random.seed(SEMENTE)
np.random.seed(SEMENTE)

dados = np.random.normal(loc=10, scale=2, size=5)
print("Amostra reproduzível:", dados.round(2))
print("Teste mínimo:", len(dados) == 5 and dados.min() > 0)
""")
    vars_code = code("""
nome = "Murilo"
idade = 15
peso = 65.50
matriculado = True
observacao = None

print(type(nome))        # str
print(type(idade))       # int
print(type(peso))        # float
print(type(matriculado)) # bool
print(type(observacao))  # NoneType

# snake_case: padrão recomendado para nomes de variáveis
numero_de_cadastro = 1024
telefone_residencial = "(18) 0000-0000"
""")
    operators_code = code("""
valor1 = 50
valor2 = 10

print(valor1 + valor2)   # adição
print(valor1 - valor2)   # subtração
print(valor1 * valor2)   # multiplicação
print(valor1 / valor2)   # divisão
print(valor1 // valor2)  # divisão inteira
print(valor1 % valor2)   # resto da divisão
print(valor1 ** 2)       # exponenciação

aprovado = valor1 >= 50 and valor2 >= 10
print(aprovado)
""")
    flow_code = code("""
frequencia = 0.82
nota = 7.5

if frequencia >= 0.75 and nota >= 6:
    situacao = "aprovado"
elif frequencia >= 0.75:
    situacao = "recuperação"
else:
    situacao = "pendente por frequência"

print(situacao)

contador = 3
while contador > 0:
    print("tentativa", contador)
    contador -= 1

for semana in range(1, 5):
    print(f"Semana {semana}")
""")
    structures_code = code("""
meses = ["Janeiro", "Fevereiro", "Março", "Abril"]
dias = ("domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado")
disciplinas = {"cálculo", "estruturas de dados", "banco de dados", "cálculo"}

participante = {
    "nome": "José da Silva",
    "genero": "M",
    "email": "js@gmail.com",
    "idade": 50
}

print(meses[0])
print(dias[0])
print(disciplinas)       # remove duplicidades
print(participante.get("email"))

for chave, valor in participante.items():
    print(chave, valor)
""")
    pandas_code = code("""
import pandas as pd

dicionario_alunos = {
    "nome": ["José da Silva", "Maria Antonia", "Carlos Oliveira"],
    "genero": ["M", "F", None],
    "email": ["js@gmail.com", "ma@gmail.com", "co@gmail.com"],
    "idade": [50, 25, 75]
}

df = pd.DataFrame(dicionario_alunos)
display(df)

print(df.head())
print(df.shape)
print(df.info())
print(df.describe(numeric_only=True))
print(df.isna())
""")
    series_code = code("""
import pandas as pd

alunos = pd.Series(["José da Silva", "Maria Antonia", "Carlos Oliveira"])
print(alunos[1])

pessoas = pd.Series(
    ["José da Silva", "Paulo Marques", "Maria Antonia", "Carlos Oliveira"],
    index=["aluno", "professor", "aluno", "aluno"]
)
print(pessoas["professor"])

serie = pd.Series(
    [11, 12, 21, 22, 23, 31, 32, 41, 42],
    index=[["A", "A", "B", "B", "B", "C", "C", "D", "D"],
           [1, 2, 1, 2, 3, 1, 2, 1, 2]]
)

print(serie.loc["B"])
print(serie.unstack())
""")
    functions_code = code("""
def calcular_frequencia(presencas, total_aulas):
    if total_aulas == 0:
        return 0
    return presencas / total_aulas

def classificar_participante(nome, presencas, total_aulas):
    frequencia = calcular_frequencia(presencas, total_aulas)
    if frequencia >= 0.75:
        return f"{nome}: aprovado por frequência ({frequencia:.0%})"
    return f"{nome}: pendente por frequência ({frequencia:.0%})"

print(classificar_participante("Ana", 9, 12))

# Função lambda para transformação rápida
normalizar_nome = lambda texto: texto.strip().title()
print(normalizar_nome("  maria antonia  "))
""")
    files_code = code("""
import pandas as pd
from pathlib import Path

base = Path("dados")
base.mkdir(exist_ok=True)

df = pd.DataFrame({
    "nome": ["Ana", "Carlos", "Maria"],
    "modulo": ["Python", "Python", "Dados"],
    "presencas": [10, 8, 12],
    "total_aulas": [12, 12, 12]
})

csv_path = base / "participantes.csv"
json_path = base / "resumo.json"

df.to_csv(csv_path, index=False, encoding="utf-8")

try:
    dados = pd.read_csv(csv_path)
    dados["frequencia"] = dados["presencas"] / dados["total_aulas"]
    dados.to_json(json_path, orient="records", force_ascii=False, indent=2)
except FileNotFoundError:
    print("Arquivo não encontrado. Verifique o caminho.")
except Exception as erro:
    print("Erro inesperado:", erro)
""")
    import_formats_code = code("""
import pandas as pd
from io import StringIO
import sqlite3

csv = StringIO("id,nome,nota\\n1,Ana,8.5\\n2,Caio,7.0")
tsv = StringIO("id\\tcidade\\n1\\tAssis\\n2\\tBauru")
json_texto = '[{"id": 1, "perfil": "comunidade"}, {"id": 2, "perfil": "servidor"}]'

alunos = pd.read_csv(csv)
cidades = pd.read_csv(tsv, sep="\\t")
perfis = pd.read_json(StringIO(json_texto))

conexao = sqlite3.connect(":memory:")
alunos.to_sql("alunos", conexao, index=False)
consulta = pd.read_sql_query("SELECT * FROM alunos WHERE nota >= 7.5", conexao)
print(alunos.merge(cidades, on="id").merge(perfis, on="id"))
print("Consulta SQL:\\n", consulta)
""")
    reproducibility_code = code("""
from pathlib import Path
import hashlib, json, platform
import pandas as pd, numpy as np

artefato = Path("dados/participantes.csv")
metadados = {
    "python": platform.python_version(),
    "pandas": pd.__version__, "numpy": np.__version__,
    "semente": 42,
    "entrada_sha256": hashlib.sha256(artefato.read_bytes()).hexdigest()
}
Path("dados/manifesto.json").write_text(
    json.dumps(metadados, indent=2, ensure_ascii=False), encoding="utf-8")

# Restart & Run All deve reproduzir estes testes sem depender de estado oculto.
recarregado = pd.read_csv(artefato)
assert set(["nome", "modulo", "presencas", "total_aulas"]) <= set(recarregado.columns)
assert recarregado["total_aulas"].gt(0).all()
print(metadados)
""")
    oop_code = code("""
class Participante:
    def __init__(self, nome, email, modulo, presencas, total_aulas):
        self.nome = nome
        self.email = email
        self.modulo = modulo
        self.presencas = presencas
        self.total_aulas = total_aulas

    def frequencia(self):
        return self.presencas / self.total_aulas

    def situacao(self):
        return "aprovado" if self.frequencia() >= 0.75 else "pendente"

ana = Participante("Ana", "ana@email.com", "Python", 10, 12)
print(ana.nome, ana.frequencia(), ana.situacao())
""")
    viz_code = code("""
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.DataFrame({
    "perfil": ["Melhor Idade", "Comunidade", "Comunidade", "Pós-graduação"],
    "inscritos": [25, 40, 38, 12],
    "semana": [1, 1, 2, 2]
})

sns.barplot(data=df, x="perfil", y="inscritos")
plt.title("Inscritos por perfil")
plt.xticks(rotation=20)
plt.tight_layout()
plt.show()
""")
    eda_code = code("""
import pandas as pd
df_eda = pd.DataFrame({
    "idade": [18, 22, 35, 48, 67, 72],
    "frequencia": [0.92, 0.75, 0.83, 0.58, 1.0, 0.91],
    "perfil": ["estudante", "estudante", "comunidade", "comunidade", "idoso", "idoso"]
})
print(df_eda.describe(include="all"))
print("Mediana:", df_eda["frequencia"].median())
print("Correlação numérica:\\n", df_eda.corr(numeric_only=True))
print("Resumo por perfil:\\n", df_eda.groupby("perfil")["frequencia"].agg(["count", "mean", "std"]))
""")

    body = f"""
<div class="module-actions"><a class="pill" href="../conceitos.html">Conceitos</a><a class="pill" href="../ferramentas.html">Ferramentas</a><a class="pill" href="../trilhas.html">Trilhas</a><a class="pill" href="../laboratorios.html">Laboratórios</a><a class="pill" href="../banco-visual.html">Banco visual</a></div>
<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3><div class="related-strip"><a class="pill" href="../ferramentas/python.html">Python</a><a class="pill" href="../ferramentas/anaconda.html">Anaconda</a><a class="pill" href="../ferramentas/jupyter.html">Jupyter Notebook/JupyterLab</a><a class="pill" href="../ferramentas/google-colab.html">Google Colab</a><a class="pill" href="../ferramentas/vscode.html">VS Code</a><a class="pill" href="../ferramentas/pycharm.html">PyCharm</a><a class="pill" href="../ferramentas/spyder.html">Spyder</a><a class="pill" href="../ferramentas/pandas.html">pandas</a><a class="pill" href="../ferramentas/numpy.html">NumPy</a><a class="pill" href="../ferramentas/matplotlib-seaborn-plotly.html">Matplotlib, Seaborn e Plotly</a></div></section>
{mini_toc([("Apresentação e competências","apresentacao"),("Carga horária","carga-horaria"),("Glossário interno do módulo","glossario"),("13.1 Ambiente e instalação","u131"),("13.2 Variáveis, tipos e operadores","u132"),("13.3 Condições, loops e compreensão de listas","u133"),("13.4 Listas, tuplas, range, conjuntos e dicionários","u134"),("13.5 Series, DataFrames e índices","u135"),("13.6 Funções, lambda e organização de código","u136"),("13.7 Arquivos, CSV, JSON e exceções","u137"),("13.8 Programação orientada a objetos","u138"),("13.9 Visualização e análise exploratória","u139"),("13.10 Projeto aplicado","u1310")])}
<section class="module-visual"><figure><img src="../assets/img/modulos/m13-visual.svg" alt="Mapa visual do Módulo 13"><figcaption>O módulo parte do ambiente Python e chega a aplicações com dados, visualização e projeto final.</figcaption></figure><aside class="character-guide"><img src="../assets/img/personagens/joao.png" alt="Personagem João"><h3>João transforma ideias em código</h3><p>O foco é aprender a pensar computacionalmente: representar dados, escrever regras, testar hipóteses, documentar resultados e revisar limites.</p></aside></section>
<section id="apresentacao"><h3>Apresentação</h3><p>Este módulo aprofunda a estrutura indicada nos anexos: ferramentas de desenvolvimento, instalação e uso inicial, sintaxe, comentários, variáveis, tipos de dados, operadores, estruturas de dados, condicionais, laços, funções, arquivos, tratamento de exceções, orientação a objetos, pandas, NumPy, visualização de dados e aplicações em mineração de dados.</p><div class="box practice"><strong>Ao final do módulo, espera-se que o participante seja capaz de:</strong><ul class="list"><li>instalar ou acessar um ambiente Python e gerenciar pacotes com PIP;</li><li>escrever códigos com variáveis, tipos, operadores, condicionais, laços e funções;</li><li>usar listas, tuplas, ranges, conjuntos, dicionários, Series e DataFrames;</li><li>ler, transformar e salvar arquivos CSV, Excel e JSON com tratamento de erros;</li><li>criar análises exploratórias, gráficos e relatórios simples com dados fictícios ou anonimizados;</li><li>organizar uma miniaplicação Python documentada e reprodutível.</li></ul></div></section>
<section id="carga-horaria"><h2 class="section-title">1. Organização do módulo</h2><h3>Carga horária total</h3><p>40 horas.</p><p>A progressão combina explicação, prática guiada, desafios, evidências e projeto reprodutível.</p><div class="table-wrap"><table class="table"><tr><th>Unidade</th><th>Foco demonstrável</th><th>Carga</th></tr><tr><td>13.1</td><td>ambiente e notebook reproduzível</td><td>3h</td></tr><tr><td>13.2–13.4</td><td>fundamentos e estruturas da linguagem</td><td>9h</td></tr><tr><td>13.5</td><td>Series, DataFrames e índices</td><td>5h</td></tr><tr><td>13.6</td><td>funções, organização e testes</td><td>4h</td></tr><tr><td>13.7</td><td>arquivos, formatos, exceções e manifesto</td><td>5h</td></tr><tr><td>13.8</td><td>orientação a objetos</td><td>3h</td></tr><tr><td>13.9</td><td>EDA, estatística e visualização</td><td>5h</td></tr><tr><td>13.10</td><td>projeto aplicado</td><td>6h</td></tr><tr><th colspan="2">Total</th><th>40h</th></tr></table></div></section>
<section id="glossario"><h2 class="section-title">Glossário interno do módulo</h2><p>Os conceitos abaixo aparecem no módulo e também possuem páginas próprias na enciclopédia. Eles ficam aqui para que o participante não precise sair da página para acompanhar a aula.</p>{concept_grid(PY_CONCEPTS)}</section>
{unit("13.1 Ferramentas disponíveis, instalação e uso inicial", "Conhecer opções de ambiente local e em nuvem, instalar pacotes e importar bibliotecas.", "<p>Python pode ser usado de várias formas. Para iniciantes, o <strong>Google Colab</strong> reduz barreiras porque roda no navegador. Para cursos de dados em laboratório, <strong>Anaconda</strong> facilita a instalação de pacotes científicos e traz Jupyter e Spyder. Para desenvolvimento de projetos, <strong>VS Code</strong> e <strong>PyCharm</strong> ajudam a organizar arquivos, depurar e versionar código.</p><div class=\"table-wrap\"><table class=\"table\"><tr><th>Ferramenta</th><th>Quando usar</th><th>Cuidados</th></tr><tr><td>Anaconda</td><td>Ambiente completo para ciência de dados e aprendizado de máquina.</td><td>Verificar espaço em disco, atualizações e política institucional.</td></tr><tr><td>Spyder</td><td>Ambiente científico com exploração de variáveis e depuração.</td><td>Bom para análise; menos adequado para projetos web complexos.</td></tr><tr><td>Jupyter Notebook/Lab</td><td>Aulas, experimentos, textos narrativos, gráficos e código juntos.</td><td>Não compartilhar notebooks com dados pessoais.</td></tr><tr><td>PyCharm</td><td>Projetos maiores, testes, classes e depuração.</td><td>Pode ser pesado para computadores simples.</td></tr><tr><td>Google Colab</td><td>Uso rápido no navegador, sem instalação local.</td><td>Há limites de sessão, memória e recursos.</td></tr><tr><td>VS Code</td><td>Editor leve, extensível, com suporte a Python e notebooks.</td><td>Instalar extensões confiáveis.</td></tr></table></div><h3>Preparando o ambiente com PIP</h3>" + setup_code + "<h3>Notebook como documento computacional</h3><p>Um notebook combina células Markdown, código e resultados. Para ser reprodutível, deve declarar entradas, semente, dependências e ordem de execução; use <em>Restart &amp; Run All</em> antes da entrega.</p>" + notebook_code)}
{unit("13.2 Variáveis, tipos de dados, constantes e operadores", "Compreender como Python representa valores e executa operações aritméticas, lógicas e de comparação.", "<p>Uma variável é um nome que referencia um valor. Em Python, os tipos são inferidos automaticamente. A convenção de nomes usa letras minúsculas e underscore, padrão conhecido como <em>snake_case</em>.</p>" + vars_code + "<h3>Operadores aritméticos e lógicos</h3><div class=\"table-wrap\"><table class=\"table\"><tr><th>Operação</th><th>Significado</th></tr><tr><td>a + b</td><td>adição</td></tr><tr><td>a - b</td><td>subtração</td></tr><tr><td>a * b</td><td>multiplicação</td></tr><tr><td>a / b</td><td>divisão</td></tr><tr><td>a // b</td><td>divisão inteira</td></tr><tr><td>a % b</td><td>resto da divisão</td></tr><tr><td>a ** b</td><td>exponenciação</td></tr><tr><td>==, !=, &lt;, &gt;, &lt;=, &gt;=</td><td>comparações</td></tr><tr><td>and, or, not</td><td>operações lógicas</td></tr></table></div>" + operators_code)}
{unit("13.3 Controle de fluxo, estruturas condicionais, while, for e compreensões", "Usar decisões e repetições para transformar regras em algoritmos.", "<p>Estruturas condicionais permitem que o programa escolha caminhos. Laços de repetição permitem executar uma ação várias vezes. O <code>while</code> executa enquanto uma condição for verdadeira; o <code>for</code> percorre sequências como listas, ranges e DataFrames.</p>" + flow_code + code("nomes = ['ana', 'carlos', 'maria']\nnomes_formatados = [nome.title() for nome in nomes]\nprint(nomes_formatados)"))}
{unit("13.4 Estruturas de dados: listas, tuplas, range, conjuntos e dicionários", "Organizar coleções de informações conforme o tipo de problema.", "<p>Listas são mutáveis; tuplas são imutáveis; ranges representam sequências numéricas; conjuntos removem duplicidades e permitem união/interseção/diferença; dicionários armazenam pares chave-valor e são úteis para representar registros.</p>" + structures_code + "<div class=\"box tip\"><strong>Atenção:</strong> em Python, interseção de conjuntos usa <code>&amp;</code>, união usa <code>|</code> e diferença usa <code>-</code>.</div>")}
{unit("13.5 Series, DataFrames, índices e métodos básicos do pandas", "Criar estruturas tabulares, identificar valores ausentes e usar métodos de inspeção.", "<p>Uma <strong>Series</strong> é uma estrutura unidimensional. Um <strong>DataFrame</strong> organiza dados em linhas e colunas, permitindo filtros, agrupamentos, junções, estatísticas e visualizações.</p>" + pandas_code + "<h3>Series, índices personalizados e índices hierárquicos</h3>" + series_code + "<h3>Métodos essenciais do pandas</h3><ul><li><code>head()</code>: visualiza primeiras linhas;</li><li><code>shape</code>: mostra linhas e colunas;</li><li><code>describe()</code>: estatísticas descritivas;</li><li><code>isna()</code>: identifica ausências;</li><li><code>loc</code> e <code>iloc</code>: selecionam dados por rótulo ou posição;</li><li><code>merge</code>, <code>join</code> e <code>concat</code>: combinam tabelas.</li></ul>")}
{unit("13.6 Funções, parâmetros, retorno, lambda e organização de código", "Criar blocos reutilizáveis e melhorar legibilidade, teste e manutenção.", "<p>Funções reduzem repetição, deixam o código mais legível e permitem testar partes pequenas de uma solução. Uma função deve ter objetivo claro, entradas, processamento e saída.</p>" + functions_code)}
{unit("13.7 Manipulação de arquivos, CSV, JSON, Excel e tratamento de exceções", "Ler e escrever arquivos com segurança, tratando erros previsíveis.", "<p>Grande parte das aplicações de dados começa lendo arquivos. O participante deve aprender separador, codificação, tipos e caminho; validar a importação; tratar erros; e nunca publicar dados pessoais sem autorização.</p>" + files_code + "<h3>CSV, TSV, JSON e SQL sem arquivos externos</h3>" + import_formats_code + "<h3>Manifesto, versões, hash e testes de reprodução</h3><p>Reprodutibilidade exige ambiente identificável, entrada íntegra, caminhos relativos, funções determinísticas, sementes e testes. O notebook deve explicar licença, autoria, limitações e como reconstruir o resultado.</p>" + reproducibility_code)}
{unit("13.8 Programação orientada a objetos: classes, objetos, herança, encapsulamento e composição", "Compreender como organizar entidades e comportamentos em classes.", "<p>Orientação a objetos ajuda quando queremos representar entidades do problema, como participante, turma, módulo ou certificado. Classes definem estrutura; objetos são instâncias concretas.</p>" + oop_code + "<div class=\"box practice\"><strong>Extensão:</strong> implemente uma classe <code>Turma</code> que receba uma lista de participantes e calcule média de frequência.</div>")}
{unit("13.9 Visualização de dados, análise exploratória e comunicação", "Criar gráficos e interpretar dados com cuidado metodológico.", "<p>Análise exploratória combina distribuição, tendência central, dispersão, grupos, correlações e visualização. Correlação não demonstra causalidade, e o resumo precisa registrar ausências e tamanho de cada grupo.</p>" + eda_code + "<h3>Gráfico com título, escala e contexto</h3>" + viz_code + "<ul><li><strong>Matplotlib:</strong> base para gráficos personalizáveis;</li><li><strong>Seaborn:</strong> gráficos estatísticos com bom padrão visual;</li><li><strong>Plotly:</strong> visualizações interativas.</li></ul>")}
{unit("13.10 Projeto aplicado: miniaplicação Python com dados", "Integrar ambiente, código, dados, funções, arquivos e visualização.", "<p>O projeto final deve usar dados fictícios ou anonimizados e entregar um notebook ou script reprodutível.</p>" + code("import pandas as pd\n\n# 1. Extrair ou criar base fictícia\ndf = pd.DataFrame({\n    'nome': ['Ana', 'Carlos', 'Maria', 'Ana'],\n    'perfil': ['Melhor Idade', 'Comunidade', 'Comunidade', 'Melhor Idade'],\n    'presencas': [10, 7, 12, 10],\n    'total_aulas': [12, 12, 12, 12]\n})\n\n# 2. Transformar\ndf['nome'] = df['nome'].str.strip().str.title()\ndf['frequencia'] = df['presencas'] / df['total_aulas']\ndf['situacao'] = df['frequencia'].apply(lambda x: 'aprovado' if x >= 0.75 else 'pendente')\n\n# 3. Validar e resumir\nresumo = df.drop_duplicates().groupby('perfil').agg(\n    participantes=('nome', 'count'),\n    frequencia_media=('frequencia', 'mean')\n).reset_index()\n\nprint(resumo)\nresumo.to_csv('resumo_turma.csv', index=False, encoding='utf-8')") + "<div class=\"box lab\"><strong>Entrega:</strong> notebook ou script com objetivo, base fictícia, código, gráfico, interpretação, limitações e próximos passos.</div>")}
"""
    return html_shell(13, "Python: Fundamentos e Aplicações", "Caderno aprofundado de programação Python para fundamentos, análise de dados, visualização, mineração de dados e aplicações em IA.", "#1976D2", "#EAF4FF", body)


def build_m14() -> str:
    jupyter_repro_code = code("""
import hashlib, json, platform, random
import numpy as np
import pandas as pd

SEMENTE = 42
random.seed(SEMENTE); np.random.seed(SEMENTE)
entrada = pd.DataFrame({"id": [1, 2, 3], "valor": [10.0, 12.5, 9.0]})
saida = entrada.assign(valor_padronizado=lambda d: (d.valor-d.valor.mean())/d.valor.std(ddof=0))

manifesto = {
    "python": platform.python_version(), "pandas": pd.__version__,
    "numpy": np.__version__, "semente": SEMENTE,
    "entrada_sha256": hashlib.sha256(entrada.to_csv(index=False).encode()).hexdigest(),
    "saida_sha256": hashlib.sha256(saida.to_csv(index=False).encode()).hexdigest(),
    "linhas_entrada": len(entrada), "linhas_saida": len(saida)
}
assert entrada["id"].is_unique
assert np.isclose(saida["valor_padronizado"].mean(), 0)
print(saida.round(3))
print(json.dumps(manifesto, indent=2, ensure_ascii=False))
""")
    jupyter_engineering = (
        '<section id="jupyter-engenharia"><h2 class="section-title">Jupyter, preparação de dados e reprodutibilidade</h2>'
        '<p>O anexo organiza a preparação em quatro categorias que se combinam conforme o problema: <strong>limpeza</strong>, <strong>integração</strong>, <strong>transformação</strong> e <strong>redução</strong>. Essa organização foi incorporada às unidades 14.3–14.6. O texto também reforça que notebook executável não é sinônimo de análise reprodutível.</p>'
        '<div class="table-wrap"><table class="table"><tr><th>Recomendação do anexo</th><th>Aplicação de engenharia</th></tr>'
        '<tr><td>nomes portáveis e títulos Markdown</td><td>organização do repositório e narrativa técnica</td></tr>'
        '<tr><td>dependências e versões declaradas</td><td>ambiente reconstruível e menor risco de resultado divergente</td></tr>'
        '<tr><td>importações no início</td><td>falha rápida quando o ambiente está incompleto</td></tr>'
        '<tr><td>caminhos relativos</td><td>execução em outra máquina, CI ou contêiner</td></tr>'
        '<tr><td>ambiente limpo e execução do início ao fim</td><td>detecção de estado oculto e dependência não declarada</td></tr>'
        '<tr><td>dados e resultados versionados</td><td>proveniência, comparação e auditoria</td></tr></table></div>'
        '<div class="box warn"><strong>Atenção</strong></div><p>Executar células fora de ordem pode usar variáveis antigas e produzir um resultado impossível de reconstruir. Antes da entrega, reinicie o kernel, execute tudo e compare hashes, volumes e métricas.</p>'
        '<h3>Manifesto mínimo executável</h3>' + jupyter_repro_code + '</section>'
    )
    imports_code = code("""
from pathlib import Path
from datetime import datetime
import json
import logging

import numpy as np
import pandas as pd
""")
    extract_code = code("""
from pathlib import Path
import pandas as pd

RAW = Path("dados/raw")
RAW.mkdir(parents=True, exist_ok=True)

# CSV
inscricoes_csv = pd.read_csv(RAW / "inscricoes.csv", encoding="utf-8")

# Excel
presencas_xlsx = pd.read_excel(RAW / "presencas.xlsx", engine="openpyxl")

# JSON
avaliacoes_json = pd.read_json(RAW / "avaliacoes.json")

# API pública ou institucional: exemplo conceitual
import requests
resposta = requests.get("https://api.exemplo.gov/dados", timeout=20)
if resposta.status_code == 200:
    dados_api = pd.DataFrame(resposta.json())
""")
    sample_data_code = code("""
import pandas as pd
import numpy as np

inscricoes = pd.DataFrame({
    "id_inscricao": [1, 2, 3, 4, 4],
    "nome": [" ana silva ", "Carlos Souza", "MARIA LIMA", None, None],
    "email": ["ana@email.com", "carlos@", "maria@email.com", "idoso@email.com", "idoso@email.com"],
    "perfil": ["melhor idade", "comunidade", "comunidade", "melhor idade", "melhor idade"],
    "idade": [67, 35, 28, 72, 72],
    "modulo": ["Python", "Python", "Dados", "Python", "Python"],
    "data_inscricao": ["2026-07-06", "2026-07-07", "2026-07-09", "2026-07-10", "2026-07-10"]
})

presencas = pd.DataFrame({
    "email": ["ana@email.com", "maria@email.com", "idoso@email.com"],
    "presencas": [10, 9, 12],
    "total_aulas": [12, 12, 12]
})
""")
    architecture_methods = "".join([
        technique("Camada bronze: preservar o dado bruto", "Guarda uma cópia imutável da fonte, com data de ingestão e sem correções silenciosas. Ela permite reproduzir o processamento e investigar incidentes.", """BRONZE = Path("dados/bronze")
BRONZE.mkdir(parents=True, exist_ok=True)
carimbo = datetime.now().strftime("%Y%m%d_%H%M%S")
inscricoes.to_csv(BRONZE / f"inscricoes_{carimbo}.csv", index=False)"""),
        technique("Camada prata: limpar e validar", "Recebe dados tipados, padronizados e acompanhados por regras de qualidade. Registros rejeitados seguem para quarentena, não desaparecem.", """PRATA = Path("dados/prata")
PRATA.mkdir(parents=True, exist_ok=True)
prata = inscricoes.copy()
prata["email"] = prata["email"].str.strip().str.lower()
prata["data_inscricao"] = pd.to_datetime(prata["data_inscricao"], errors="coerce")
prata = prata.drop_duplicates("id_inscricao", keep="last")
prata.to_parquet(PRATA / "inscricoes.parquet", index=False)"""),
        technique("Camada ouro: produzir indicadores", "Entrega tabelas estáveis e orientadas ao consumo. Cada indicador deve ter definição, granularidade e data de atualização conhecidas.", """OURO = Path("dados/ouro")
OURO.mkdir(parents=True, exist_ok=True)
ouro = prata.groupby("modulo", dropna=False).agg(
    participantes=("id_inscricao", "nunique"),
    idade_media=("idade", "mean")
).reset_index()
ouro["atualizado_em"] = pd.Timestamp.now()
ouro.to_csv(OURO / "indicadores_modulo.csv", index=False)"""),
    ])
    ingestion_methods = "".join([
        technique("Ingestão de CSV", "Informe encoding, separador e tipos quando necessário. Não dependa sempre da inferência automática, principalmente para códigos com zeros à esquerda.", """csv = pd.read_csv(
    RAW / "inscricoes.csv", encoding="utf-8", sep=",",
    dtype={"id_inscricao": "Int64", "cep": "string"}
)
print(csv.shape, csv.dtypes)"""),
        technique("Ingestão de Excel", "Escolha explicitamente a planilha e o mecanismo de leitura. Verifique cabeçalhos mesclados, fórmulas e datas, pois planilhas podem misturar apresentação e dados.", """excel = pd.read_excel(
    RAW / "presencas.xlsx", sheet_name="Dados",
    engine="openpyxl", dtype={"email": "string"}
)
print(excel.head())"""),
        technique("Ingestão de JSON", "JSON pode conter objetos aninhados. Use <code>json_normalize</code> para transformar estruturas hierárquicas em colunas tabulares.", """with open(RAW / "avaliacoes.json", encoding="utf-8") as arquivo:
    bruto_json = json.load(arquivo)
avaliacoes = pd.json_normalize(
    bruto_json, record_path="respostas", meta=["turma"]
)
print(avaliacoes.columns.tolist())"""),
        technique("Ingestão por API", "Defina timeout, autenticação segura, paginação e tratamento de status HTTP. Nunca grave tokens no código-fonte.", """import os, requests
headers = {"Authorization": f"Bearer {os.environ['API_TOKEN']}"}
resposta = requests.get(
    "https://api.exemplo.gov/dados", headers=headers, timeout=20
)
resposta.raise_for_status()
dados_api = pd.json_normalize(resposta.json()["resultados"])"""),
        technique("Ingestão de banco SQL", "Selecione somente colunas e períodos necessários. Consultas parametrizadas evitam injeção e tornam o filtro explícito.", """import sqlite3
with sqlite3.connect("dados/portal.db") as conexao:
    consulta = "SELECT id, modulo, data_inscricao FROM inscricoes WHERE data_inscricao >= ?"
    dados_sql = pd.read_sql_query(consulta, conexao, params=["2026-01-01"])
print(dados_sql.shape)"""),
    ])
    validation_methods = "".join([
        technique(
            "Schema: colunas e tipos esperados",
            "O schema funciona como um contrato: define quais colunas devem existir e qual tipo cada uma deve possuir. A checagem deve ocorrer antes das regras de conteúdo, pois uma coluna ausente torna outras validações impossíveis.",
            """schema = {
    "id_inscricao": "int64",
    "nome": "object",
    "email": "object",
    "idade": "int64",
    "data_inscricao": "object"
}

faltantes = set(schema) - set(inscricoes.columns)
if faltantes:
    raise ValueError(f"Colunas ausentes: {sorted(faltantes)}")

tipos_incorretos = {
    coluna: (str(inscricoes[coluna].dtype), tipo)
    for coluna, tipo in schema.items()
    if str(inscricoes[coluna].dtype) != tipo
}
print("Tipos divergentes:", tipos_incorretos)"""
        ),
        technique(
            "Completude: campos obrigatórios",
            "Mede se os campos indispensáveis estão preenchidos. Além de <code>NaN</code>, textos vazios e formados apenas por espaços devem ser tratados como ausentes. O resultado pode ser expresso em quantidade e percentual.",
            """obrigatorias = ["id_inscricao", "nome", "email"]
texto_vazio = inscricoes[obrigatorias].apply(
    lambda coluna: coluna.isna() | coluna.astype("string").str.strip().eq("")
)

relatorio_completude = pd.DataFrame({
    "ausentes": texto_vazio.sum(),
    "completude_pct": (1 - texto_vazio.mean()).mul(100).round(2)
})
print(relatorio_completude)"""
        ),
        technique(
            "Validade: formato e domínio",
            "Verifica se cada valor pertence ao formato ou conjunto permitido. Expressões regulares ajudam com e-mails; <code>between</code> valida intervalos; <code>isin</code> restringe categorias conhecidas.",
            """email_ok = inscricoes["email"].fillna("").str.fullmatch(
    r"[^@\\s]+@[^@\\s]+\\.[^@\\s]+"
)
idade_ok = pd.to_numeric(inscricoes["idade"], errors="coerce").between(0, 110)
perfil_ok = inscricoes["perfil"].str.strip().str.lower().isin(
    ["estudante", "docente", "técnico", "melhor idade"]
)

invalidos = inscricoes.loc[~(email_ok & idade_ok & perfil_ok)]
print(invalidos[["id_inscricao", "email", "idade", "perfil"]])"""
        ),
        technique(
            "Consistência: regras entre campos",
            "Uma linha pode ter valores individualmente válidos e ainda ser incoerente quando os campos são combinados. A regra abaixo confere a relação entre perfil e idade e registra o motivo da pendência.",
            """idade_num = pd.to_numeric(inscricoes["idade"], errors="coerce")
perfil = inscricoes["perfil"].fillna("").str.strip().str.lower()

inconsistente = perfil.eq("melhor idade") & idade_num.lt(60)
inscricoes["status_consistencia"] = np.where(
    inconsistente,
    "revisar: perfil melhor idade com idade inferior a 60",
    "ok"
)
print(inscricoes.loc[inconsistente, ["id_inscricao", "perfil", "idade"]])"""
        ),
        technique(
            "Unicidade: chaves sem repetição",
            "Identifica chaves duplicadas antes que elas multipliquem linhas em integrações ou provoquem contagens erradas. Primeiro marque todos os envolvidos; só depois decida qual registro manter.",
            """duplicados = inscricoes.duplicated(
    subset=["id_inscricao"], keep=False
)
auditoria_duplicados = inscricoes.loc[duplicados].sort_values("id_inscricao")
print(auditoria_duplicados)

if duplicados.any():
    print(f"Atenção: {duplicados.sum()} linhas compartilham uma chave")"""
        ),
        technique(
            "Atualidade e conformidade temporal",
            "Confere se datas são interpretáveis e pertencem à janela aceita pelo processo. Datas futuras ou anteriores ao início da campanha são separadas para revisão.",
            """datas = pd.to_datetime(inscricoes["data_inscricao"], errors="coerce")
inicio_campanha = pd.Timestamp("2026-01-01")
fim_campanha = pd.Timestamp("2026-12-31")

data_ok = datas.between(inicio_campanha, fim_campanha)
problemas_data = inscricoes.loc[~data_ok, ["id_inscricao", "data_inscricao"]]
print(problemas_data)"""
        ),
        technique(
            "Relatório consolidado e quarentena",
            "Em produção, a validação não deve apenas imprimir erros. Ela deve criar indicadores e separar registros válidos dos que precisam de correção, preservando o dado original e o motivo da rejeição.",
            """def validar_qualidade(df):
    email_ok = df["email"].fillna("").str.fullmatch(r"[^@\\s]+@[^@\\s]+\\.[^@\\s]+")
    idade = pd.to_numeric(df["idade"], errors="coerce")
    id_ok = df["id_inscricao"].notna() & ~df.duplicated("id_inscricao", keep=False)
    nome_ok = df["nome"].fillna("").str.strip().ne("")

    regras = pd.DataFrame({
        "id_unico": id_ok,
        "nome_preenchido": nome_ok,
        "email_valido": email_ok,
        "idade_valida": idade.between(0, 110)
    }, index=df.index)
    motivos = regras.apply(lambda linha: ", ".join(linha.index[~linha]), axis=1)
    validos = df.loc[regras.all(axis=1)].copy()
    quarentena = df.loc[~regras.all(axis=1)].assign(motivo=motivos)
    relatorio = regras.mean().mul(100).round(2).rename("conformidade_pct")
    return validos, quarentena, relatorio

validos, quarentena, relatorio = validar_qualidade(inscricoes)
print(relatorio)
display(quarentena)"""
        ),
    ])
    transform_code = code("""
def transformar_inscricoes(df):
    dados = df.copy()

    # Padronização textual
    dados["nome"] = dados["nome"].fillna("não informado").str.strip().str.title()
    dados["perfil"] = dados["perfil"].str.strip().str.lower()
    dados["modulo"] = dados["modulo"].str.strip().str.title()

    # Conversão de tipos
    dados["idade"] = pd.to_numeric(dados["idade"], errors="coerce")
    dados["data_inscricao"] = pd.to_datetime(dados["data_inscricao"], errors="coerce")

    # Validação de e-mail
    dados["email_valido"] = dados["email"].fillna("").str.contains(
        r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", regex=True
    )

    # Remoção de duplicidades por chave de negócio
    dados = dados.sort_values("data_inscricao").drop_duplicates(subset=["id_inscricao"], keep="last")

    # Regras de perfil
    dados["publico_prioritario"] = np.where(
        (dados["perfil"] == "melhor idade") & (dados["idade"] >= 60),
        True,
        False
    )

    return dados

inscricoes_tratadas = transformar_inscricoes(inscricoes)
display(inscricoes_tratadas)
""")
    transformation_methods = "".join([
        technique("Limpeza de textos", "Remove espaços externos, reduz espaços repetidos e elimina caracteres invisíveis. A limpeza deve preceder comparações, deduplicação e padronização de categorias.", """dados = inscricoes.copy()
for coluna in ["nome", "email", "perfil", "modulo"]:
    dados[coluna] = (
        dados[coluna].astype("string")
        .str.replace(r"[\\u200b\\ufeff]", "", regex=True)
        .str.replace(r"\\s+", " ", regex=True)
        .str.strip()
    )"""),
        technique("Padronização de caixa, acentos e categorias", "Converte diferentes grafias para uma representação canônica. Para exibição, preserve acentos; para comparação, pode-se criar uma chave auxiliar normalizada sem alterar o valor original.", """import unicodedata

def chave_textual(valor):
    if pd.isna(valor):
        return pd.NA
    texto = unicodedata.normalize("NFKD", str(valor))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.casefold().strip()

mapa_perfil = {
    "professor": "docente", "docente": "docente",
    "aluno": "estudante", "estudante": "estudante",
    "tecnico": "técnico"
}
dados["perfil_chave"] = dados["perfil"].map(chave_textual)
dados["perfil_padronizado"] = dados["perfil_chave"].map(mapa_perfil).fillna("não informado")
dados["nome"] = dados["nome"].str.title()
dados["email"] = dados["email"].str.lower()"""),
        technique("Conversão segura de tipos", "Transforma texto em número, data, booleano ou categoria. Com <code>errors='coerce'</code>, valores impossíveis viram ausentes e podem ser auditados, sem interromper todo o pipeline.", """dados["idade"] = pd.to_numeric(dados["idade"], errors="coerce").astype("Int64")
dados["data_inscricao"] = pd.to_datetime(
    dados["data_inscricao"], errors="coerce", dayfirst=True
)
dados["aceita_contato"] = (
    dados["aceita_contato"].astype("string").str.lower()
    .map({"sim": True, "não": False, "nao": False})
    .astype("boolean")
)
dados["perfil_padronizado"] = dados["perfil_padronizado"].astype("category")"""),
        technique("Validação e composição de chaves", "Chaves técnicas identificam uma linha; chaves de negócio representam a entidade no domínio. Uma chave composta pode evitar colisões quando o mesmo e-mail participa de módulos diferentes.", """dados["chave_participacao"] = (
    dados["email"].fillna("") + "|" + dados["modulo"].fillna("")
)
chave_invalida = dados["email"].isna() | dados["modulo"].isna()
if chave_invalida.any():
    print("Linhas sem chave completa:", chave_invalida.sum())

assert dados.loc[~chave_invalida, "chave_participacao"].ne("").all()"""),
        technique("Regras de negócio e campos derivados", "Traduz critérios institucionais explícitos em código rastreável. A regra deve registrar sua versão e distinguir dados observados de resultados calculados.", """REGRA_FREQUENCIA_VERSAO = "2026.1"
dados["frequencia"] = dados["presencas"].div(dados["total_aulas"]).clip(0, 1)
dados["situacao"] = np.select(
    [dados["frequencia"].ge(0.75), dados["frequencia"].isna()],
    ["aprovado", "revisar"],
    default="pendente"
)
dados["regra_situacao_versao"] = REGRA_FREQUENCIA_VERSAO
dados["dias_desde_inscricao"] = (
    pd.Timestamp.today().normalize() - dados["data_inscricao"]
).dt.days"""),
        technique("Pipeline de transformação reutilizável", "Reúne operações determinísticas em uma função que recebe uma base e devolve uma nova cópia. Isso facilita testes, versionamento e repetição sem modificar os dados brutos.", """def transformar(df):
    resultado = df.copy()
    resultado["nome"] = resultado["nome"].astype("string").str.strip().str.title()
    resultado["email"] = resultado["email"].astype("string").str.strip().str.lower()
    resultado["idade"] = pd.to_numeric(resultado["idade"], errors="coerce").astype("Int64")
    resultado["data_inscricao"] = pd.to_datetime(resultado["data_inscricao"], errors="coerce")
    resultado["email_valido"] = resultado["email"].str.fullmatch(r"[^@\\s]+@[^@\\s]+\\.[^@\\s]+")
    return resultado

dados_transformados = transformar(inscricoes)
display(dados_transformados.head())"""),
    ])
    preprocessing_methods = "".join([
        technique("Remoção de registros", "É indicada quando a linha não pode ser utilizada nem corrigida, por exemplo, por ausência de uma chave obrigatória. Antes de remover, quantifique o impacto e mantenha uma quarentena para auditoria.", """sem_chave = dados_transformados["id_inscricao"].isna()
quarentena_sem_chave = dados_transformados.loc[sem_chave].assign(
    motivo="id_inscricao ausente"
)
dados_validos = dados_transformados.loc[~sem_chave].copy()
print(f"Removidas: {sem_chave.sum()} de {len(dados_transformados)} linhas")"""),
        technique("Imputação: média, mediana, moda e categoria explícita", "A média é sensível a extremos; a mediana é mais robusta; a moda atende categorias; e “não informado” evita inventar uma classe. Calcule parâmetros somente no conjunto de treino quando houver modelo de IA.", """df = dados_transformados.copy()
df["idade_media"] = df["idade"].fillna(df["idade"].mean())
df["idade_mediana"] = df["idade"].fillna(df["idade"].median())
df["perfil_moda"] = df["perfil"].fillna(df["perfil"].mode().iloc[0])
df["perfil_explicito"] = df["perfil"].fillna("não informado")

# Indicador preserva a informação de que o valor original estava ausente
df["idade_foi_imputada"] = df["idade"].isna()"""),
        technique("Normalização min-max", "Reescala uma variável para o intervalo de 0 a 1. É útil quando atributos possuem escalas muito diferentes, mas é sensível a extremos e requer tratamento quando mínimo e máximo são iguais.", """def normalizar_minmax(serie):
    minimo, maximo = serie.min(), serie.max()
    if pd.isna(minimo) or minimo == maximo:
        return pd.Series(0.0, index=serie.index)
    return (serie - minimo) / (maximo - minimo)

df["idade_minmax"] = normalizar_minmax(df["idade"].astype("float64"))
print(df[["idade", "idade_minmax"]].head())"""),
        technique("Padronização z-score", "Centraliza os valores em média zero e desvio padrão um. É frequente em regressões, agrupamentos e métodos baseados em distância; os parâmetros devem ser aprendidos no treino e reaplicados no teste.", """from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
df[["idade_z", "frequencia_z"]] = scaler.fit_transform(
    df[["idade", "frequencia"]].fillna(0)
)
print("Médias aprendidas:", scaler.mean_)
print("Escalas aprendidas:", scaler.scale_)"""),
        technique("Encoding de categorias", "One-hot cria uma coluna binária por categoria e é adequado para classes sem ordem. Ordinal encoding só deve ser usado quando existe uma ordem real, como baixo, médio e alto.", """# Categorias sem ordem: one-hot encoding
one_hot = pd.get_dummies(df["perfil"], prefix="perfil", dtype=int)
df = pd.concat([df, one_hot], axis=1)

# Categoria com ordem conhecida
ordem_prioridade = {"baixa": 0, "média": 1, "alta": 2}
df["prioridade_codigo"] = df["prioridade"].map(ordem_prioridade).astype("Int64")"""),
        technique("Deduplicação por chave e combinação de campos", "Use uma chave estável quando existir. Sem chave técnica, combine campos normalizados. Ordene por data para explicitar se será mantida a ocorrência mais recente ou mais antiga.", """df = df.sort_values("data_inscricao")

# Chave técnica: mantém a atualização mais recente
df_por_id = df.drop_duplicates(subset=["id_inscricao"], keep="last")

# Chave de negócio composta
df_por_pessoa_modulo = df.drop_duplicates(
    subset=["email", "modulo"], keep="last"
)
print("Duplicatas removidas por ID:", len(df) - len(df_por_id))"""),
        technique("Detecção de outliers pelo IQR", "O intervalo interquartil é robusto e marca valores abaixo de Q1 − 1,5×IQR ou acima de Q3 + 1,5×IQR. Marcar não significa remover: primeiro investigue se o extremo é erro ou caso legítimo.", """def marcar_outliers_iqr(serie):
    q1, q3 = serie.quantile([0.25, 0.75])
    iqr = q3 - q1
    inferior, superior = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return ~serie.between(inferior, superior), inferior, superior

df["idade_outlier"], limite_inf, limite_sup = marcar_outliers_iqr(df["idade"])
print(f"Limites IQR: {limite_inf:.1f} a {limite_sup:.1f}")"""),
        technique("Winsorização de extremos", "Limita valores aos percentis escolhidos sem excluir linhas. Só deve ser aplicada com justificativa estatística e registro dos limites, porque altera a distribuição e pode esconder eventos importantes.", """inferior = df["idade"].quantile(0.01)
superior = df["idade"].quantile(0.99)
df["idade_winsorizada"] = df["idade"].clip(lower=inferior, upper=superior)
df["idade_foi_limitada"] = df["idade"].ne(df["idade_winsorizada"])

print({"p01": inferior, "p99": superior,
       "valores_limitados": int(df["idade_foi_limitada"].sum())})"""),
    ])
    merge_code = code("""
base_curada = inscricoes_tratadas.merge(
    presencas,
    on="email",
    how="left",
    validate="many_to_one"
)

base_curada["presencas"] = base_curada["presencas"].fillna(0)
base_curada["total_aulas"] = base_curada["total_aulas"].fillna(12)
base_curada["frequencia"] = base_curada["presencas"] / base_curada["total_aulas"]
base_curada["situacao"] = np.where(base_curada["frequencia"] >= 0.75, "aprovado", "pendente")

indicadores = base_curada.groupby(["modulo", "perfil"], dropna=False).agg(
    participantes=("id_inscricao", "count"),
    frequencia_media=("frequencia", "mean"),
    idade_media=("idade", "mean")
).reset_index()

display(indicadores)
""")
    integration_methods = "".join([
        technique("merge por chave", "Combina colunas de tabelas relacionadas. O argumento <code>validate</code> documenta a cardinalidade esperada e impede multiplicações acidentais.", """integrada = inscricoes_tratadas.merge(
    presencas, on="email", how="left",
    validate="many_to_one", indicator=True
)
print(integrada["_merge"].value_counts())"""),
        technique("join por índice", "É útil quando a chave já está no índice de ambas as tabelas. Confirme a unicidade antes de executar.", """a = inscricoes_tratadas.set_index("email")
b = presencas.set_index("email")
if not b.index.is_unique:
    raise ValueError("A chave da tabela de presenças não é única")
por_indice = a.join(b, how="left", rsuffix="_presenca")"""),
        technique("concat de partições", "Empilha arquivos com o mesmo schema, como inscrições mensais. <code>ignore_index</code> recria o índice; a coluna de origem mantém rastreabilidade.", """janeiro = pd.read_csv("dados/janeiro.csv").assign(origem="janeiro")
fevereiro = pd.read_csv("dados/fevereiro.csv").assign(origem="fevereiro")
historico = pd.concat([janeiro, fevereiro], ignore_index=True, join="outer")
print(historico.groupby("origem").size())"""),
        technique("groupby e indicadores", "Agrupa pela granularidade desejada e usa agregações nomeadas. Sempre confira se contagem de linhas ou de entidades únicas responde à pergunta.", """indicadores = base_curada.groupby(["modulo", "perfil"], dropna=False).agg(
    participantes=("id_inscricao", "nunique"),
    frequencia_media=("frequencia", "mean"),
    aprovados=("situacao", lambda s: s.eq("aprovado").sum())
).reset_index()
indicadores["frequencia_media"] = indicadores["frequencia_media"].round(3)"""),
    ])
    load_code = code("""
CURATED = Path("dados/curated")
CURATED.mkdir(parents=True, exist_ok=True)

base_curada.to_csv(CURATED / "participantes_curado.csv", index=False, encoding="utf-8")
indicadores.to_excel(CURATED / "indicadores.xlsx", index=False)

# Parquet é indicado para bases maiores; exige pyarrow ou fastparquet
# base_curada.to_parquet(CURATED / "participantes_curado.parquet", index=False)

# Carga em banco local SQLite
import sqlite3
with sqlite3.connect(CURATED / "portal_ia.db") as conn:
    base_curada.to_sql("participantes", conn, if_exists="replace", index=False)
    indicadores.to_sql("indicadores", conn, if_exists="replace", index=False)
""")
    storage_methods = "".join([
        technique("Decisão arquitetural orientada a requisitos", "A tecnologia é consequência dos requisitos. Volume, variedade, atualização, tipos de consulta, transações, reprocessamento, governança, equipe e custo devem ser avaliados em conjunto.", """requisitos = pd.DataFrame({
    "criterio": ["volume_gb", "atualizacoes_dia", "consulta_sql", "schema_evolutivo", "transacoes"],
    "peso": [3, 2, 3, 2, 1],
    "parquet_duckdb": [3, 2, 3, 2, 1],
    "sqlite": [1, 2, 3, 1, 3],
    "warehouse": [3, 3, 3, 3, 3]
})
for opcao in ["parquet_duckdb", "sqlite", "warehouse"]:
    requisitos[f"pontos_{opcao}"] = requisitos["peso"] * requisitos[opcao]
print(requisitos.filter(like="pontos_").sum())"""),
        technique("Zonas e critérios de promoção", "No UnespDataLens-RM, uma zona não é somente uma pasta: possui finalidade, entrada, saída, retenção, acesso e critérios de promoção. Somente dados que passam pelas regras avançam para consumo.", """ZONAS = {
    "bronze": {"imutavel": True, "entrada": "fonte", "saida": "snapshot+manifesto"},
    "prata": {"criterio": "schema_ok e qualidade >= 0.95", "saida": "dataset_tratado"},
    "ouro": {"criterio": "reconciliado e aprovado", "saida": "data_mart"}
}
qualidade, reconciliado = 0.97, True
zona_destino = "ouro" if qualidade >= 0.95 and reconciliado else "quarentena"
print("Destino:", zona_destino)"""),
        technique("Modelo dimensional: fato e dimensões", "Dashboards e indicadores se beneficiam de uma granularidade explícita. A tabela fato registra eventos mensuráveis; dimensões fornecem contexto estável.", """dim_participante = base_curada[["email", "perfil", "idade"]].drop_duplicates("email")
dim_participante["participante_sk"] = range(1, len(dim_participante) + 1)
dim_modulo = base_curada[["modulo"]].drop_duplicates().reset_index(drop=True)
dim_modulo["modulo_sk"] = range(1, len(dim_modulo) + 1)
fato_frequencia = (base_curada
    .merge(dim_participante[["email", "participante_sk"]], on="email")
    .merge(dim_modulo, on="modulo")
    [["participante_sk", "modulo_sk", "presencas", "total_aulas", "frequencia"]])
assert len(fato_frequencia) == len(base_curada)"""),
        technique("CSV e Excel", "CSV é interoperável e simples; Excel é conveniente para consumo humano. Ambos exigem atenção a encoding, tipos e limites de volume.", """base_curada.to_csv("dados/curated/base.csv", index=False, encoding="utf-8")
with pd.ExcelWriter("dados/curated/relatorio.xlsx", engine="openpyxl") as writer:
    base_curada.to_excel(writer, sheet_name="Base", index=False)
    indicadores.to_excel(writer, sheet_name="Indicadores", index=False)"""),
        technique("Parquet", "Formato colunar compacto que preserva tipos e lê apenas as colunas necessárias. É indicado para bases analíticas maiores.", """base_curada.to_parquet(
    "dados/curated/base.parquet", index=False, compression="snappy"
)
amostra = pd.read_parquet(
    "dados/curated/base.parquet", columns=["modulo", "situacao"]
)"""),
        technique("SQLite", "Banco local transacional adequado para aulas, protótipos e aplicações pequenas. Use contexto para garantir fechamento da conexão.", """import sqlite3
with sqlite3.connect("dados/curated/portal.db") as conexao:
    base_curada.to_sql("participantes", conexao, if_exists="replace", index=False)
    total = pd.read_sql_query("SELECT COUNT(*) AS n FROM participantes", conexao)
print(total)"""),
        technique("DuckDB", "Executa SQL analítico diretamente sobre DataFrames e arquivos Parquet, sem exigir um servidor separado.", """import duckdb
consulta = "SELECT modulo, COUNT(DISTINCT id_inscricao) AS participantes FROM base_curada GROUP BY modulo"
resultado = duckdb.sql(consulta).df()
print(resultado)"""),
        technique("Carga incremental", "Em vez de substituir tudo, seleciona apenas registros posteriores ao último processamento. A chave e o carimbo de atualização precisam ser confiáveis.", """ultima_carga = pd.Timestamp("2026-07-01")
incremento = base_curada.loc[
    base_curada["atualizado_em"].gt(ultima_carga)
].copy()
print(f"Linhas para carga incremental: {len(incremento)}")"""),
        technique("Particionamento e leitura seletiva", "Particione por colunas usadas nos filtros, como ano e módulo. Partições excessivamente pequenas aumentam custo de metadados e pioram a leitura.", """base_curada["ano"] = pd.to_datetime(base_curada["data_inscricao"]).dt.year
base_curada.to_parquet(
    "dados/ouro/participacoes", partition_cols=["ano", "modulo"], index=False
)
consulta_2026 = pd.read_parquet(
    "dados/ouro/participacoes", filters=[("ano", "==", 2026)]
)
assert consulta_2026["ano"].eq(2026).all()"""),
        technique("Snapshots, hash e manifesto", "Um snapshot precisa de identidade verificável. O manifesto registra arquivo, versão, quantidade, schema, horário e hash para auditoria e reconstrução.", """import hashlib, json
arquivo = Path("dados/ouro/indicadores_modulo.csv")
manifesto = {
    "ativo": "indicadores_modulo", "versao": "2026.07.1",
    "linhas": len(indicadores), "colunas": indicadores.columns.tolist(),
    "sha256": hashlib.sha256(arquivo.read_bytes()).hexdigest(),
    "gerado_em": pd.Timestamp.now().isoformat()
}
arquivo.with_suffix(".manifest.json").write_text(
    json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8"
)"""),
        technique("Benchmark e adequação", "Meça consultas representativas, não apenas tempo de gravação. Compare formatos com o mesmo resultado e registre volume, hardware, repetição e limitação do teste.", """from time import perf_counter
def medir(rotulo, funcao, repeticoes=5):
    tempos = []
    for _ in range(repeticoes):
        inicio = perf_counter(); funcao(); tempos.append(perf_counter() - inicio)
    return {"teste": rotulo, "mediana_s": float(np.median(tempos))}

testes = [
    medir("parquet_filtrado", lambda: pd.read_parquet("dados/ouro/participacoes", filters=[("ano", "==", 2026)])),
    medir("duckdb_agregado", lambda: duckdb.sql("SELECT modulo, count(*) FROM base_curada GROUP BY modulo").fetchall())
]
print(pd.DataFrame(testes))"""),
        technique("Controle de acesso e minimização", "A zona de consumo deve expor somente os campos necessários. Identificadores diretos podem ser pseudonimizados e o mapa de acesso deve relacionar ativo, finalidade e perfil.", """import hashlib
consumo = base_curada.copy()
consumo["participante_id"] = consumo["email"].fillna("").map(
    lambda x: hashlib.sha256(x.encode()).hexdigest()[:16]
)
consumo = consumo[["participante_id", "modulo", "perfil", "frequencia", "situacao"]]
assert "email" not in consumo.columns
matriz_acesso = pd.DataFrame([
    {"ativo": "data_mart_frequencia", "perfil": "analista", "permissao": "leitura"}
])"""),
    ])
    log_code = code("""
import logging
from datetime import datetime

LOGS = Path("logs")
LOGS.mkdir(exist_ok=True)

logging.basicConfig(
    filename=LOGS / "pipeline_etl.log",
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

inicio = datetime.now()
logging.info("Pipeline iniciado")
logging.info("Linhas extraídas: %s", len(inscricoes))
logging.info("Linhas carregadas: %s", len(base_curada))
logging.info("Indicadores gerados: %s", len(indicadores))
logging.info("Pipeline finalizado em %s segundos", (datetime.now() - inicio).seconds)
""")
    governance_methods = "".join([
        technique("Logs estruturados", "Registram evento, nível, etapa e métricas sem expor dados pessoais. JSON facilita consulta automática.", """import json, logging
logging.basicConfig(level=logging.INFO)
evento = {"etapa": "validacao", "linhas": len(inscricoes), "rejeitadas": len(quarentena)}
logging.info(json.dumps(evento, ensure_ascii=False))"""),
        technique("Auditoria de regras", "Mantém versão, responsável, horário e quantidade afetada por cada regra, permitindo explicar uma decisão posterior.", """auditoria = pd.DataFrame([{
    "regra": "frequencia_minima", "versao": "2026.1",
    "executado_em": pd.Timestamp.now(), "responsavel": "equipe_dados",
    "linhas_afetadas": int(base_curada["situacao"].eq("pendente").sum())
}])"""),
        technique("Linhagem", "Relaciona entrada, transformação e saída. Mesmo um registro simples ajuda a responder de onde veio um indicador.", """linhagem = {
    "origem": "dados/bronze/inscricoes.csv",
    "transformacoes": ["validar_schema", "padronizar_email", "deduplicar_id"],
    "destino": "dados/ouro/indicadores_modulo.csv",
    "pipeline_versao": "v1.3"
}
Path("logs/linhagem.json").write_text(json.dumps(linhagem, indent=2), encoding="utf-8")"""),
        technique("Catálogo e classificação", "Documenta significado, tipo, sensibilidade, finalidade e responsável por cada campo. Isso orienta acesso e uso compatível com a LGPD.", """catalogo = pd.DataFrame([
    {"campo": "id_inscricao", "tipo": "inteiro", "sensibilidade": "interno"},
    {"campo": "email", "tipo": "texto", "sensibilidade": "dado pessoal"},
    {"campo": "frequencia", "tipo": "decimal", "sensibilidade": "restrito"}
])
catalogo.to_csv("dados/catalogo.csv", index=False)"""),
    ])
    modeling_methods = "".join([
        technique("Análise exploratória", "Antes de modelar, examine distribuição, ausências, equilíbrio do alvo e relações suspeitas.", """print(base_curada[["idade", "frequencia"]].describe())
print(base_curada.isna().mean().sort_values(ascending=False))
print(base_curada["situacao"].value_counts(normalize=True))"""),
        technique("Separação treino e teste", "Reserva dados independentes para medir generalização. <code>stratify</code> preserva a proporção das classes.", """from sklearn.model_selection import train_test_split
X = base_curada[["idade", "frequencia"]].fillna(0)
y = base_curada["situacao"].eq("aprovado").astype(int)
X_treino, X_teste, y_treino, y_teste = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y
)"""),
        technique("Pipeline sem vazamento", "Encapsula imputação, escala e modelo; cada parâmetro é aprendido apenas durante o ajuste do conjunto de treino.", """from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
modelo = Pipeline([("imputar", SimpleImputer(strategy="median")),
                   ("escalar", StandardScaler()),
                   ("classificar", LogisticRegression())])
modelo.fit(X_treino, y_treino)
print("Acurácia:", modelo.score(X_teste, y_teste))"""),
        technique("Classificação e matriz de confusão", "Classificação prevê uma categoria. Acurácia isolada pode ocultar erros em classes raras; compare precisão, revocação, F1 e a matriz de confusão.", """import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
X, y = make_classification(n_samples=240, n_features=5, weights=[0.7, 0.3],
                           class_sep=1.2, random_state=42)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=.25,
    stratify=y, random_state=42)
classificador = LogisticRegression(max_iter=500).fit(X_tr, y_tr)
previsto = classificador.predict(X_te)
print("Matriz de confusão:\\n", confusion_matrix(y_te, previsto))
print(classification_report(y_te, previsto, digits=3))"""),
        technique("Regressão e erro de previsão", "Regressão prevê valores contínuos. MAE mantém a unidade original; RMSE penaliza mais os erros grandes; R² compara o modelo com a média.", """from sklearn.datasets import make_regression
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
X, y = make_regression(n_samples=180, n_features=4, noise=12, random_state=42)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=.25, random_state=42)
regressor = LinearRegression().fit(X_tr, y_tr)
previsto = regressor.predict(X_te)
print("MAE:", round(mean_absolute_error(y_te, previsto), 2))
print("RMSE:", round(root_mean_squared_error(y_te, previsto), 2))
print("R²:", round(r2_score(y_te, previsto), 3))"""),
        technique("Clusterização com K-means", "Agrupamento procura estruturas sem rótulo. Padronize variáveis, teste diferentes valores de k e interprete os centroides; um cluster não é automaticamente um perfil social real.", """import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
dados_cluster = pd.DataFrame({
    "idade": [19, 22, 24, 45, 48, 52, 67, 70, 74],
    "frequencia": [.78, .82, .75, .91, .88, .94, .62, .67, .64],
    "atividades": [3, 4, 3, 8, 7, 9, 2, 3, 2]})
X = StandardScaler().fit_transform(dados_cluster)
modelo_k = KMeans(n_clusters=3, random_state=42, n_init=10).fit(X)
dados_cluster["cluster"] = modelo_k.labels_
print(dados_cluster.groupby("cluster").mean().round(2))
print("Inércia:", round(modelo_k.inertia_, 2))"""),
        technique("Regras de associação", "Associação descobre itens que ocorrem juntos. Suporte mede frequência conjunta, confiança mede P(B|A) e lift compara essa chance com a ocorrência geral de B; lift acima de 1 sugere associação positiva.", """import pandas as pd
cestas = [
    {"python", "pandas", "jupyter"}, {"python", "pandas"},
    {"python", "jupyter"}, {"excel", "powerbi"},
    {"python", "pandas", "powerbi"}, {"pandas", "jupyter"}]
def metricas_regra(a, b, transacoes):
    n = len(transacoes)
    sup_a = sum(a in t for t in transacoes) / n
    sup_b = sum(b in t for t in transacoes) / n
    sup_ab = sum(a in t and b in t for t in transacoes) / n
    confianca = sup_ab / sup_a if sup_a else 0
    lift = confianca / sup_b if sup_b else 0
    return {"regra": f"{a} -> {b}", "suporte": sup_ab,
            "confianca": confianca, "lift": lift}
regras = pd.DataFrame([metricas_regra("python", "pandas", cestas),
                       metricas_regra("pandas", "jupyter", cestas)])
print(regras.round(3))"""),
        technique("Redução dimensional com PCA", "PCA cria componentes ortogonais que preservam parte da variância. É útil para compressão e visualização, mas reduz interpretabilidade e requer escala quando unidades diferem.", """from sklearn.datasets import load_wine
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
vinho = load_wine()
X = StandardScaler().fit_transform(vinho.data)
pca = PCA(n_components=2).fit(X)
componentes = pca.transform(X)
print("Forma original:", X.shape, "| reduzida:", componentes.shape)
print("Variância explicada:", pca.explained_variance_ratio_.round(3))
print("Total preservado:", round(pca.explained_variance_ratio_.sum(), 3))"""),
        technique("Validação cruzada e comparação com baseline", "Uma divisão única pode ser otimista. A validação cruzada estima variação entre partições, e o baseline mostra se o modelo supera uma regra simples.", """from sklearn.datasets import load_breast_cancer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_score
X, y = load_breast_cancer(return_X_y=True)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
baseline = cross_val_score(DummyClassifier(strategy="most_frequent"), X, y, cv=cv)
modelo = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
f1 = cross_val_score(modelo, X, y, cv=cv, scoring="f1")
print("Baseline acurácia:", baseline.mean().round(3))
print("F1 por dobra:", f1.round(3), "| média:", f1.mean().round(3))"""),
    ])
    full_pipeline_code = code("""
from pathlib import Path
from datetime import datetime
import json
import logging
import os
import numpy as np
import pandas as pd

RAW = Path("dados/raw")
CURATED = Path("dados/curated")
QUARANTINE = Path("dados/quarentena")
LOGS = Path("logs")
for pasta in [RAW, CURATED, QUARANTINE, LOGS]:
    pasta.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    filename=LOGS / "etl.log", level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

def extract():
    inscricoes = pd.read_csv(RAW / "inscricoes.csv", encoding="utf-8")
    presencas = pd.read_excel(RAW / "presencas.xlsx", engine="openpyxl")
    return inscricoes, presencas

def validate(df):
    colunas = {"id_inscricao", "nome", "email", "idade", "modulo", "data_inscricao"}
    faltantes = colunas - set(df.columns)
    if faltantes:
        raise ValueError(f"Schema incompatível: {sorted(faltantes)}")

    regras = pd.DataFrame(index=df.index)
    regras["id_unico"] = df["id_inscricao"].notna() & ~df.duplicated("id_inscricao", False)
    regras["nome_ok"] = df["nome"].fillna("").str.strip().ne("")
    regras["email_ok"] = df["email"].fillna("").str.fullmatch(r"[^@\\s]+@[^@\\s]+\\.[^@\\s]+")
    regras["idade_ok"] = pd.to_numeric(df["idade"], errors="coerce").between(0, 110)
    motivos = regras.apply(lambda linha: ",".join(linha.index[~linha]), axis=1)
    validos = df.loc[regras.all(axis=1)].copy()
    rejeitados = df.loc[~regras.all(axis=1)].assign(motivo=motivos)
    metricas = regras.mean().round(4).to_dict()
    return validos, rejeitados, metricas

def transform(validos, presencas):
    dados = validos.copy()
    dados["nome"] = dados["nome"].fillna("não informado").str.strip().str.title()
    dados["email"] = dados["email"].str.strip().str.lower()
    dados["perfil"] = dados["perfil"].str.strip().str.lower()
    dados["data_inscricao"] = pd.to_datetime(dados["data_inscricao"], errors="coerce")
    dados = dados.merge(presencas, on="email", how="left", validate="many_to_one")
    dados["presencas"] = dados["presencas"].fillna(0)
    dados["total_aulas"] = dados["total_aulas"].fillna(12)
    dados["frequencia"] = dados["presencas"].div(dados["total_aulas"]).clip(0, 1)
    dados["situacao"] = np.where(dados["frequencia"] >= 0.75, "aprovado", "pendente")
    return dados

def load_atomic(base, execucao_id):
    temporario = CURATED / f"participantes_{execucao_id}.tmp.csv"
    destino = CURATED / "participantes_curado.csv"
    base.to_csv(temporario, index=False, encoding="utf-8")
    os.replace(temporario, destino)
    resumo = base.groupby(["perfil", "situacao"]).size().reset_index(name="total")
    resumo.to_excel(CURATED / "indicadores.xlsx", index=False)
    return resumo

def run():
    inicio = datetime.now()
    execucao_id = inicio.strftime("%Y%m%dT%H%M%S")
    relatorio = {"execucao_id": execucao_id, "status": "iniciado"}
    try:
        inscricoes, presencas = extract()
        validos, rejeitados, metricas = validate(inscricoes)
        rejeitados.to_csv(QUARANTINE / f"rejeitados_{execucao_id}.csv", index=False)
        if metricas["id_unico"] < 0.95 or metricas["email_ok"] < 0.95:
            raise ValueError(f"Qualidade abaixo do limite: {metricas}")
        base = transform(validos, presencas)
        resumo = load_atomic(base, execucao_id)
        relatorio.update(status="sucesso", extraidas=len(inscricoes),
                         rejeitadas=len(rejeitados), carregadas=len(base), metricas=metricas)
        return resumo
    except Exception as erro:
        relatorio.update(status="falha", erro=type(erro).__name__, mensagem=str(erro))
        raise
    finally:
        relatorio["duracao_s"] = (datetime.now() - inicio).total_seconds()
        (LOGS / f"execucao_{execucao_id}.json").write_text(
            json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        logging.info(json.dumps(relatorio, ensure_ascii=False))

run()

# Testes mínimos que devem integrar a avaliação do projeto
def test_frequencia_limitada():
    exemplo = pd.DataFrame({"presencas": [15], "total_aulas": [12]})
    resultado = exemplo["presencas"].div(exemplo["total_aulas"]).clip(0, 1)
    assert resultado.iloc[0] == 1.0

test_frequencia_limitada()
""")

    body = f"""
<div class="module-actions"><a class="pill" href="../conceitos.html">Conceitos</a><a class="pill" href="../ferramentas.html">Ferramentas</a><a class="pill" href="../trilhas.html">Trilhas</a><a class="pill" href="../laboratorios.html">Laboratórios</a><a class="pill" href="../banco-visual.html">Banco visual</a></div>
<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3><div class="related-strip"><a class="pill" href="../ferramentas/python.html">Python</a><a class="pill" href="../ferramentas/pandas.html">pandas</a><a class="pill" href="../ferramentas/numpy.html">NumPy</a><a class="pill" href="../ferramentas/jupyter.html">Jupyter</a><a class="pill" href="../ferramentas/google-colab.html">Google Colab</a><a class="pill" href="../ferramentas/excel-sheets.html">Excel e Google Sheets</a><a class="pill" href="../ferramentas/power-bi.html">Power BI</a><a class="pill" href="../ferramentas/looker-studio.html">Looker Studio</a><a class="pill" href="../ferramentas/scikit-learn.html">scikit-learn</a><a class="pill" href="../ferramentas/duckdb.html">DuckDB</a></div></section>
{mini_toc([("Apresentação e competências","apresentacao"),("Mapa UnespDataLens-RM","aderencia-rm"),("Jupyter e reprodutibilidade","jupyter-engenharia"),("Glossário interno do módulo","glossario"),("14.1 Ciclo de vida e arquitetura","u141"),("14.2 Extração e ingestão","u142"),("14.3 Qualidade e validação","u143"),("14.4 Transformação e padronização","u144"),("14.5 Ausências, duplicidades e outliers","u145"),("14.6 Integração, joins e indicadores","u146"),("14.7 Carga, armazenamento e camadas","u147"),("14.8 Logs, auditoria e linhagem","u148"),("14.9 Representações e features","u149"),("14.10 Pipeline ETL completo","u1410")])}
<section class="module-visual"><figure><img src="../assets/img/modulos/m14-visual.svg" alt="Mapa visual do Módulo 14"><figcaption>Engenharia de dados conecta fontes, qualidade, transformação, armazenamento, governança e uso em IA.</figcaption></figure><aside class="character-guide"><img src="../assets/img/personagens/carlos.png" alt="Personagem Carlos"><h3>Carlos constrói dados confiáveis</h3><p>Sem dados organizados e rastreáveis, dashboards, automações e modelos de IA ficam frágeis. O módulo ensina a preparar dados com método.</p></aside></section>
<section id="apresentacao"><h3>Apresentação</h3><p>O percurso usa o <strong>UnespDataLens-RM</strong> como modelo de referência e estudo de caso transversal. Em vez de aprender comandos isolados, o participante constrói progressivamente um pipeline técnico-operacional: inventário, ingestão, integração, transformação, qualidade, armazenamento analítico, consumo, governança, reprodutibilidade, features e monitoramento.</p><p>Ao concluir, o participante deverá ser capaz de projetar e operar um produto de dados reproduzível, justificar decisões arquiteturais, medir qualidade e desempenho, preservar linhagem e entregar evidências verificáveis de adequação ao uso.</p><h2 class="section-title">1. Organização do módulo</h2><h3>Carga horária total</h3><p>60 horas.</p><p>O módulo foi estruturado para aprendizagem baseada em desempenho: estudar conceitos, implementar, testar, produzir artefatos e demonstrar domínio.</p>{m14_workload_table()}<h3>Estratégia de avaliação</h3><div class="assessment-grid"><div><strong>30%</strong><span>laboratórios e códigos executáveis</span></div><div><strong>25%</strong><span>artefatos técnicos e documentação</span></div><div><strong>20%</strong><span>testes, métricas e evidências</span></div><div><strong>25%</strong><span>projeto integrador UnespDataLens-RM</span></div></div><div class="box warn"><strong>Regra de aprovação por competência:</strong> a média não substitui habilidades essenciais. O projeto final deve executar de ponta a ponta, bloquear dados inválidos, produzir logs e permitir reprodução por outra pessoa.</div></section>
<section id="aderencia-rm"><h2 class="section-title">Aderência ao portal UnespDataLens-RM</h2><p>Foram mapeados os 16 módulos do modelo de referência. Os oito primeiros formam o pipeline principal; metadados, governança, linhagem e reprodutibilidade atuam transversalmente; representações, features e monitoramento ampliam a preparação para IA. Agentes aparecem apenas como extensão e não substituem validações determinísticas.</p>{rm_portal_map()}</section>
{jupyter_engineering}
<section id="glossario"><h2 class="section-title">Glossário interno do módulo</h2>{concept_grid(DE_CONCEPTS)}</section>
{unit("14.1 Fundamentos, ciclo de vida e arquitetura de dados", "Compreender o percurso do dado desde a origem até o uso em relatórios, automações e IA.", "<p>Engenharia de dados não é apenas programação: envolve arquitetura, qualidade, governança, segurança, documentação e operação. As camadas bronze, prata e ouro separam preservação, curadoria e consumo.</p>" + imports_code + sample_data_code + architecture_methods)}
{unit("14.2 Extração e ingestão: CSV, Excel, JSON, API e banco", "Ler dados de diferentes fontes preservando origem, formato e rastreabilidade.", "<p>A extração deve manter uma cópia bruta e registrar data, fonte, responsável e finalidade. Cada formato exige parâmetros e controles próprios.</p>" + ingestion_methods + "<h3>Visão integrada</h3>" + extract_code + "<div class=\"box warn\"><strong>LGPD:</strong> defina finalidade, base legal, minimização, acesso e retenção antes de coletar dados pessoais.</div>")}
{unit("14.3 Validação, schema e qualidade de dados", "Aplicar regras de completude, validade, consistência, unicidade, atualidade e conformidade.", "<p>Validação é a alfândega do pipeline: compara os dados com contratos e regras explícitas antes que erros cheguem a relatórios, automações ou modelos de IA. Ela não corrige tudo automaticamente; produz evidências, classifica registros e encaminha exceções para uma área de quarentena ou revisão humana.</p><div class=\"box tip\"><strong>Ordem recomendada:</strong> conferir estrutura e tipos, avaliar cada dimensão de qualidade, consolidar os resultados e somente depois transformar ou descartar registros.</div>" + validation_methods)}
{unit("14.4 Transformação: limpeza, padronização, tipos e regras de negócio", "Transformar dados brutos em dados consistentes, tipados e interpretáveis.", "<p>Transformar é aplicar regras explícitas e reproduzíveis. Cada transformação precisa informar o que muda, por que muda e como um valor problemático será tratado. Os exemplos abaixo separam as técnicas para que cada decisão possa ser testada e auditada.</p>" + transformation_methods + "<h3>Exemplo integrado</h3><p>Depois de compreender cada técnica isoladamente, elas podem ser reunidas em uma função única. O exemplo mantém uma cópia de entrada, converte tipos, cria indicadores de validade, remove duplicidades e calcula uma regra de negócio.</p>" + transform_code)}
{unit("14.5 Tratamento de ausências, duplicidades, normalização e outliers", "Aplicar técnicas de pré-processamento sem distorcer a realidade dos dados.", "<p>Nem todo valor ausente deve ser preenchido; nem todo registro repetido representa uma duplicata; e nem todo outlier é erro. A escolha depende da finalidade, do significado da coluna e do impacto sobre grupos e indicadores. Registre a técnica, os parâmetros calculados e quantas linhas foram afetadas.</p><div class=\"box warn\"><strong>Evite vazamento de dados:</strong> em projetos de IA, média, mediana, limites, escalas e categorias devem ser aprendidos somente no conjunto de treino e depois reaplicados aos conjuntos de validação e teste.</div>" + preprocessing_methods)}
{unit("14.6 Integração de bases, merge, join, concat, groupby e indicadores", "Combinar fontes, criar indicadores e gerar produtos de dados.", "<p>A integração exige atenção às chaves, cardinalidade e granularidade. Um erro pode multiplicar linhas ou perder registros.</p>" + integration_methods + "<h3>Exemplo integrado</h3>" + merge_code)}
{unit("14.7 Carga e armazenamento: CSV, Excel, Parquet, SQLite, DuckDB, data lake e warehouse", "Projetar, implementar e avaliar armazenamento analítico adequado ao consumo, à escala e à governança.", "<p>No UnespDataLens-RM, armazenar não significa apenas salvar um arquivo. Significa transformar datasets validados em ativos analíticos persistidos, localizáveis, consultáveis, versionados, seguros e reprocessáveis.</p><div class=\"table-wrap\"><table class=\"table\"><tr><th>Decisão</th><th>Pergunta de projeto</th><th>Evidência esperada</th></tr><tr><td>Arquitetura</td><td>Arquivo, banco, warehouse, lake ou lakehouse?</td><td>Matriz de requisitos e justificativa.</td></tr><tr><td>Zonas</td><td>Quando um ativo avança de bruto para tratado e consumo?</td><td>Critérios de entrada, saída e retenção.</td></tr><tr><td>Modelo lógico</td><td>Qual é a granularidade e como fatos e dimensões se relacionam?</td><td>Schema e testes de cardinalidade.</td></tr><tr><td>Desempenho</td><td>Quais consultas precisam ser rápidas?</td><td>Benchmark reproduzível.</td></tr><tr><td>Reprocessamento</td><td>É possível reconstruir uma versão anterior?</td><td>Snapshot, hash, manifesto e linhagem.</td></tr><tr><td>Segurança</td><td>Quem acessa qual detalhe e para qual finalidade?</td><td>Matriz de acesso e dataset minimizado.</td></tr></table></div>" + storage_methods + "<h3>Carga combinada</h3>" + load_code)}
{unit("14.8 Logs, auditoria, linhagem, catálogo e governança", "Registrar execuções, decisões, origem, transformações e responsáveis.", "<p>Um pipeline sem registros é uma caixa-preta. Logs operacionais, auditoria, linhagem e catálogo respondem perguntas diferentes e complementares.</p>" + governance_methods + "<h3>Configuração básica de logging</h3>" + log_code)}
{unit("14.9 Representações analíticas, feature engineering e preparação para IA", "Construir representações e atributos adequados à finalidade analítica, evitando vazamento e vieses.", "<p>A unidade de análise, a janela temporal e a disponibilidade real de cada atributo devem ser definidas antes da modelagem. Features precisam de fórmula, origem, versão, responsável e teste de qualidade. Somente depois são aplicadas técnicas de exploração, redução, treino e avaliação.</p>" + modeling_methods + "<div class=\"box warn\"><strong>Cuidado:</strong> o exemplo é didático; sistemas reais exigem métricas adequadas, explicabilidade, governança e autorização de uso.</div>")}
{unit("14.10 Pipeline ETL completo em Python", "Integrar todas as etapas em uma função reprodutível e documentada.", "<p>O pipeline completo deve ser executável, versionado e explicado. O código abaixo resume extração, validação, transformação, carga e log em uma estrutura única.</p>" + full_pipeline_code + "<div class=\"box lab\"><strong>Entrega:</strong> pasta com dados fictícios, script ETL, arquivo de log, base curada, indicadores, dicionário de dados e relatório com limitações.</div>")}
"""
    return html_shell(14, "Engenharia de Dados para Inteligência Artificial", "Caderno aprofundado de engenharia de dados com ETL/ELT, qualidade, transformação, armazenamento, governança, mineração de dados e códigos Python aplicados.", "#00796B", "#E8F7F4", body)


def update_css() -> None:
    path = ROOT / "assets" / "css" / "style.css"
    text = path.read_text(encoding="utf-8")
    add = """

/* M13/M14 aprofundados */
.concept-mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin:18px 0}
.concept-mini-card{border:1px solid var(--border);border-left:5px solid var(--module-color);border-radius:14px;background:#fff;padding:14px 16px;box-shadow:var(--shadow)}
.concept-mini-card h3{margin:0 0 6px!important;font-size:18px!important}
.concept-mini-card p{margin:0;font-size:15px!important;color:#425362}
.unit-objective{padding:12px 14px;border-left:5px solid var(--module-color);background:var(--module-soft);border-radius:12px}
.code-block{background:#0F172A;color:#E2E8F0;padding:16px;border-radius:14px;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:1.5}
.code-block code{font-family:Consolas,'Courier New',monospace}
"""
    if "/* M13/M14 aprofundados */" not in text:
        text += add
    technique_css = """

/* Blocos de técnicas do Módulo 14 */
.technique-card{margin:18px 0;padding:18px;border:1px solid var(--border);border-radius:14px;background:#fff;box-shadow:var(--shadow)}
.technique-card h3{margin-top:0!important;color:var(--module-color)}
.technique-card p{margin-bottom:12px}
"""
    if "/* Blocos de técnicas do Módulo 14 */" not in text:
        text += technique_css
    learning_css = """

/* Contratos de aprendizagem do Módulo 14 */
.unit-learning-contract{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
.unit-learning-contract>div,.assessment-grid>div{display:flex;flex-direction:column;gap:4px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--module-soft)}
.unit-learning-contract strong,.assessment-grid strong{color:var(--module-color);font-size:18px}
.mastery-list{border-left:5px solid var(--module-color);padding:14px 14px 14px 34px;background:#F8FAFC;border-radius:12px}
.assessment-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0}
"""
    if "/* Contratos de aprendizagem do Módulo 14 */" not in text:
        text += learning_css
    text = re.sub(r'20260713-m13-m14(?!-deep)', CSS_VERSION, text)
    write(path, text)


def validate() -> None:
    for rel in ["modulos/m13.html", "modulos/m14.html", "assets/css/style.css"]:
        t = (ROOT / rel).read_text(encoding="utf-8")
        if "Ã" in t or "�" in t:
            raise SystemExit(f"Possível mojibake em {rel}")
    print("M13/M14 aprofundados com sucesso")


def main() -> None:
    write(ROOT / "modulos" / "m13.html", build_m13())
    write(ROOT / "modulos" / "m14.html", build_m14())
    update_css()
    validate()


if __name__ == "__main__":
    main()
