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
    validate_code = code("""
def validar_qualidade(df):
    relatorio = {}
    relatorio["linhas"] = len(df)
    relatorio["duplicados_id"] = int(df.duplicated(subset=["id_inscricao"]).sum())
    relatorio["nomes_ausentes"] = int(df["nome"].isna().sum())
    relatorio["emails_invalidos"] = int(~df["email"].fillna("").str.contains(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", regex=True).sum())
    relatorio["idades_fora_faixa"] = int(((df["idade"] < 0) | (df["idade"] > 110)).sum())
    return relatorio

print(validar_qualidade(inscricoes))
""")
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
    missing_code = code("""
# Estratégias comuns para valores ausentes
df = inscricoes_tratadas.copy()

# Remover linhas quando o campo é indispensável
df_sem_email_invalido = df[df["email_valido"]].copy()

# Preencher categorias ausentes
df["perfil"] = df["perfil"].fillna("não informado")

# Preencher números com mediana quando fizer sentido estatístico
df["idade"] = df["idade"].fillna(df["idade"].median())
""")
    outlier_code = code("""
def marcar_outliers_iqr(df, coluna):
    q1 = df[coluna].quantile(0.25)
    q3 = df[coluna].quantile(0.75)
    iqr = q3 - q1
    limite_inferior = q1 - 1.5 * iqr
    limite_superior = q3 + 1.5 * iqr
    return (df[coluna] < limite_inferior) | (df[coluna] > limite_superior)

inscricoes_tratadas["idade_outlier"] = marcar_outliers_iqr(inscricoes_tratadas, "idade")
""")
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
{unit("14.1 Fundamentos, ciclo de vida e arquitetura de dados", "Compreender o percurso do dado desde a origem até o uso em relatórios, automações e IA.", "<p>Engenharia de dados não é apenas programação: envolve arquitetura, qualidade, governança, segurança, documentação e operação. Um pipeline confiável precisa responder: de onde o dado veio, quem pode usar, o que foi transformado, quando foi atualizado e quais limites existem.</p><div class=\"table-wrap\"><table class=\"table\"><tr><th>Camada</th><th>Descrição</th><th>Exemplo</th></tr><tr><td>Bronze</td><td>Dado bruto, preservado como foi recebido.</td><td>CSV original de inscrições.</td></tr><tr><td>Prata</td><td>Dado limpo, validado e padronizado.</td><td>Inscrições com e-mail validado e duplicidades removidas.</td></tr><tr><td>Ouro</td><td>Dado agregado e pronto para consumo.</td><td>Indicadores por turma, perfil e situação.</td></tr></table></div>" + imports_code + sample_data_code)}
{unit("14.2 Extração e ingestão: CSV, Excel, JSON, API e banco", "Ler dados de diferentes fontes preservando origem, formato e rastreabilidade.", "<p>A extração deve manter uma cópia bruta dos dados e registrar data, fonte, responsável e finalidade. Nunca comece alterando o arquivo original: crie camadas.</p>" + extract_code + "<div class=\"box warn\"><strong>LGPD:</strong> se houver dados pessoais, defina finalidade, base legal, minimização, controle de acesso e prazo de retenção antes de coletar.</div>")}
{unit("14.3 Validação, schema e qualidade de dados", "Aplicar regras de completude, validade, consistência, unicidade e conformidade.", "<p>Validação é a alfândega do pipeline. Ela não corrige tudo automaticamente; ela classifica o que está válido, pendente ou bloqueado para revisão humana.</p><div class=\"table-wrap\"><table class=\"table\"><tr><th>Dimensão</th><th>Pergunta</th><th>Exemplo de regra</th></tr><tr><td>Completude</td><td>Campos obrigatórios estão preenchidos?</td><td>nome e e-mail não podem estar vazios.</td></tr><tr><td>Validade</td><td>O valor tem formato aceito?</td><td>e-mail deve seguir padrão válido.</td></tr><tr><td>Consistência</td><td>Campos combinam entre si?</td><td>melhor idade deve ter 60 anos ou mais quando for critério de público.</td></tr><tr><td>Unicidade</td><td>Há duplicidades?</td><td>id_inscricao não pode repetir.</td></tr><tr><td>Atualidade</td><td>O dado está no período esperado?</td><td>data de inscrição dentro do prazo.</td></tr></table></div>" + validate_code)}
{unit("14.4 Transformação: limpeza, padronização, tipos e regras de negócio", "Transformar dados brutos em dados consistentes, tipados e interpretáveis.", "<p>Transformar é aplicar regras explícitas: remover espaços, padronizar caixa, converter datas, normalizar categorias, validar chaves e criar campos derivados.</p>" + transform_code)}
{unit("14.5 Tratamento de ausências, duplicidades, normalização e outliers", "Aplicar técnicas de pré-processamento sem distorcer a realidade dos dados.", "<p>Nem todo valor ausente deve ser preenchido; nem todo outlier deve ser removido. Cada decisão precisa ser justificada, registrada e, quando necessário, revisada por uma pessoa responsável.</p><h3>Ausências</h3>" + missing_code + "<h3>Outliers pelo método IQR</h3>" + outlier_code + "<h3>Técnicas e métodos usuais</h3><ul><li><strong>Remoção:</strong> quando o registro é inválido e sem possibilidade de correção;</li><li><strong>Imputação:</strong> média, mediana, moda ou valor “não informado”, quando justificável;</li><li><strong>Normalização:</strong> escalas comparáveis, como min-max;</li><li><strong>Padronização:</strong> média zero e desvio padrão um;</li><li><strong>Encoding:</strong> transformar categorias em variáveis numéricas;</li><li><strong>Deduplicação:</strong> por chave única ou combinação de campos;</li><li><strong>Winsorização:</strong> limitar extremos quando há justificativa estatística.</li></ul>")}
{unit("14.6 Integração de bases, merge, join, concat, groupby e indicadores", "Combinar fontes, criar indicadores e gerar produtos de dados.", "<p>A integração exige atenção às chaves. Um merge errado pode multiplicar linhas, perder registros ou produzir indicadores incorretos. Use <code>validate</code> quando possível.</p>" + merge_code)}
{unit("14.7 Carga e armazenamento: CSV, Excel, Parquet, SQLite, DuckDB, data lake e warehouse", "Salvar dados tratados em formatos adequados ao consumo e à escala.", "<p>A carga fecha o ciclo do ETL. A escolha do destino depende do volume, frequência, público e finalidade. Para aula, CSV/Excel/SQLite bastam; para produção, avaliam-se bancos, data warehouses, lakehouses e governança de acesso.</p>" + load_code)}
{unit("14.8 Logs, auditoria, linhagem, catálogo e governança", "Registrar execuções, decisões, origem, transformações e responsáveis.", "<p>Um pipeline sem log é uma caixa-preta. Logs ajudam a responder o que aconteceu, quando aconteceu, quantas linhas foram processadas, quais erros surgiram e quem deve revisar.</p>" + log_code + "<div class=\"box tip\"><strong>Checklist mínimo:</strong> fonte, data/hora, versão do pipeline, total de linhas extraídas, total de linhas rejeitadas, regras aplicadas, destino, responsável e restrições de uso.</div>")}
{unit("14.9 Mineração de dados, análise exploratória e preparação para IA", "Preparar dados para exploração, modelos e aplicações de IA com cautela.", "<p>Depois do ETL, os dados podem alimentar visualizações, mineração de dados, modelos de classificação, regressão, agrupamento ou sistemas de recomendação. Antes disso, é preciso verificar representatividade, vieses, vazamentos de informação e finalidade.</p>" + code("from sklearn.model_selection import train_test_split\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.linear_model import LogisticRegression\n\nfeatures = base_curada[['idade', 'frequencia']].fillna(0)\ntarget = (base_curada['situacao'] == 'aprovado').astype(int)\n\nX_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.3, random_state=42)\n\nmodelo = Pipeline([\n    ('escala', StandardScaler()),\n    ('classificador', LogisticRegression())\n])\n\nmodelo.fit(X_train, y_train)\nprint('Acurácia:', modelo.score(X_test, y_test))") + "<div class=\"box warn\"><strong>Cuidado:</strong> este exemplo é didático. Modelos reais exigem avaliação, validação, análise de viés, explicabilidade, governança e autorização de uso.</div>")}
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
