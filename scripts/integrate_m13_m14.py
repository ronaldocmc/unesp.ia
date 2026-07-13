from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_VERSION = "20260713-m13-m14"

NAV_ROOT = (
    '<a href="index.html">Início</a><a href="inscricoes.html">Inscrições</a>'
    '<a href="modulos.html">Módulos</a><a href="trilhas.html">Trilhas</a>'
    '<a href="conceitos.html">Conceitos</a><a href="ferramentas.html">Ferramentas</a>'
    '<a href="laboratorios.html">Laboratórios</a><a href="materiais.html">Materiais</a>'
    '<a href="personagens.html">Personagens</a><a href="equipe.html">Equipe</a><a href="mapa-conhecimento.html">Mapa</a>'
)
NAV_UP = NAV_ROOT.replace('href="', 'href="../')

FOOTER = (
    '<footer class="footer"><span class="footer-primary">unesp.IA - Inteligência Artificial para Todos | '
    'Projeto de Extensão Universitária | Coleção Editorial</span>'
    '<span class="footer-unit">Faculdade de Ciências e Tecnologia de Presidente Prudente - FCT/UNESP</span>'
    '<span class="footer-institution">Departamento de Matemática e Computação</span></footer>'
)


def e(text: str) -> str:
    return html.escape(text, quote=True)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def set_css(text: str, prefix: str) -> str:
    return re.sub(
        r'href="(?:\.\./|\.\./\.\./)?assets/css/style\.css\?v=[^"]+"',
        f'href="{prefix}assets/css/style.css?v={CSS_VERSION}"',
        text,
    )


def topbar(prefix: str) -> str:
    nav = NAV_UP if prefix else NAV_ROOT
    return (
        f'<div class="topbar"><a class="brand" href="{prefix}index.html">'
        f'<img class="brand-logo" src="{prefix}assets/img/logo-unesp-ia-portal.jpg" alt="unesp.IA">'
        f'<small>Coleção Editorial | Portal Didático dos Participantes</small></a><div class="nav">{nav}</div></div>'
    )


def pill_links(items: list[tuple[str, str]]) -> str:
    return "".join(f'<a class="pill" href="{href}">{label}</a>' for label, href in items)


def module_card(num: int, title: str, units: int, href: str) -> str:
    return (
        f'<div class="module-card m{num}" data-search="Módulo {num} - {e(title)}">'
        f'<h3><span class="num">{num}</span>{e(title)}</h3>'
        f'<p>{units} unidades. <a href="{href}">Acessar módulo</a></p></div>'
    )


def module_visual_svg(num: int, title: str, color: str, items: list[str]) -> str:
    cards = []
    x_positions = [40, 315, 590, 865]
    for i, item in enumerate(items[:4], 1):
        x = x_positions[i - 1]
        cards.append(
            f'<rect x="{x}" y="210" width="235" height="155" rx="18" fill="#fff" stroke="#CFE2EF"/>'
            f'<circle cx="{x+34}" cy="245" r="18" fill="{color}"/>'
            f'<text x="{x+34}" y="251" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="#fff">{i}</text>'
            f'<text x="{x+66}" y="246" font-family="Arial" font-size="18" font-weight="700" fill="#003B71">{e(item)}</text>'
            f'<path d="M{x+42} 306 H{x+195}" stroke="{color}" stroke-width="7" stroke-linecap="round"/>'
            f'<path d="M{x+42} 330 H{x+150}" stroke="#9BC6DB" stroke-width="7" stroke-linecap="round"/>'
        )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1140 430" role="img">'
        f'<title>Módulo {num}: {e(title)}</title>'
        '<rect width="1140" height="430" rx="28" fill="#F4FAFD"/>'
        f'<rect x="28" y="28" width="1084" height="142" rx="24" fill="#fff" stroke="#CFE2EF"/>'
        f'<circle cx="100" cy="99" r="48" fill="{color}"/>'
        f'<text x="100" y="114" text-anchor="middle" font-family="Arial" font-size="42" font-weight="800" fill="#fff">{num}</text>'
        f'<text x="170" y="86" font-family="Arial" font-size="34" font-weight="800" fill="#003B71">Módulo {num}</text>'
        f'<text x="170" y="123" font-family="Arial" font-size="25" font-weight="700" fill="{color}">{e(title)}</text>'
        + "".join(cards)
        +
        f'<path d="M92 392 H1048" stroke="{color}" stroke-width="12" stroke-linecap="round"/>'
        '<text x="570" y="405" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#003B71">aprenda • pratique • documente • aplique com responsabilidade</text>'
        '</svg>'
    )


def icon_svg(label: str, color: str) -> str:
    short = "".join([p[0] for p in re.sub(r"[^A-Za-z0-9 ]", " ", label).split()[:2]]).upper()[:3]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
        f'<rect x="10" y="10" width="108" height="108" rx="26" fill="{color}"/>'
        '<circle cx="94" cy="34" r="12" fill="#fff" opacity=".26"/>'
        '<path d="M30 82 C44 52 64 42 98 46" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".92"/>'
        f'<text x="64" y="77" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="31" font-weight="800" fill="#fff">{short}</text>'
        '</svg>'
    )


def lab(title: str, steps: list[str]) -> str:
    return (
        '<div class="n8n-lab-guide"><p><strong>Roteiro de prática:</strong> '
        f'{e(title)}</p><ol class="steps">'
        + "".join(f"<li>{step}</li>" for step in steps)
        + "</ol></div>"
    )


def module_page(num: int, title: str, subtitle: str, color: str, soft: str, units: list[dict], tools: list[tuple[str, str]], concepts: list[tuple[str, str]], competencies: list[str], visual_items: list[str]) -> str:
    mini = "".join(f'<a href="#u{num}{i}">Unidade {num}.{i}</a>' for i in range(1, len(units) + 1))
    unit_html = []
    for i, u in enumerate(units, 1):
        unit_html.append(
            f'<section id="u{num}{i}">'
            f'<h2 class="unit-title"><span class="unit-num">{num}.{i}</span> {e(u["title"])}</h2>'
            f'<h3>Objetivo da unidade</h3><p>{u["objective"]}</p>'
            f'<h3>Conceitos trabalhados</h3><div class="related-strip">{pill_links(u["concepts"])}</div>'
            f'<h3>Exemplo aplicado</h3><div class="box practice">{u["example"]}</div>'
            f'<h3>Roteiro de laboratório</h3>{lab(u["lab_title"], u["steps"])}'
            f'<h3>Produto da unidade</h3><p>{u["product"]}</p>'
            f'<h3>Evidência de aprendizagem</h3><p>{u["evidence"]}</p>'
            f'</section>'
        )
    return (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>Módulo {num} – {e(title)} • unesp.IA</title>'
        f'<link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}"><script src="../assets/js/search.js"></script>'
        f'<style>.module-full.module-m{num}' + f'{{--module-color:{color};--module-soft:{soft}}}</style>'
        '</head><body>'
        + topbar("../")
        + f'<main><div class="container content module-full module-m{num}" id="top">'
        f'<div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../modulos.html">Módulos</a> / Módulo {num}</div>'
        f'<div class="hero"><span class="badge">M{num}</span><h1>{e(title)}</h1><p>{e(subtitle)}</p></div>'
        f'<div class="module-actions">{pill_links([("Conceitos","../conceitos.html"),("Ferramentas","../ferramentas.html"),("Trilhas","../trilhas.html"),("Laboratórios","../laboratorios.html")])}</div>'
        f'<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3><div class="related-strip">{pill_links(tools)}</div></section>'
        f'<div class="mini-toc"><strong>Unidades e seções deste módulo</strong><a href="#apresentacao">Apresentação</a><a href="#competencias">Competências</a><a href="#conceitos">Conceitos centrais</a>{mini}<a href="#projeto-final">Projeto integrador</a></div>'
        f'<section class="module-visual"><figure><img src="../assets/img/modulos/m{num}-visual.svg" alt="Mapa visual do Módulo {num}: {e(title)}"><figcaption>Visão geral do percurso: conceitos, ferramentas, práticas e produto final.</figcaption></figure><aside class="character-guide"><img src="../assets/img/personagens/joao.png" alt="Personagem João"><h3>Aprendizagem mão na massa</h3><p>O módulo combina explicação didática, exemplos guiados, laboratórios e um produto final que pode ser apresentado, revisado e reutilizado.</p></aside></section>'
        f'<section id="apresentacao"><h2 class="section-title">Apresentação do módulo</h2><p>{e(subtitle)} O percurso foi desenhado para participantes que desejam sair do uso pontual de ferramentas e construir competência técnica aplicada, com segurança, documentação e revisão humana.</p></section>'
        f'<section id="competencias"><h2 class="section-title">Competências desenvolvidas</h2><ul class="list">{"".join(f"<li>{e(c)}</li>" for c in competencies)}</ul></section>'
        f'<section id="conceitos"><h2 class="section-title">Conceitos centrais</h2><div class="related-strip">{pill_links(concepts)}</div></section>'
        + "".join(unit_html)
        + f'<section id="projeto-final"><h2 class="section-title">Projeto integrador do Módulo {num}</h2><div class="box lab"><p><strong>Produto final:</strong> {e("um artefato prático documentado, com dados fictícios ou anonimizados, evidências de execução, explicação das decisões tomadas e cuidados éticos.")}</p><p>O participante deve apresentar objetivo, dados usados, ferramentas escolhidas, etapas realizadas, validações, limitações, riscos e próximos passos.</p></div></section>'
        '</div></main><a class="backtop" href="#top">Topo</a>'
        + FOOTER
        + '</body></html>'
    )


M13_CONCEPTS = [
    ("Python", "../conceitos/python.html"),
    ("Ambiente Python", "../conceitos/ambiente-python.html"),
    ("Variáveis", "../conceitos/variavel.html"),
    ("Tipos de dados", "../conceitos/tipos-dados.html"),
    ("Estruturas de dados", "../conceitos/estruturas-dados.html"),
    ("Funções", "../conceitos/funcoes.html"),
    ("Programação orientada a objetos", "../conceitos/poo.html"),
    ("DataFrame", "../conceitos/dataframe.html"),
    ("Bibliotecas Python", "../conceitos/bibliotecas-python.html"),
    ("Visualização de dados", "../conceitos/visualizacao-dados.html"),
]

M14_CONCEPTS = [
    ("Engenharia de Dados", "../conceitos/engenharia-dados.html"),
    ("ETL e ELT", "../conceitos/etl-elt.html"),
    ("Pipeline de dados", "../conceitos/pipeline-dados.html"),
    ("Qualidade de dados", "../conceitos/qualidade-dados.html"),
    ("Data lake", "../conceitos/data-lake.html"),
    ("Data warehouse", "../conceitos/data-warehouse.html"),
    ("Catálogo de dados", "../conceitos/catalogo-dados.html"),
    ("Linhagem de dados", "../conceitos/linhagem-dados.html"),
    ("Mineração de dados", "../conceitos/mineracao-dados.html"),
    ("Pré-processamento", "../conceitos/pre-processamento-dados.html"),
]

M13_TOOLS = [
    ("Python", "../ferramentas/python.html"), ("Anaconda", "../ferramentas/anaconda.html"),
    ("Jupyter", "../ferramentas/jupyter.html"), ("Google Colab", "../ferramentas/google-colab.html"),
    ("VS Code", "../ferramentas/vscode.html"), ("PyCharm", "../ferramentas/pycharm.html"),
    ("Spyder", "../ferramentas/spyder.html"), ("pandas", "../ferramentas/pandas.html"),
    ("NumPy", "../ferramentas/numpy.html"), ("Matplotlib, Seaborn e Plotly", "../ferramentas/matplotlib-seaborn-plotly.html"),
]

M14_TOOLS = [
    ("Python", "../ferramentas/python.html"), ("pandas", "../ferramentas/pandas.html"),
    ("NumPy", "../ferramentas/numpy.html"), ("Jupyter", "../ferramentas/jupyter.html"),
    ("Google Colab", "../ferramentas/google-colab.html"), ("Excel e Google Sheets", "../ferramentas/excel-sheets.html"),
    ("Power BI", "../ferramentas/power-bi.html"), ("Looker Studio", "../ferramentas/looker-studio.html"),
    ("scikit-learn", "../ferramentas/scikit-learn.html"), ("DuckDB", "../ferramentas/duckdb.html"),
]

M13_COMPETENCIES = [
    "escolher e preparar um ambiente Python adequado ao contexto de aprendizagem;",
    "escrever programas simples com sintaxe correta, comentários, variáveis e tipos de dados;",
    "usar operadores, condicionais e laços para resolver problemas verificáveis;",
    "organizar informações com listas, tuplas, dicionários, conjuntos e DataFrames;",
    "criar funções reutilizáveis, importar bibliotecas e documentar entradas e saídas;",
    "ler e escrever arquivos CSV e JSON com tratamento de erros;",
    "compreender classes, objetos e métodos em exemplos aplicados;",
    "usar NumPy e pandas para análise tabular introdutória;",
    "produzir gráficos com interpretação crítica e comunicação responsável;",
    "construir uma miniaplicação Python com dados fictícios ou anonimizados.",
]

M14_COMPETENCIES = [
    "explicar o ciclo de vida dos dados e o papel da engenharia de dados em projetos de IA;",
    "inventariar fontes, formatos, responsáveis, periodicidade e restrições de uso;",
    "criar dicionários de dados, metadados e documentação mínima de bases;",
    "desenhar e implementar pipelines ETL/ELT com validação e registro de execução;",
    "aplicar critérios de qualidade, limpeza, tratamento de ausências, duplicidades e outliers;",
    "diferenciar data lake, data warehouse, lakehouse e camadas bronze, prata e ouro;",
    "processar dados com Python, DataFrames e consultas para gerar indicadores;",
    "aplicar LGPD, governança, catálogo, permissões e linhagem de dados;",
    "realizar análise exploratória e mineração de dados com cautela metodológica;",
    "entregar um pipeline de dados documentado, rastreável e preparado para análise ou IA.",
]


def unit(title, objective, concepts, example, lab_title, steps, product, evidence):
    return dict(title=title, objective=objective, concepts=concepts, example=example, lab_title=lab_title, steps=steps, product=product, evidence=evidence)


M13_UNITS = [
    unit("Ferramentas disponíveis, instalação e uso inicial", "Conhecer as formas de usar Python localmente ou na nuvem e escolher o ambiente adequado para cada perfil.", M13_CONCEPTS[:2], "Comparar Python.org, Anaconda, Jupyter, Google Colab, VS Code, PyCharm e Spyder para decidir onde executar os primeiros códigos.", "Preparar o primeiro ambiente de estudo", ["Escolha entre Google Colab, Jupyter local ou Anaconda conforme o contexto da turma.", "Crie um notebook ou arquivo chamado primeiro_programa.py.", "Execute um comando print e registre a versão do Python.", "Documente vantagens, limites e cuidados do ambiente escolhido."], "Ambiente escolhido e testado.", "O participante executa um primeiro código e explica onde ele roda."),
    unit("Sintaxe, comentários, variáveis e tipos de dados", "Compreender como Python organiza instruções, comentários, nomes, valores e tipos básicos.", M13_CONCEPTS[2:4], "Criar variáveis para nome, idade, módulo, presença e nota, comparando texto, número inteiro, número decimal e valor lógico.", "Criar um cadastro simples em Python", ["Crie variáveis com dados fictícios de um participante.", "Use type() para identificar cada tipo.", "Inclua comentários explicando o objetivo do código.", "Imprima uma mensagem formatada com os dados."], "Script introdutório comentado.", "O participante diferencia sintaxe, comentário, variável e tipo de dado."),
    unit("Operadores, expressões e controle de fluxo", "Usar operadores e estruturas condicionais para tomar decisões simples em programas.", [("Algoritmo", "../conceitos/algoritmo.html"), ("Tipos de dados", "../conceitos/tipos-dados.html")], "Verificar se um participante atingiu presença mínima ou se um campo obrigatório está vazio.", "Validar regras de presença", ["Crie variáveis para carga horária, presenças e percentual mínimo.", "Calcule a frequência.", "Use if, elif e else para classificar como aprovado, atenção ou pendente.", "Teste pelo menos três cenários."], "Validador simples de presença.", "O participante transforma uma regra em código verificável."),
    unit("Estruturas de dados: listas, tuplas, dicionários e conjuntos", "Organizar coleções de informações e escolher a estrutura adequada para cada situação.", [("Estruturas de dados", "../conceitos/estruturas-dados.html"), ("Dados", "../conceitos/dados.html")], "Representar uma turma com lista de nomes, dicionário de participantes e conjunto de módulos inscritos.", "Modelar uma pequena turma", ["Crie uma lista de participantes.", "Crie dicionários com nome, e-mail, perfil e módulo.", "Use um conjunto para identificar perfis únicos.", "Percorra os dados com for e gere um resumo."], "Estrutura de turma em Python.", "O participante seleciona a estrutura de dados conforme o problema."),
    unit("Funções, parâmetros e bibliotecas", "Criar funções reutilizáveis e importar bibliotecas para organizar soluções.", [("Funções", "../conceitos/funcoes.html"), ("Bibliotecas Python", "../conceitos/bibliotecas-python.html")], "Criar uma função para padronizar nomes e outra para calcular frequência.", "Transformar regras em funções", ["Escreva uma função padronizar_nome().", "Escreva uma função calcular_frequencia().", "Teste as funções com dados diferentes.", "Explique entrada, processamento e saída de cada função."], "Arquivo com funções documentadas.", "O participante cria funções com parâmetros e retorno."),
    unit("Manipulação de arquivos, CSV, JSON e exceções", "Ler, escrever e tratar arquivos de forma segura, compreendendo erros comuns.", [("JSON", "../conceitos/json.html"), ("Dados", "../conceitos/dados.html")], "Ler uma lista fictícia em CSV e salvar um resumo em JSON.", "Trabalhar com arquivos fictícios", ["Crie um CSV pequeno com nome, módulo e presença.", "Leia o arquivo com Python.", "Trate erros de arquivo inexistente com try/except.", "Salve um resumo em JSON."], "Leitor de CSV com tratamento de erro.", "O participante manipula arquivos sem expor dados reais."),
    unit("Programação orientada a objetos em Python", "Compreender classes, objetos, atributos e métodos em exemplos simples.", [("Programação orientada a objetos", "../conceitos/poo.html"), ("Skill", "../conceitos/skill.html")], "Criar uma classe Participante com métodos para calcular frequência e gerar mensagem.", "Modelar um participante como objeto", ["Defina uma classe Participante.", "Crie atributos nome, e-mail, módulo e presença.", "Implemente um método situacao().", "Crie dois objetos e compare resultados."], "Classe simples com objetos instanciados.", "O participante entende objeto como representação de uma entidade do problema."),
    unit("Python para dados: NumPy, pandas e DataFrames", "Usar bibliotecas essenciais para organizar tabelas, filtrar dados e calcular indicadores.", [("DataFrame", "../conceitos/dataframe.html"), ("Bibliotecas Python", "../conceitos/bibliotecas-python.html")], "Carregar inscrições fictícias em um DataFrame e calcular total por perfil.", "Analisar inscrições com pandas", ["Importe pandas.", "Crie ou carregue um DataFrame com dados fictícios.", "Filtre por perfil e módulo.", "Calcule contagens e médias simples."], "Notebook com análise tabular.", "O participante manipula DataFrames e interpreta resultados."),
    unit("Visualização de dados e análise exploratória", "Criar gráficos simples e interpretar padrões iniciais com responsabilidade.", [("Visualização de dados", "../conceitos/visualizacao-dados.html"), ("Análise exploratória", "../conceitos/analise-exploratoria.html")], "Gerar gráfico de barras com inscritos por perfil e gráfico de linha com evolução por semana.", "Criar visualizações didáticas", ["Prepare dados fictícios.", "Crie um gráfico com Matplotlib ou Seaborn.", "Adicione título, rótulos e legenda.", "Escreva uma interpretação curta e honesta do gráfico."], "Dois gráficos com interpretação.", "O participante diferencia visualizar dados de tirar conclusões precipitadas."),
    unit("Projeto aplicado: miniaplicação em Python", "Integrar variáveis, estruturas, funções, arquivos e visualização em uma solução simples.", M13_CONCEPTS, "Criar um relatório de turma com leitura de CSV, validação, cálculo de presença e gráfico final.", "Construir o projeto final do módulo", ["Defina o problema e os dados fictícios.", "Leia ou crie a base.", "Implemente funções de validação.", "Gere tabela resumida, gráfico e relatório textual.", "Liste limitações, riscos e próximos passos."], "Miniaplicação documentada em notebook ou script.", "O participante apresenta uma solução executável e explica suas decisões."),
]

M14_UNITS = [
    unit("Fundamentos de engenharia de dados e ciclo de vida", "Compreender o papel da engenharia de dados na coleta, organização, qualidade e disponibilização de dados para análise e IA.", M14_CONCEPTS[:3], "Mapear o caminho de uma inscrição: formulário, planilha, validação, base curada, relatório e uso em análise.", "Desenhar o ciclo de vida de um dado", ["Escolha um processo simples.", "Liste origem, formato, responsáveis e destino dos dados.", "Identifique riscos de qualidade e privacidade.", "Desenhe o fluxo de ponta a ponta."], "Mapa do ciclo de vida de dados.", "O participante diferencia dado bruto, dado tratado e produto de dados."),
    unit("Fontes de dados, coleta e ingestão", "Identificar fontes internas, externas, APIs e arquivos, definindo estratégias responsáveis de coleta.", [("API", "../conceitos/api.html"), ("Dados", "../conceitos/dados.html"), ("ETL e ELT", "../conceitos/etl-elt.html")], "Combinar um CSV fictício de inscrições com uma planilha de presença e um formulário de avaliação.", "Planejar a ingestão de dados", ["Liste fontes e formatos.", "Defina periodicidade de atualização.", "Registre permissões e finalidade.", "Monte uma tabela de inventário de fontes."], "Inventário inicial de fontes.", "O participante reconhece origem, formato, frequência e restrições de uso."),
    unit("Formatos, modelagem e metadados", "Compreender CSV, JSON, planilhas, tabelas, chaves, dicionário de dados e metadados.", [("JSON", "../conceitos/json.html"), ("Catálogo de dados", "../conceitos/catalogo-dados.html")], "Criar um dicionário para campos como nome, e-mail, módulo, perfil, presença e status.", "Criar dicionário de dados", ["Liste campos de uma base fictícia.", "Defina tipo, descrição, obrigatoriedade e exemplo.", "Indique se há dado pessoal.", "Revise nomes de colunas para ficarem consistentes."], "Dicionário de dados.", "O participante documenta campos antes de processá-los."),
    unit("ETL, ELT e pipelines de dados", "Construir uma sequência de extração, transformação, carga, validação e registro de execução.", [("ETL e ELT", "../conceitos/etl-elt.html"), ("Pipeline de dados", "../conceitos/pipeline-dados.html")], "Ler dados brutos, padronizar nomes, validar e-mails, remover duplicidades e salvar base tratada.", "Implementar um pipeline simples", ["Crie uma base bruta fictícia.", "Defina regras de transformação.", "Aplique validações e registre pendências.", "Salve a base tratada e um log da execução."], "Pipeline ETL simples.", "O participante explica cada etapa do pipeline e seus critérios."),
    unit("Qualidade de dados, limpeza e outliers", "Aplicar critérios de completude, consistência, unicidade, validade e tratamento de valores discrepantes.", [("Qualidade de dados", "../conceitos/qualidade-dados.html"), ("Pré-processamento", "../conceitos/pre-processamento-dados.html")], "Detectar nomes vazios, e-mails inválidos, duplicidades e presenças fora de intervalo.", "Criar checklist de qualidade", ["Defina regras de qualidade.", "Marque registros válidos e pendentes.", "Trate valores ausentes e duplicados.", "Documente o que foi corrigido e o que exige revisão humana."], "Relatório de qualidade de dados.", "O participante identifica problemas de dados antes de gerar análise."),
    unit("Armazenamento: data lake, data warehouse e lakehouse", "Diferenciar formas de armazenar dados brutos, tratados e analíticos.", [("Data lake", "../conceitos/data-lake.html"), ("Data warehouse", "../conceitos/data-warehouse.html")], "Separar arquivos brutos de presença, tabelas tratadas e indicadores prontos para relatório.", "Organizar camadas de dados", ["Crie uma estrutura conceitual bronze, prata e ouro.", "Defina o que entra em cada camada.", "Relacione com governança e acesso.", "Explique quando usar planilha, banco, data lake ou warehouse."], "Mapa de camadas de dados.", "O participante escolhe armazenamento conforme finalidade e maturidade."),
    unit("Processamento com Python, SQL e DataFrames", "Usar pandas, consultas e operações tabulares para transformar dados em indicadores.", [("DataFrame", "../conceitos/dataframe.html"), ("Python", "../conceitos/python.html")], "Agrupar inscrições por perfil, calcular taxa de presença e gerar tabela de indicadores.", "Transformar dados em indicadores", ["Carregue uma base fictícia em pandas.", "Selecione colunas necessárias.", "Agrupe e calcule indicadores.", "Exporte uma tabela final para CSV."], "Tabela de indicadores.", "O participante transforma dados em informação verificável."),
    unit("Governança, LGPD, catálogo e linhagem", "Aplicar princípios de finalidade, acesso, documentação, rastreabilidade e proteção de dados.", [("LGPD", "../conceitos/lgpd.html"), ("Linhagem de dados", "../conceitos/linhagem-dados.html"), ("Governança de IA", "../conceitos/governanca-ia.html")], "Documentar quem pode acessar uma base, por que ela existe e quais transformações foram realizadas.", "Criar registro de governança", ["Liste dados pessoais e sensíveis.", "Defina finalidade e prazo de uso.", "Crie um registro de linhagem simples.", "Indique revisão humana e responsáveis."], "Ficha de governança de dados.", "O participante conecta engenharia de dados a responsabilidade institucional."),
    unit("Mineração de dados, análise exploratória e modelos", "Preparar dados para análise, mineração de dados, aprendizado de máquina e avaliação crítica.", [("Mineração de dados", "../conceitos/mineracao-dados.html"), ("Machine Learning", "../conceitos/machine-learning.html"), ("Análise exploratória", "../conceitos/analise-exploratoria.html")], "Investigar padrões fictícios de participação e levantar hipóteses sem concluir além do que os dados permitem.", "Explorar dados com cautela", ["Calcule estatísticas descritivas.", "Crie gráficos exploratórios.", "Levante hipóteses e limitações.", "Indique quais dados adicionais seriam necessários."], "Relatório exploratório.", "O participante diferencia exploração, hipótese e conclusão."),
    unit("Projeto final: pipeline de dados para IA", "Integrar ingestão, qualidade, transformação, armazenamento, visualização e documentação em um produto final.", M14_CONCEPTS, "Criar uma base curada de inscrições fictícias pronta para dashboard, automação ou modelo de IA.", "Construir pipeline final documentado", ["Defina objetivo e fontes.", "Implemente ou desenhe ingestão e transformação.", "Aplique regras de qualidade.", "Gere indicadores e visualização.", "Documente governança, limitações e próximos passos."], "Pipeline de dados completo com relatório.", "O participante apresenta uma solução de engenharia de dados com rastreabilidade."),
]


CONCEPTS = [
    ("python", "Python", "Linguagem de programação de sintaxe simples e ampla adoção em dados, automação, IA, ciência e desenvolvimento de aplicações.", [13, 14], ["python", "jupyter", "google-colab"]),
    ("ambiente-python", "Ambiente Python", "Conjunto de ferramentas, interpretador, bibliotecas e configurações usados para escrever, executar e organizar códigos Python.", [13], ["python", "anaconda", "jupyter", "vscode"]),
    ("variavel", "Variável", "Nome usado para guardar um valor em um programa, como texto, número, lista ou resultado de cálculo.", [13], ["python"]),
    ("tipos-dados", "Tipos de dados em Python", "Categorias de valores, como string, inteiro, decimal, booleano, lista, dicionário e DataFrame.", [13], ["python"]),
    ("estruturas-dados", "Estruturas de dados", "Formas de organizar coleções de informações, como listas, tuplas, dicionários e conjuntos.", [13], ["python"]),
    ("funcoes", "Funções em Python", "Blocos reutilizáveis de código que recebem entradas, executam uma tarefa e podem retornar resultados.", [13], ["python", "vscode"]),
    ("poo", "Programação orientada a objetos", "Forma de organizar código em classes e objetos, aproximando entidades do problema de estruturas computacionais.", [13], ["python", "pycharm"]),
    ("dataframe", "DataFrame", "Estrutura tabular usada em bibliotecas como pandas para organizar linhas, colunas, filtros e cálculos.", [13, 14], ["pandas", "jupyter"]),
    ("bibliotecas-python", "Bibliotecas Python", "Pacotes reutilizáveis que adicionam funcionalidades ao Python, como pandas, NumPy, Matplotlib e scikit-learn.", [13, 14], ["pandas", "numpy", "scikit-learn"]),
    ("visualizacao-dados", "Visualização de dados", "Uso de gráficos, tabelas e painéis para comunicar padrões, tendências e comparações com clareza.", [13, 14], ["matplotlib-seaborn-plotly", "power-bi", "looker-studio"]),
    ("analise-exploratoria", "Análise exploratória de dados", "Investigação inicial de dados para compreender distribuição, padrões, inconsistências, hipóteses e limites.", [13, 14], ["pandas", "jupyter", "julius"]),
    ("engenharia-dados", "Engenharia de Dados", "Área responsável por coletar, organizar, transformar, validar, armazenar e disponibilizar dados para análise, automação e IA.", [14], ["python", "duckdb", "power-bi"]),
    ("etl-elt", "ETL e ELT", "Processos de extração, transformação e carga de dados, com variações sobre quando a transformação acontece.", [14], ["pandas", "duckdb", "n8n"]),
    ("pipeline-dados", "Pipeline de dados", "Sequência organizada de etapas para mover, validar, transformar, armazenar e monitorar dados.", [14, 12], ["n8n", "pandas", "duckdb"]),
    ("qualidade-dados", "Qualidade de dados", "Conjunto de critérios como completude, consistência, unicidade, validade e atualidade dos dados.", [14], ["pandas", "excel-sheets"]),
    ("data-lake", "Data lake", "Repositório para armazenar dados brutos ou semi-estruturados em grande volume, antes de curadoria analítica.", [14], ["duckdb"]),
    ("data-warehouse", "Data warehouse", "Ambiente organizado para dados tratados, integrados e prontos para relatórios, indicadores e análises.", [14], ["power-bi", "looker-studio", "duckdb"]),
    ("catalogo-dados", "Catálogo de dados", "Inventário que descreve bases, campos, responsáveis, origem, finalidade, sensibilidade e formas de acesso.", [14], ["excel-sheets"]),
    ("linhagem-dados", "Linhagem de dados", "Registro da origem, transformações, movimentações e usos de um dado ao longo do tempo.", [14], ["n8n", "pandas"]),
    ("mineracao-dados", "Mineração de dados", "Processo de descobrir padrões, relações e modelos em conjuntos de dados, com preparação e avaliação crítica.", [14], ["pandas", "scikit-learn"]),
    ("pre-processamento-dados", "Pré-processamento de dados", "Etapa de limpeza, transformação, normalização, tratamento de ausências e preparação para análise ou modelos.", [14], ["pandas", "numpy", "scikit-learn"]),
]


TOOLS = [
    ("python", "Python", "Linguagem", "Linguagem de programação usada em automação, dados, IA, ciência, ensino e desenvolvimento de aplicações.", "https://www.python.org/downloads/", [13, 14], ["Criar scripts e notebooks", "Automatizar tarefas simples", "Analisar dados e preparar bases"], "Use ambientes separados e não execute código desconhecido sem revisão."),
    ("anaconda", "Anaconda", "Distribuição Python", "Plataforma para instalar Python, gerenciar ambientes e usar pacotes voltados à ciência de dados e aprendizado de máquina.", "https://www.anaconda.com/download", [13], ["Instalar ambiente completo", "Gerenciar pacotes", "Abrir Jupyter e Spyder"], "Verifique licenciamento, espaço em disco e políticas institucionais antes de instalar."),
    ("jupyter", "Jupyter Notebook e JupyterLab", "Notebook", "Ambiente interativo para combinar código, texto, tabelas, gráficos e explicações em um mesmo documento.", "https://jupyter.org/", [13, 14], ["Criar aulas práticas", "Documentar experimentos", "Compartilhar análises"], "Revise dados embutidos no notebook antes de compartilhar."),
    ("vscode", "Visual Studio Code", "Editor de código", "Editor leve e extensível para desenvolver em Python, notebooks, scripts, controle de versão e projetos.", "https://code.visualstudio.com/docs", [13], ["Escrever scripts", "Usar extensões Python", "Organizar projetos"], "Instale extensões de fontes confiáveis e revise configurações."),
    ("pycharm", "PyCharm Community", "IDE Python", "Ambiente de desenvolvimento integrado para Python com recursos de edição, depuração, testes e organização de projetos.", "https://www.jetbrains.com/pt-br/pycharm/", [13], ["Desenvolver projetos maiores", "Depurar código", "Organizar classes e módulos"], "Pode ser mais pesado para computadores simples; escolha conforme o perfil da turma."),
    ("spyder", "Spyder", "IDE científica", "Ambiente científico gratuito para Python, voltado a análise, depuração, variáveis e uso por cientistas, engenheiros e analistas.", "https://www.spyder-ide.org/", [13], ["Explorar variáveis", "Testar scripts científicos", "Acompanhar resultados"], "Prefira bases fictícias ou anonimizadas em atividades de aula."),
    ("pandas", "pandas", "Biblioteca Python", "Biblioteca para manipular DataFrames, ler arquivos, filtrar tabelas, agrupar dados e preparar análises.", "https://pandas.pydata.org/", [13, 14], ["Ler CSV e Excel", "Limpar dados", "Calcular indicadores"], "Documente transformações para manter rastreabilidade."),
    ("numpy", "NumPy", "Biblioteca Python", "Biblioteca para arrays, operações numéricas, vetorização e base de muitas ferramentas científicas em Python.", "https://numpy.org/", [13, 14], ["Operações matemáticas", "Vetorização", "Preparar matrizes"], "Cuidado com tipos, dimensões e interpretação de resultados numéricos."),
    ("matplotlib-seaborn-plotly", "Matplotlib, Seaborn e Plotly", "Visualização", "Bibliotecas para criar gráficos estáticos, estatísticos e interativos em Python.", "https://plotly.com/python/", [13, 14], ["Criar gráficos", "Explorar tendências", "Comunicar indicadores"], "Gráfico bonito não garante conclusão correta; explique limites."),
    ("scikit-learn", "scikit-learn", "Machine Learning", "Biblioteca Python para pré-processamento, classificação, regressão, agrupamento, validação e pipelines de aprendizado de máquina.", "https://scikit-learn.org/stable/", [13, 14], ["Treinar modelos introdutórios", "Comparar métricas", "Criar pipelines de ML"], "Evite modelos com dados sensíveis e sempre avalie vieses e métricas."),
    ("duckdb", "DuckDB", "Banco analítico", "Banco de dados analítico leve para consultar arquivos e tabelas localmente com SQL, útil em projetos de engenharia de dados.", "https://duckdb.org/", [14], ["Consultar CSV/Parquet", "Prototipar data warehouse local", "Combinar SQL e Python"], "Controle versões dos arquivos e evite expor dados pessoais."),
]


def build_module_pages() -> None:
    write(ROOT / "modulos" / "m13.html", module_page(13, "Python: Fundamentos e Aplicações", "Fundamentos de programação em Python, ambientes de desenvolvimento, estruturas de dados, funções, arquivos, orientação a objetos, análise de dados e aplicações práticas.", "#1976D2", "#EAF4FF", M13_UNITS, M13_TOOLS, M13_CONCEPTS, M13_COMPETENCIES, ["Ambiente Python", "Código e lógica", "Dados e gráficos", "Projeto aplicado"]))
    write(ROOT / "modulos" / "m14.html", module_page(14, "Engenharia de Dados para Inteligência Artificial", "Coleta, preparação, qualidade, pipelines, armazenamento, governança e disponibilização de dados para análises, automações e aplicações de IA.", "#00796B", "#E8F7F4", M14_UNITS, M14_TOOLS, M14_CONCEPTS, M14_COMPETENCIES, ["Fontes e ingestão", "ETL/ELT", "Qualidade e governança", "Dados para IA"]))
    write(ROOT / "assets" / "img" / "modulos" / "m13-visual.svg", module_visual_svg(13, "Python: Fundamentos e Aplicações", "#1976D2", ["Ambientes", "Código", "Dados", "Aplicações"]))
    write(ROOT / "assets" / "img" / "modulos" / "m14-visual.svg", module_visual_svg(14, "Engenharia de Dados para IA", "#00796B", ["Fontes", "Pipelines", "Qualidade", "Governança"]))


def concept_page(slug: str, title: str, definition: str, modules: list[int], tools: list[str]) -> str:
    module_pills = "".join(f'<a class="pill" href="../modulos/m{m}.html">M{m}</a>' for m in modules)
    tool_pills = "".join(f'<a class="pill" href="../ferramentas/{t}.html">{e(t.replace("-", " ").title())}</a>' for t in tools)
    related = pill_links([("Dados", "dados.html"), ("Pipeline", "pipeline.html"), ("LGPD", "lgpd.html"), ("Governança", "governanca-ia.html")])
    return (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{e(title)} | unesp.IA</title><link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}"><script src="../assets/js/search.js"></script></head><body>'
        + topbar("../")
        + f'<main><div class="container content" id="top"><div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../conceitos.html">Conceitos</a> / {e(title)}</div>'
        f'<h1>{e(title)}</h1><div class="callout"><b>Definição simples:</b> {e(definition)}</div>'
        '<h2 class="section-title">Explicação didática</h2>'
        f'<p>{e(definition)} No portal unesp.IA, este conceito é trabalhado com exemplos práticos, atividades guiadas, documentação e cuidado com dados pessoais.</p>'
        '<div class="two-col"><div class="callout practice"><h3>Exemplos de aplicação</h3><p><b>Educação:</b> organizar inscrições, presenças, relatórios e materiais didáticos.</p><p><b>Dados:</b> preparar bases, validar campos, gerar gráficos e indicadores.</p><p><b>IA:</b> alimentar automações, modelos e análises com dados confiáveis.</p></div>'
        '<div class="callout warn"><h3>Riscos e cuidados</h3><p>Verifique qualidade, privacidade, finalidade, autorização, revisão humana e documentação das decisões.</p></div></div>'
        f'<h2>Relações</h2><p><b>Módulos relacionados:</b> {module_pills}</p><p><b>Ferramentas relacionadas:</b> {tool_pills}</p><p><b>Conceitos associados:</b> {related}</p>'
        '</div></main><a class="backtop" href="#top">Topo</a>' + FOOTER + '</body></html>'
    )


def build_concepts() -> None:
    for slug, title, definition, modules, tools in CONCEPTS:
        write(ROOT / "conceitos" / f"{slug}.html", concept_page(slug, title, definition, modules, tools))
    cards_root = []
    cards_sub = []
    for slug, title, definition, modules, _tools in CONCEPTS:
        root_pills = "".join(f'<a class="pill" href="modulos/m{m}.html">M{m}</a>' for m in modules)
        sub_pills = "".join(f'<a class="pill" href="../modulos/m{m}.html">M{m}</a>' for m in modules)
        cards_root.append(f'<div class="card" data-search="{e(title)} {e(definition)}"><h3><a href="conceitos/{slug}.html">{e(title)}</a></h3><p>{e(definition)}</p><p>{root_pills}</p></div>')
        cards_sub.append(f'<div class="card" data-search="{e(title)} {e(definition)}"><h3><a href="{slug}.html">{e(title)}</a></h3><p>{e(definition)}</p><p>{sub_pills}</p></div>')
    for path, cards in [(ROOT / "conceitos.html", cards_root), (ROOT / "conceitos" / "index.html", cards_sub)]:
        text = path.read_text(encoding="utf-8")
        for slug, *_ in CONCEPTS:
            text = re.sub(rf'<div class="card"[^>]*>\s*<h3><a href="(?:conceitos/)?{re.escape(slug)}\.html">.*?</div>', '', text, flags=re.S)
        marker = '</div></div></main><a class="backtop"'
        text = text.replace(marker, ''.join(cards) + marker, 1)
        text = set_css(text, "" if path.name == "conceitos.html" else "../")
        write(path, text)


def tool_logo_path(slug: str) -> Path:
    return ROOT / "assets" / "img" / "ferramentas" / f"{slug}.svg"


def tool_page(slug: str, name: str, typ: str, summary: str, site: str, modules: list[int], uses: list[str], caution: str) -> str:
    module_pills = "".join(f'<a class="pill" href="../modulos/m{m}.html">M{m}</a>' for m in modules)
    return (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{e(name)} | unesp.IA</title><link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}"><script src="../assets/js/search.js"></script></head><body>'
        + topbar("../")
        + f'<main><div class="container content" id="top"><div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../ferramentas.html">Ferramentas</a> / {e(name)}</div>'
        f'<section class="tool-page-hero"><img class="tool-logo" src="../assets/img/ferramentas/{slug}.svg" alt="Logo {e(name)}"><div><span class="tool-type">{e(typ)}</span><h1>{e(name)}</h1><p>{e(summary)}</p></div></section>'
        f'<section class="tool-facts"><div class="tool-fact"><strong>Tipo</strong><p>{e(typ)}</p></div><div class="tool-fact"><strong>Site oficial</strong><p><a href="{e(site)}" target="_blank" rel="noopener">{e(site)}</a></p></div><div class="tool-fact"><strong>Entrada</strong><p>Código, dados, arquivos, tabelas, notebooks ou parâmetros de configuração.</p></div><div class="tool-fact"><strong>Saída</strong><p>Resultados executados, tabelas, gráficos, scripts, modelos, relatórios ou bases tratadas.</p></div></section>'
        '<h2>Funcionalidades relacionadas ao curso</h2><ul>' + ''.join(f'<li>{e(u)}</li>' for u in uses) + '</ul>'
        '<h2>Exemplo de atividade</h2><ol><li>Use dados fictícios, execute uma tarefa simples, registre o resultado e escreva uma breve interpretação.</li></ol>'
        f'<h2>Cuidados de uso</h2><div class="callout warn"><p>{e(caution)}</p></div>'
        f'<h2>Relacionamentos</h2><h3>Módulos relacionados</h3><div class="related-strip">{module_pills}</div>'
        '</div></main><a class="backtop" href="#top">Topo</a>' + FOOTER + '</body></html>'
    )


def tool_card_index(slug: str, name: str, typ: str, summary: str, site: str, modules: list[int], uses: list[str], prefix: str, detail_href: str) -> str:
    module_pills = "".join(f'<a class="pill" href="{prefix}modulos/m{m}.html">M{m}</a>' for m in modules)
    return (
        f'<article class="tool-card" id="ferramenta-{slug}" data-search="{e(name)} {e(typ)} {e(summary)}">'
        f'<div class="tool-head"><img class="tool-logo" src="{prefix}assets/img/ferramentas/{slug}.svg" alt="Logo {e(name)}"><div><span class="tool-type">{e(typ)}</span><h3><a href="{detail_href}">{e(name)}</a></h3></div></div>'
        f'<p class="tool-summary">{e(summary)}</p><div class="tool-module-links"><strong>Módulos relacionados</strong><div>{module_pills}</div></div>'
        '<div class="tool-block"><strong>Quando usar</strong><ul>' + ''.join(f'<li>{e(u)}</li>' for u in uses[:3]) + '</ul></div>'
        '<div class="tool-block course-relation"><strong>Relação com o curso</strong><p>Apoia os módulos de Python, dados, análise, automação e preparação responsável de bases para IA.</p></div>'
        f'<div class="tool-actions"><a class="btn-small secondary" href="{detail_href}">Ver ficha completa</a><a class="btn-small" href="{e(site)}" target="_blank" rel="noopener">Site oficial</a></div></article>'
    )


def build_tools() -> None:
    colors = ["#1976D2", "#2E7D32", "#F57C00", "#6A1B9A", "#00796B", "#455A64", "#C2185B", "#0D47A1", "#00838F", "#5D4037", "#1B5E20"]
    cards_root = []
    cards_sub = []
    for idx, tool in enumerate(TOOLS):
        slug, name, typ, summary, site, modules, uses, caution = tool
        write(tool_logo_path(slug), icon_svg(name, colors[idx % len(colors)]))
        write(ROOT / "ferramentas" / f"{slug}.html", tool_page(slug, name, typ, summary, site, modules, uses, caution))
        cards_root.append(tool_card_index(slug, name, typ, summary, site, modules, uses, "", f"ferramentas/{slug}.html"))
        cards_sub.append(tool_card_index(slug, name, typ, summary, site, modules, uses, "../", f"{slug}.html"))
    def section(cards: list[str]) -> str:
        return (
        '<section class="tool-library-section" id="python-engenharia-dados"><h2 class="section-title">Python, ciência e engenharia de dados</h2>'
        '<p class="category-description">Ambientes, linguagens e bibliotecas para programação, análise, visualização, mineração e preparação de dados para IA.</p><div class="tool-grid">'
        + ''.join(cards)
        + '</div></section>'
        )
    for rel, cards, prefix in [("ferramentas.html", cards_root, ""), ("ferramentas/index.html", cards_sub, "../")]:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        text = re.sub(r'<section class="tool-library-section" id="python-engenharia-dados">.*?</section>(?=<section class="tool-library-section" id="automacao-agentes-e-orquestracao">)', '', text, flags=re.S)
        text = text.replace('<a href="#python-engenharia-dados">Python e engenharia de dados</a>', '')
        text = text.replace('<a href="#dados-programacao-e-desenvolvimento">Dados, programação e desenvolvimento</a>', '<a href="#dados-programacao-e-desenvolvimento">Dados, programação e desenvolvimento</a><a href="#python-engenharia-dados">Python e engenharia de dados</a>')
        text = text.replace('<section class="tool-library-section" id="automacao-agentes-e-orquestracao">', section(cards) + '<section class="tool-library-section" id="automacao-agentes-e-orquestracao">', 1)
        text = set_css(text, prefix)
        write(path, text)


def update_module_lists() -> None:
    root_cards = module_card(13, "Python: Fundamentos e Aplicações", 10, "modulos/m13.html") + module_card(14, "Engenharia de Dados para Inteligência Artificial", 10, "modulos/m14.html")
    sub_cards = module_card(13, "Python: Fundamentos e Aplicações", 10, "m13.html") + module_card(14, "Engenharia de Dados para Inteligência Artificial", 10, "m14.html")
    for path, cards in [(ROOT / "modulos.html", root_cards), (ROOT / "modulos" / "index.html", sub_cards)]:
        text = path.read_text(encoding="utf-8")
        text = re.sub(r'<div class="module-card m1".*?</div></div></div></main>', lambda m: m.group(0), text, flags=re.S)
        text = re.sub(r'<div class="module-card m13".*?</div>', '', text, flags=re.S)
        text = re.sub(r'<div class="module-card m14".*?</div>', '', text, flags=re.S)
        text = text.replace('</div></div></main><a class="backtop"', cards + '</div></div></main><a class="backtop"', 1)
        text = set_css(text, "" if path.name == "modulos.html" else "../")
        write(path, text)
    path = ROOT / "index.html"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'<div class="module-card m13".*?</div>', '', text, flags=re.S)
    text = re.sub(r'<div class="module-card m14".*?</div>', '', text, flags=re.S)
    text = text.replace('</div><h2 class="section-title">Materiais da coleção</h2>', root_cards + '</div><h2 class="section-title">Materiais da coleção</h2>', 1)
    write(path, text)


def update_trilhas() -> None:
    path = ROOT / "trilhas.html"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'<div class="card"><h3>Programação, Python e Dados Aplicados</h3>.*?</div>', '', text, flags=re.S)
    text = re.sub(r'<div class="card"><h3>Engenharia de Dados para IA</h3>.*?</div>', '', text, flags=re.S)
    cards = (
        '<div class="card"><h3>Programação, Python e Dados Aplicados</h3><p><b>Público:</b> participantes que desejam programar, analisar dados e criar protótipos aplicados.</p>'
        '<p><b>Módulos:</b> <a class="pill" href="modulos/m1.html">M1</a><a class="pill" href="modulos/m4.html">M4</a><a class="pill" href="modulos/m13.html">M13</a></p><p><b>Carga horária:</b> 60h</p>'
        '<p>Trilha para aprender lógica, Python, notebooks, estruturas de dados, arquivos, DataFrames, gráficos e miniaplicações.</p></div>'
        '<div class="card"><h3>Engenharia de Dados para IA</h3><p><b>Público:</b> equipes técnicas, pesquisadores, gestores de dados e participantes avançados.</p>'
        '<p><b>Módulos:</b> <a class="pill" href="modulos/m1.html">M1</a><a class="pill" href="modulos/m4.html">M4</a><a class="pill" href="modulos/m12.html">M12</a><a class="pill" href="modulos/m13.html">M13</a><a class="pill" href="modulos/m14.html">M14</a></p><p><b>Carga horária:</b> 108h</p>'
        '<p>Trilha avançada para criar pipelines, preparar dados, aplicar qualidade, governança, visualização e bases confiáveis para IA.</p></div>'
    )
    text = text.replace('</div></div></main>', cards + '</div></div></main>', 1)
    text = set_css(text, "")
    write(path, text)


EXISTING_TOOL_MODULES = {
    "google-colab": [13, 14],
    "excel-sheets": [14],
    "power-bi": [14],
    "looker-studio": [14],
    "julius": [14],
    "github-copilot": [13],
    "phind": [13],
}


def add_module_pills(fragment: str, modules: list[int], prefix: str) -> str:
    for m in modules:
        pill = f'<a class="pill" href="{prefix}modulos/m{m}.html">M{m}</a>'
        if f'm{m}.html' not in fragment:
            fragment += pill
    return fragment


def update_existing_tool_relations() -> None:
    for slug, modules in EXISTING_TOOL_MODULES.items():
        page = ROOT / "ferramentas" / f"{slug}.html"
        if page.exists():
            text = page.read_text(encoding="utf-8")
            def repl_page(match: re.Match) -> str:
                return match.group(1) + add_module_pills(match.group(2), modules, "../") + match.group(3)
            text = re.sub(r'(<h3>Módulos relacionados</h3><div class="related-strip">)(.*?)(</div>)', repl_page, text, count=1, flags=re.S)
            text = set_css(text, "../")
            write(page, text)
    for rel, prefix in [("ferramentas.html", ""), ("ferramentas/index.html", "../")]:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        for slug, modules in EXISTING_TOOL_MODULES.items():
            def repl_article(match: re.Match, modules=modules, prefix=prefix) -> str:
                article = match.group(0)
                def repl_modules(mm: re.Match) -> str:
                    return mm.group(1) + add_module_pills(mm.group(2), modules, prefix) + mm.group(3)
                return re.sub(r'(<div class="tool-module-links"><strong>Módulos relacionados</strong><div>)(.*?)(</div></div>)', repl_modules, article, count=1, flags=re.S)
            text = re.sub(rf'<article class="tool-card" id="ferramenta-{re.escape(slug)}".*?</article>', repl_article, text, count=1, flags=re.S)
        write(path, text)


def update_css() -> None:
    path = ROOT / "assets" / "css" / "style.css"
    text = path.read_text(encoding="utf-8")
    if ".module-card.m13" not in text:
        text = text.replace(".module-card.m12{border-color:#0B5AA6}", ".module-card.m12{border-color:#0B5AA6}.module-card.m13{border-color:#1976D2}.module-card.m14{border-color:#00796B}")
    if ".module-full.module-m13" not in text:
        text = text.replace(".module-full.module-m12{--module-color:#0B5AA6;--module-soft:#EAF4FF}", ".module-full.module-m12{--module-color:#0B5AA6;--module-soft:#EAF4FF}\n.module-full.module-m13{--module-color:#1976D2;--module-soft:#EAF4FF}\n.module-full.module-m14{--module-color:#00796B;--module-soft:#E8F7F4}")
    if ".module-m13 pre" not in text:
        text += "\n.module-m13 pre,.module-m14 pre{background:#0F172A;color:#E2E8F0;padding:16px;border-radius:14px;overflow:auto;white-space:pre-wrap}\n.module-m13 .figure-grid figure,.module-m14 .figure-grid figure{margin:0}\n"
    write(path, text)


def validate() -> None:
    for rel in ["modulos/m13.html", "modulos/m14.html", "conceitos.html", "ferramentas.html", "trilhas.html"]:
        text = (ROOT / rel).read_text(encoding="utf-8")
        if "Ã" in text or "�" in text:
            raise SystemExit(f"Possível mojibake em {rel}")
    print("Integração M13/M14 concluída")


def main() -> None:
    build_module_pages()
    build_concepts()
    build_tools()
    update_module_lists()
    update_trilhas()
    update_existing_tool_relations()
    update_css()
    validate()


if __name__ == "__main__":
    main()
