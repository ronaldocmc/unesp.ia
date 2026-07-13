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
    '<a href="../personagens.html">Personagens</a><a href="../equipe.html">Equipe</a><a href="../mapa-conhecimento.html">Mapa</a>'
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
        f'<link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}"><script src="../assets/js/search.js"></script>'
        f'<style>.module-full.module-m{num}' + f'{{--module-color:{color};--module-soft:{soft}}}</style>'
        '</head><body>'
        + topbar()
        + f'<main><div class="container content module-full module-m{num}" id="top">'
        f'<div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../modulos.html">Módulos</a> / Módulo {num}</div>'
        f'<div class="hero"><span class="badge">M{num}</span><h1>{esc(title)}</h1><p>{esc(subtitle)}</p></div>'
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


def unit(title: str, objective: str, content: str) -> str:
    number = title.split(" ", 1)[0].replace(".", "")
    anchor = f"u{number}"
    return f'<section id="{anchor}"><h2 class="unit-title">{esc(title)}</h2><p class="unit-objective"><strong>Objetivo:</strong> {objective}</p>{content}</section>'


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


def build_m13() -> str:
    setup_code = code("""
# Verificar versão do Python
import sys
print(sys.version)

# Instalar pacotes pelo terminal ou em uma célula de notebook
pip install pandas numpy matplotlib seaborn plotly openpyxl lxml xlrd==1.2.0
pip install mysql-connector-python

# Verificar versão de um pacote instalado
import pkg_resources
print(pkg_resources.get_distribution("pandas").version)
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

    body = f"""
<div class="module-actions"><a class="pill" href="../conceitos.html">Conceitos</a><a class="pill" href="../ferramentas.html">Ferramentas</a><a class="pill" href="../trilhas.html">Trilhas</a><a class="pill" href="../laboratorios.html">Laboratórios</a></div>
<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3><div class="related-strip"><a class="pill" href="../ferramentas/python.html">Python</a><a class="pill" href="../ferramentas/anaconda.html">Anaconda</a><a class="pill" href="../ferramentas/jupyter.html">Jupyter Notebook/JupyterLab</a><a class="pill" href="../ferramentas/google-colab.html">Google Colab</a><a class="pill" href="../ferramentas/vscode.html">VS Code</a><a class="pill" href="../ferramentas/pycharm.html">PyCharm</a><a class="pill" href="../ferramentas/spyder.html">Spyder</a><a class="pill" href="../ferramentas/pandas.html">pandas</a><a class="pill" href="../ferramentas/numpy.html">NumPy</a><a class="pill" href="../ferramentas/matplotlib-seaborn-plotly.html">Matplotlib, Seaborn e Plotly</a></div></section>
{mini_toc([("Apresentação e competências","apresentacao"),("Glossário interno do módulo","glossario"),("13.1 Ambiente e instalação","u131"),("13.2 Variáveis, tipos e operadores","u132"),("13.3 Condições, loops e compreensão de listas","u133"),("13.4 Listas, tuplas, range, conjuntos e dicionários","u134"),("13.5 Series, DataFrames e índices","u135"),("13.6 Funções, lambda e organização de código","u136"),("13.7 Arquivos, CSV, JSON e exceções","u137"),("13.8 Programação orientada a objetos","u138"),("13.9 Visualização e análise exploratória","u139"),("13.10 Projeto aplicado","u1310")])}
<section class="module-visual"><figure><img src="../assets/img/modulos/m13-visual.svg" alt="Mapa visual do Módulo 13"><figcaption>O módulo parte do ambiente Python e chega a aplicações com dados, visualização e projeto final.</figcaption></figure><aside class="character-guide"><img src="../assets/img/personagens/joao.png" alt="Personagem João"><h3>João transforma ideias em código</h3><p>O foco é aprender a pensar computacionalmente: representar dados, escrever regras, testar hipóteses, documentar resultados e revisar limites.</p></aside></section>
<section id="apresentacao"><h2 class="section-title">Apresentação e competências</h2><p>Este módulo aprofunda a estrutura indicada nos anexos: ferramentas de desenvolvimento, instalação e uso inicial, sintaxe, comentários, variáveis, tipos de dados, operadores, estruturas de dados, condicionais, laços, funções, arquivos, tratamento de exceções, orientação a objetos, pandas, NumPy, visualização de dados e aplicações em mineração de dados.</p><div class="box practice"><strong>Ao final do módulo, espera-se que o participante seja capaz de:</strong><ul><li>instalar ou acessar um ambiente Python e gerenciar pacotes com PIP;</li><li>escrever códigos com variáveis, tipos, operadores, condicionais, laços e funções;</li><li>usar listas, tuplas, ranges, conjuntos, dicionários, Series e DataFrames;</li><li>ler, transformar e salvar arquivos CSV, Excel e JSON com tratamento de erros;</li><li>criar análises exploratórias, gráficos e relatórios simples com dados fictícios ou anonimizados;</li><li>organizar uma miniaplicação Python documentada e reprodutível.</li></ul></div></section>
<section id="glossario"><h2 class="section-title">Glossário interno do módulo</h2><p>Os conceitos abaixo aparecem no módulo e também possuem páginas próprias na enciclopédia. Eles ficam aqui para que o participante não precise sair da página para acompanhar a aula.</p>{concept_grid(PY_CONCEPTS)}</section>
{unit("13.1 Ferramentas disponíveis, instalação e uso inicial", "Conhecer opções de ambiente local e em nuvem, instalar pacotes e importar bibliotecas.", "<p>Python pode ser usado de várias formas. Para iniciantes, o <strong>Google Colab</strong> reduz barreiras porque roda no navegador. Para cursos de dados em laboratório, <strong>Anaconda</strong> facilita a instalação de pacotes científicos e traz Jupyter e Spyder. Para desenvolvimento de projetos, <strong>VS Code</strong> e <strong>PyCharm</strong> ajudam a organizar arquivos, depurar e versionar código.</p><div class=\"table-wrap\"><table class=\"table\"><tr><th>Ferramenta</th><th>Quando usar</th><th>Cuidados</th></tr><tr><td>Anaconda</td><td>Ambiente completo para ciência de dados e aprendizado de máquina.</td><td>Verificar espaço em disco, atualizações e política institucional.</td></tr><tr><td>Spyder</td><td>Ambiente científico com exploração de variáveis e depuração.</td><td>Bom para análise; menos adequado para projetos web complexos.</td></tr><tr><td>Jupyter Notebook/Lab</td><td>Aulas, experimentos, textos narrativos, gráficos e código juntos.</td><td>Não compartilhar notebooks com dados pessoais.</td></tr><tr><td>PyCharm</td><td>Projetos maiores, testes, classes e depuração.</td><td>Pode ser pesado para computadores simples.</td></tr><tr><td>Google Colab</td><td>Uso rápido no navegador, sem instalação local.</td><td>Há limites de sessão, memória e recursos.</td></tr><tr><td>VS Code</td><td>Editor leve, extensível, com suporte a Python e notebooks.</td><td>Instalar extensões confiáveis.</td></tr></table></div><h3>Preparando o ambiente com PIP</h3>" + setup_code)}
{unit("13.2 Variáveis, tipos de dados, constantes e operadores", "Compreender como Python representa valores e executa operações aritméticas, lógicas e de comparação.", "<p>Uma variável é um nome que referencia um valor. Em Python, os tipos são inferidos automaticamente. A convenção de nomes usa letras minúsculas e underscore, padrão conhecido como <em>snake_case</em>.</p>" + vars_code + "<h3>Operadores aritméticos e lógicos</h3><div class=\"table-wrap\"><table class=\"table\"><tr><th>Operação</th><th>Significado</th></tr><tr><td>a + b</td><td>adição</td></tr><tr><td>a - b</td><td>subtração</td></tr><tr><td>a * b</td><td>multiplicação</td></tr><tr><td>a / b</td><td>divisão</td></tr><tr><td>a // b</td><td>divisão inteira</td></tr><tr><td>a % b</td><td>resto da divisão</td></tr><tr><td>a ** b</td><td>exponenciação</td></tr><tr><td>==, !=, &lt;, &gt;, &lt;=, &gt;=</td><td>comparações</td></tr><tr><td>and, or, not</td><td>operações lógicas</td></tr></table></div>" + operators_code)}
{unit("13.3 Controle de fluxo, estruturas condicionais, while, for e compreensões", "Usar decisões e repetições para transformar regras em algoritmos.", "<p>Estruturas condicionais permitem que o programa escolha caminhos. Laços de repetição permitem executar uma ação várias vezes. O <code>while</code> executa enquanto uma condição for verdadeira; o <code>for</code> percorre sequências como listas, ranges e DataFrames.</p>" + flow_code + code("nomes = ['ana', 'carlos', 'maria']\nnomes_formatados = [nome.title() for nome in nomes]\nprint(nomes_formatados)"))}
{unit("13.4 Estruturas de dados: listas, tuplas, range, conjuntos e dicionários", "Organizar coleções de informações conforme o tipo de problema.", "<p>Listas são mutáveis; tuplas são imutáveis; ranges representam sequências numéricas; conjuntos removem duplicidades e permitem união/interseção/diferença; dicionários armazenam pares chave-valor e são úteis para representar registros.</p>" + structures_code + "<div class=\"box tip\"><strong>Atenção:</strong> em Python, interseção de conjuntos usa <code>&amp;</code>, união usa <code>|</code> e diferença usa <code>-</code>.</div>")}
{unit("13.5 Series, DataFrames, índices e métodos básicos do pandas", "Criar estruturas tabulares, identificar valores ausentes e usar métodos de inspeção.", "<p>Uma <strong>Series</strong> é uma estrutura unidimensional. Um <strong>DataFrame</strong> organiza dados em linhas e colunas, permitindo filtros, agrupamentos, junções, estatísticas e visualizações.</p>" + pandas_code + "<h3>Series, índices personalizados e índices hierárquicos</h3>" + series_code + "<h3>Métodos essenciais do pandas</h3><ul><li><code>head()</code>: visualiza primeiras linhas;</li><li><code>shape</code>: mostra linhas e colunas;</li><li><code>describe()</code>: estatísticas descritivas;</li><li><code>isna()</code>: identifica ausências;</li><li><code>loc</code> e <code>iloc</code>: selecionam dados por rótulo ou posição;</li><li><code>merge</code>, <code>join</code> e <code>concat</code>: combinam tabelas.</li></ul>")}
{unit("13.6 Funções, parâmetros, retorno, lambda e organização de código", "Criar blocos reutilizáveis e melhorar legibilidade, teste e manutenção.", "<p>Funções reduzem repetição, deixam o código mais legível e permitem testar partes pequenas de uma solução. Uma função deve ter objetivo claro, entradas, processamento e saída.</p>" + functions_code)}
{unit("13.7 Manipulação de arquivos, CSV, JSON, Excel e tratamento de exceções", "Ler e escrever arquivos com segurança, tratando erros previsíveis.", "<p>Grande parte das aplicações de dados começa lendo arquivos. O participante deve aprender a validar caminhos, tratar erros e nunca publicar bases com dados pessoais sem autorização.</p>" + files_code)}
{unit("13.8 Programação orientada a objetos: classes, objetos, herança, encapsulamento e composição", "Compreender como organizar entidades e comportamentos em classes.", "<p>Orientação a objetos ajuda quando queremos representar entidades do problema, como participante, turma, módulo ou certificado. Classes definem estrutura; objetos são instâncias concretas.</p>" + oop_code + "<div class=\"box practice\"><strong>Extensão:</strong> implemente uma classe <code>Turma</code> que receba uma lista de participantes e calcule média de frequência.</div>")}
{unit("13.9 Visualização de dados, análise exploratória e comunicação", "Criar gráficos e interpretar dados com cuidado metodológico.", "<p>Visualização não é decoração: é uma forma de revelar padrões e comunicar resultados. O gráfico deve ter título, eixos claros, escala adequada e interpretação compatível com os dados.</p>" + viz_code + "<ul><li><strong>Matplotlib:</strong> base para gráficos personalizáveis;</li><li><strong>Seaborn:</strong> gráficos estatísticos com bom padrão visual;</li><li><strong>Plotly:</strong> visualizações interativas.</li></ul>")}
{unit("13.10 Projeto aplicado: miniaplicação Python com dados", "Integrar ambiente, código, dados, funções, arquivos e visualização.", "<p>O projeto final deve usar dados fictícios ou anonimizados e entregar um notebook ou script reprodutível.</p>" + code("import pandas as pd\n\n# 1. Extrair ou criar base fictícia\ndf = pd.DataFrame({\n    'nome': ['Ana', 'Carlos', 'Maria', 'Ana'],\n    'perfil': ['Melhor Idade', 'Comunidade', 'Comunidade', 'Melhor Idade'],\n    'presencas': [10, 7, 12, 10],\n    'total_aulas': [12, 12, 12, 12]\n})\n\n# 2. Transformar\ndf['nome'] = df['nome'].str.strip().str.title()\ndf['frequencia'] = df['presencas'] / df['total_aulas']\ndf['situacao'] = df['frequencia'].apply(lambda x: 'aprovado' if x >= 0.75 else 'pendente')\n\n# 3. Validar e resumir\nresumo = df.drop_duplicates().groupby('perfil').agg(\n    participantes=('nome', 'count'),\n    frequencia_media=('frequencia', 'mean')\n).reset_index()\n\nprint(resumo)\nresumo.to_csv('resumo_turma.csv', index=False, encoding='utf-8')") + "<div class=\"box lab\"><strong>Entrega:</strong> notebook ou script com objetivo, base fictícia, código, gráfico, interpretação, limitações e próximos passos.</div>")}
"""
    return html_shell(13, "Python: Fundamentos e Aplicações", "Caderno aprofundado de programação Python para fundamentos, análise de dados, visualização, mineração de dados e aplicações em IA.", "#1976D2", "#EAF4FF", body)


def build_m14() -> str:
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
    ])
    full_pipeline_code = code("""
from pathlib import Path
from datetime import datetime
import logging
import numpy as np
import pandas as pd

RAW = Path("dados/raw")
CURATED = Path("dados/curated")
LOGS = Path("logs")
for pasta in [RAW, CURATED, LOGS]:
    pasta.mkdir(parents=True, exist_ok=True)

logging.basicConfig(filename=LOGS / "etl.log", level=logging.INFO)

def extract():
    inscricoes = pd.read_csv(RAW / "inscricoes.csv", encoding="utf-8")
    presencas = pd.read_excel(RAW / "presencas.xlsx", engine="openpyxl")
    return inscricoes, presencas

def validate(df):
    erros = {
        "duplicados": int(df.duplicated(subset=["id_inscricao"]).sum()),
        "email_ausente": int(df["email"].isna().sum()),
        "nome_ausente": int(df["nome"].isna().sum())
    }
    return erros

def transform(inscricoes, presencas):
    dados = inscricoes.copy()
    dados["nome"] = dados["nome"].fillna("não informado").str.strip().str.title()
    dados["email"] = dados["email"].str.strip().str.lower()
    dados["perfil"] = dados["perfil"].str.strip().str.lower()
    dados["data_inscricao"] = pd.to_datetime(dados["data_inscricao"], errors="coerce")
    dados = dados.drop_duplicates(subset=["id_inscricao"], keep="last")
    dados = dados.merge(presencas, on="email", how="left")
    dados["presencas"] = dados["presencas"].fillna(0)
    dados["total_aulas"] = dados["total_aulas"].fillna(12)
    dados["frequencia"] = dados["presencas"] / dados["total_aulas"]
    dados["situacao"] = np.where(dados["frequencia"] >= 0.75, "aprovado", "pendente")
    return dados

def load(base):
    base.to_csv(CURATED / "participantes_curado.csv", index=False, encoding="utf-8")
    resumo = base.groupby(["perfil", "situacao"]).size().reset_index(name="total")
    resumo.to_excel(CURATED / "indicadores.xlsx", index=False)
    return resumo

def run():
    inicio = datetime.now()
    logging.info("Início do pipeline")
    inscricoes, presencas = extract()
    logging.info("Validação: %s", validate(inscricoes))
    base = transform(inscricoes, presencas)
    resumo = load(base)
    logging.info("Fim do pipeline: %s linhas, %s indicadores", len(base), len(resumo))
    print("Pipeline concluído em", datetime.now() - inicio)

run()
""")

    body = f"""
<div class="module-actions"><a class="pill" href="../conceitos.html">Conceitos</a><a class="pill" href="../ferramentas.html">Ferramentas</a><a class="pill" href="../trilhas.html">Trilhas</a><a class="pill" href="../laboratorios.html">Laboratórios</a></div>
<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3><div class="related-strip"><a class="pill" href="../ferramentas/python.html">Python</a><a class="pill" href="../ferramentas/pandas.html">pandas</a><a class="pill" href="../ferramentas/numpy.html">NumPy</a><a class="pill" href="../ferramentas/jupyter.html">Jupyter</a><a class="pill" href="../ferramentas/google-colab.html">Google Colab</a><a class="pill" href="../ferramentas/excel-sheets.html">Excel e Google Sheets</a><a class="pill" href="../ferramentas/power-bi.html">Power BI</a><a class="pill" href="../ferramentas/looker-studio.html">Looker Studio</a><a class="pill" href="../ferramentas/scikit-learn.html">scikit-learn</a><a class="pill" href="../ferramentas/duckdb.html">DuckDB</a></div></section>
{mini_toc([("Apresentação e competências","apresentacao"),("Glossário interno do módulo","glossario"),("14.1 Ciclo de vida e arquitetura","u141"),("14.2 Extração e ingestão","u142"),("14.3 Qualidade e validação","u143"),("14.4 Transformação e padronização","u144"),("14.5 Ausências, duplicidades e outliers","u145"),("14.6 Integração, joins e indicadores","u146"),("14.7 Carga, armazenamento e camadas","u147"),("14.8 Logs, auditoria e linhagem","u148"),("14.9 Mineração, modelos e preparação para IA","u149"),("14.10 Pipeline ETL completo","u1410")])}
<section class="module-visual"><figure><img src="../assets/img/modulos/m14-visual.svg" alt="Mapa visual do Módulo 14"><figcaption>Engenharia de dados conecta fontes, qualidade, transformação, armazenamento, governança e uso em IA.</figcaption></figure><aside class="character-guide"><img src="../assets/img/personagens/carlos.png" alt="Personagem Carlos"><h3>Carlos constrói dados confiáveis</h3><p>Sem dados organizados e rastreáveis, dashboards, automações e modelos de IA ficam frágeis. O módulo ensina a preparar dados com método.</p></aside></section>
<section id="apresentacao"><h2 class="section-title">Apresentação e competências</h2><p>Este módulo aprofunda engenharia de dados aplicada ao unesp.IA. O foco é construir pipelines reprodutíveis com Python, da extração à carga, passando por validação, limpeza, transformação, integração, logs, governança e preparação para análise, mineração de dados e IA.</p><div class="box practice"><strong>Ao final do módulo, espera-se que o participante seja capaz de:</strong><ul><li>diferenciar dado bruto, tratado, curado e produto de dados;</li><li>desenhar pipelines ETL e ELT com entradas, regras, saídas e logs;</li><li>extrair dados de CSV, Excel, JSON, APIs e bancos;</li><li>aplicar validações de qualidade, schema, duplicidade, consistência e completude;</li><li>tratar ausências, outliers, tipos, categorias e formatos;</li><li>integrar bases por chaves, gerar indicadores e carregar resultados em arquivos ou bancos;</li><li>documentar catálogo, linhagem, LGPD, riscos e responsáveis.</li></ul></div></section>
<section id="glossario"><h2 class="section-title">Glossário interno do módulo</h2>{concept_grid(DE_CONCEPTS)}</section>
{unit("14.1 Fundamentos, ciclo de vida e arquitetura de dados", "Compreender o percurso do dado desde a origem até o uso em relatórios, automações e IA.", "<p>Engenharia de dados não é apenas programação: envolve arquitetura, qualidade, governança, segurança, documentação e operação. As camadas bronze, prata e ouro separam preservação, curadoria e consumo.</p>" + imports_code + sample_data_code + architecture_methods)}
{unit("14.2 Extração e ingestão: CSV, Excel, JSON, API e banco", "Ler dados de diferentes fontes preservando origem, formato e rastreabilidade.", "<p>A extração deve manter uma cópia bruta e registrar data, fonte, responsável e finalidade. Cada formato exige parâmetros e controles próprios.</p>" + ingestion_methods + "<h3>Visão integrada</h3>" + extract_code + "<div class=\"box warn\"><strong>LGPD:</strong> defina finalidade, base legal, minimização, acesso e retenção antes de coletar dados pessoais.</div>")}
{unit("14.3 Validação, schema e qualidade de dados", "Aplicar regras de completude, validade, consistência, unicidade, atualidade e conformidade.", "<p>Validação é a alfândega do pipeline: compara os dados com contratos e regras explícitas antes que erros cheguem a relatórios, automações ou modelos de IA. Ela não corrige tudo automaticamente; produz evidências, classifica registros e encaminha exceções para uma área de quarentena ou revisão humana.</p><div class=\"box tip\"><strong>Ordem recomendada:</strong> conferir estrutura e tipos, avaliar cada dimensão de qualidade, consolidar os resultados e somente depois transformar ou descartar registros.</div>" + validation_methods)}
{unit("14.4 Transformação: limpeza, padronização, tipos e regras de negócio", "Transformar dados brutos em dados consistentes, tipados e interpretáveis.", "<p>Transformar é aplicar regras explícitas e reproduzíveis. Cada transformação precisa informar o que muda, por que muda e como um valor problemático será tratado. Os exemplos abaixo separam as técnicas para que cada decisão possa ser testada e auditada.</p>" + transformation_methods + "<h3>Exemplo integrado</h3><p>Depois de compreender cada técnica isoladamente, elas podem ser reunidas em uma função única. O exemplo mantém uma cópia de entrada, converte tipos, cria indicadores de validade, remove duplicidades e calcula uma regra de negócio.</p>" + transform_code)}
{unit("14.5 Tratamento de ausências, duplicidades, normalização e outliers", "Aplicar técnicas de pré-processamento sem distorcer a realidade dos dados.", "<p>Nem todo valor ausente deve ser preenchido; nem todo registro repetido representa uma duplicata; e nem todo outlier é erro. A escolha depende da finalidade, do significado da coluna e do impacto sobre grupos e indicadores. Registre a técnica, os parâmetros calculados e quantas linhas foram afetadas.</p><div class=\"box warn\"><strong>Evite vazamento de dados:</strong> em projetos de IA, média, mediana, limites, escalas e categorias devem ser aprendidos somente no conjunto de treino e depois reaplicados aos conjuntos de validação e teste.</div>" + preprocessing_methods)}
{unit("14.6 Integração de bases, merge, join, concat, groupby e indicadores", "Combinar fontes, criar indicadores e gerar produtos de dados.", "<p>A integração exige atenção às chaves, cardinalidade e granularidade. Um erro pode multiplicar linhas ou perder registros.</p>" + integration_methods + "<h3>Exemplo integrado</h3>" + merge_code)}
{unit("14.7 Carga e armazenamento: CSV, Excel, Parquet, SQLite, DuckDB, data lake e warehouse", "Salvar dados tratados em formatos adequados ao consumo e à escala.", "<p>A escolha depende de volume, frequência, consumidores, custo e governança. Os métodos abaixo mostram opções locais e analíticas.</p>" + storage_methods + "<h3>Carga combinada</h3>" + load_code)}
{unit("14.8 Logs, auditoria, linhagem, catálogo e governança", "Registrar execuções, decisões, origem, transformações e responsáveis.", "<p>Um pipeline sem registros é uma caixa-preta. Logs operacionais, auditoria, linhagem e catálogo respondem perguntas diferentes e complementares.</p>" + governance_methods + "<h3>Configuração básica de logging</h3>" + log_code)}
{unit("14.9 Mineração de dados, análise exploratória e preparação para IA", "Preparar dados para exploração, modelos e aplicações de IA com cautela.", "<p>Antes de modelar, verifique representatividade, vieses, vazamento de informação, equilíbrio das classes e finalidade legítima.</p>" + modeling_methods + "<div class=\"box warn\"><strong>Cuidado:</strong> o exemplo é didático; sistemas reais exigem métricas adequadas, explicabilidade, governança e autorização de uso.</div>")}
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
