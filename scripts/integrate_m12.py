from __future__ import annotations

import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\User\Downloads\modulos\m12.html")
CSS_VERSION = "20260712-m12"


NAV_ROOT = (
    '<a href="index.html">Início</a><a href="inscricoes.html">Inscrições</a><a href="modulos.html">Módulos</a>'
    '<a href="trilhas.html">Trilhas</a><a href="conceitos.html">Conceitos</a><a href="ferramentas.html">Ferramentas</a>'
    '<a href="laboratorios.html">Laboratórios</a><a href="materiais.html">Materiais</a><a href="personagens.html">Personagens</a>'
    '<a href="equipe.html">Equipe</a><a href="mapa-conhecimento.html">Mapa</a>'
)
NAV_UP = NAV_ROOT.replace('href="', 'href="../')
FOOTER_ROOT = (
    '<footer class="footer"><span class="footer-primary">unesp.IA - Inteligência Artificial para Todos | '
    'Projeto de Extensão Universitária | Coleção Editorial</span><span class="footer-unit">Faculdade de Ciências '
    'e Tecnologia de Presidente Prudente - FCT/UNESP</span><span class="footer-institution">Departamento de '
    'Matemática e Computação</span></footer>'
)
FOOTER_UP = FOOTER_ROOT


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="")


def topbar(prefix: str = "") -> str:
    nav = NAV_UP if prefix == "../" else NAV_ROOT
    return (
        f'<div class="topbar"><a class="brand" href="{prefix}index.html">'
        f'<img class="brand-logo" src="{prefix}assets/img/logo-unesp-ia-portal.jpg" alt="unesp.IA">'
        f'<small>Coleção Editorial | Portal Didático dos Participantes</small></a><div class="nav">{nav}</div></div>'
    )


def footer() -> str:
    return FOOTER_UP


def clean_source_body() -> str:
    src = read(SOURCE)
    match = re.search(r"<main>\s*(.*?)\s*</main>\s*<aside", src, flags=re.S)
    if not match:
        raise RuntimeError("Não foi possível extrair o conteúdo principal do M12.")
    body = match.group(1).strip()
    body = re.sub(r'<section id="portal">.*?</section>\s*', "", body, flags=re.S)
    body = body.replace('<section id="ana">', '<section id="ana" class="box practice">')
    body = body.replace("<h2>Ana acompanha este módulo</h2>", "<h3>Ana acompanha este módulo</h3>")
    body = body.replace('<section id="apresentacao">', '<section id="apresentacao" class="module-intro-section">')
    body = body.replace("<table>", '<div class="table-wrap"><table class="table">')
    body = body.replace("</table>", "</table></div>")
    body = body.replace("<ol>", '<ol class="steps">')
    body = body.replace("<ul>", '<ul class="list">')
    body = body.replace('<div class="note">', '<div class="box tip">')
    body = body.replace('<div class="warning">', '<div class="box warn">')
    body = body.replace('<div class="success">', '<div class="box practice">')
    body = body.replace('class="cards"', 'class="m12-cards"')
    body = body.replace('class="pipeline"', 'class="m12-pipeline"')
    body = body.replace('class="skill-card"', 'class="m12-skill-card"')
    body = body.replace('class="skills-grid"', 'class="m12-skills-grid"')
    # Link important repeated concepts without trying to link every occurrence.
    replacements = [
        ("LGPD", '<a class="term" href="../conceitos/lgpd.html">LGPD</a>'),
        ("workflow", '<a class="term" href="../conceitos/workflow.html">workflow</a>'),
        ("Workflow", '<a class="term" href="../conceitos/workflow.html">Workflow</a>'),
        ("pipeline", '<a class="term" href="../conceitos/pipeline.html">pipeline</a>'),
        ("Pipeline", '<a class="term" href="../conceitos/pipeline.html">Pipeline</a>'),
        ("skill", '<a class="term" href="../conceitos/skill.html">skill</a>'),
        ("Skill", '<a class="term" href="../conceitos/skill.html">Skill</a>'),
        ("webhook", '<a class="term" href="../conceitos/webhook.html">webhook</a>'),
        ("Webhook", '<a class="term" href="../conceitos/webhook.html">Webhook</a>'),
        ("API", '<a class="term" href="../conceitos/api.html">API</a>'),
        ("JSON", '<a class="term" href="../conceitos/json.html">JSON</a>'),
        ("guardrails", '<a class="term" href="../conceitos/guardrails.html">guardrails</a>'),
        ("Guardrails", '<a class="term" href="../conceitos/guardrails.html">Guardrails</a>'),
        ("logs", '<a class="term" href="../conceitos/logs.html">logs</a>'),
        ("Logs", '<a class="term" href="../conceitos/logs.html">Logs</a>'),
    ]
    for plain, linked in replacements:
        body = body.replace(plain, linked, 1)
    return body


def build_m12() -> None:
    body = clean_source_body()
    toc_items = [
        ("#ana", "Ana acompanha"),
        ("#apresentacao", "Apresentação"),
        ("#identidade", "Identidade"),
        ("#competencias", "Competências"),
        ("#estrutura", "Estrutura"),
        ("#progressao", "Progressão didática"),
        ("#u121", "Unidade 12.1"),
        ("#u122", "Unidade 12.2"),
        ("#u123", "Unidade 12.3"),
        ("#u124", "Unidade 12.4"),
        ("#u125", "Unidade 12.5"),
        ("#u126", "Unidade 12.6"),
        ("#u127", "Unidade 12.7"),
        ("#u128", "Unidade 12.8"),
        ("#u129", "Unidade 12.9"),
        ("#u1210", "Unidade 12.10"),
        ("#u1211", "Unidade 12.11"),
        ("#u1212", "Unidade 12.12"),
        ("#catalogo", "Catálogo de Skills"),
        ("#avaliacao", "Avaliação"),
    ]
    toc = '<div class="mini-toc"><strong>Unidades e seções deste módulo</strong>' + "".join(
        f'<a href="{href}">{label}</a>' for href, label in toc_items
    ) + "</div>"
    toolbox = (
        '<section class="module-toolbox"><h3>Ferramentas relacionadas neste módulo</h3><div class="related-strip">'
        '<a class="pill" href="../ferramentas/n8n.html">n8n</a>'
        '<a class="pill" href="../ferramentas/apis-webhooks.html">APIs e Webhooks</a>'
        '<a class="pill" href="../ferramentas/google-forms.html">Google Forms</a>'
        '<a class="pill" href="../ferramentas/excel-sheets.html">Google Sheets</a>'
        '<a class="pill" href="../ferramentas/gmail.html">Gmail</a>'
        '<a class="pill" href="../ferramentas/google-calendar.html">Google Calendar</a>'
        '<a class="pill" href="../ferramentas/google-docs.html">Google Docs</a>'
        '<a class="pill" href="../ferramentas/apps-script.html">Apps Script</a>'
        '<a class="pill" href="../ferramentas/chatgpt.html">ChatGPT</a>'
        '<a class="pill" href="../ferramentas/gemini.html">Gemini</a>'
        '<a class="pill" href="../ferramentas/whatsapp-business.html">WhatsApp Business</a>'
        '<a class="pill" href="../ferramentas/manychat.html">ManyChat</a>'
        '</div></section>'
    )
    html_text = f"""<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Módulo 12 – Automação Inteligente com n8n, Pipelines, Skills e LLMs • unesp.IA</title>
<link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}">
<script src="../assets/js/search.js"></script>
<style>
.module-full.module-m12{{--module-color:#0B5AA6;--module-soft:#EAF4FF}}
</style>
</head>
<body>
{topbar("../")}
<main><div class="container content module-full module-m12" id="top">
<div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../modulos.html">Módulos</a> / Módulo 12</div>
<div class="hero"><span class="badge">M12</span><h1>Automação Inteligente com n8n, Pipelines, Skills e LLMs</h1><p>Construção de workflows, pipelines, skills reutilizáveis e automações com IA para educação, serviços, comércio, indústria e grupos multiempresa.</p></div>
<div class="module-actions"><a class="pill" href="../conceitos.html">Conceitos</a><a class="pill" href="../ferramentas.html">Ferramentas</a><a class="pill" href="../laboratorios.html">Laboratórios</a><a class="pill" href="../materiais.html">Materiais</a><a class="pill" href="../materiais/banco-skills.html">Banco de Skills</a></div>
{toolbox}
{toc}
<section class="module-visual" aria-label="Apoio visual do módulo"><figure><img src="../assets/img/modulos/m12-visual.svg" alt="Mapa visual do módulo 12: n8n, pipelines, skills, LLMs, logs e guardrails"></figure><aside class="character-guide"><img src="../assets/img/personagens/ana.png" alt="Personagem Ana"><h3>Ana constrói automações reais</h3><p>Depois de compreender agentes e skills no Módulo 11, Ana agora aprende a transformar processos em workflows funcionais no n8n, com logs, custos, segurança e revisão humana.</p><a class="pill" href="../personagens/ana.html">Conhecer Ana</a></aside></section>
{body}
</div></main><a class="backtop" href="#top">Topo</a>{footer()}</body></html>"""
    write(ROOT / "modulos" / "m12.html", html_text)


def svg_m12() -> None:
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 420" role="img" aria-labelledby="t d">
<title id="t">Módulo 12: automação inteligente com n8n</title>
<desc id="d">Fluxo visual com entrada, pipeline, LLM, skill, saída, logs e guardrails.</desc>
<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#eaf4ff"/><stop offset="1" stop-color="#f7fbff"/></linearGradient></defs>
<rect width="1100" height="420" fill="url(#g)"/>
<text x="56" y="72" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#003a70">M12 · Automação Inteligente com n8n</text>
<text x="56" y="110" font-family="Arial, sans-serif" font-size="18" fill="#334">Do processo real ao workflow com pipeline, skills, LLMs, logs e governança.</text>
<g font-family="Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle">
<g transform="translate(95 210)"><circle r="50" fill="#0b5aa6"/><text y="7" fill="#fff">Entrada</text></g>
<g transform="translate(260 210)"><rect x="-70" y="-46" width="140" height="92" rx="18" fill="#fff" stroke="#0b5aa6" stroke-width="3"/><text y="-6" fill="#003a70">Pipeline</text><text y="24" font-size="14" fill="#334">validar · tratar</text></g>
<g transform="translate(430 210)"><rect x="-70" y="-46" width="140" height="92" rx="18" fill="#fff" stroke="#009a9a" stroke-width="3"/><text y="-6" fill="#003a70">Skill</text><text y="24" font-size="14" fill="#334">reutilizável</text></g>
<g transform="translate(600 210)"><rect x="-70" y="-46" width="140" height="92" rx="18" fill="#fff" stroke="#6046a6" stroke-width="3"/><text y="-6" fill="#003a70">LLM</text><text y="24" font-size="14" fill="#334">quando agrega</text></g>
<g transform="translate(770 210)"><rect x="-70" y="-46" width="140" height="92" rx="18" fill="#fff" stroke="#3aa655" stroke-width="3"/><text y="-6" fill="#003a70">Saída</text><text y="24" font-size="14" fill="#334">resposta · ação</text></g>
<g transform="translate(935 210)"><circle r="50" fill="#003a70"/><text y="7" fill="#fff">Logs</text></g>
</g>
<g stroke="#0b5aa6" stroke-width="5" fill="none" stroke-linecap="round"><path d="M150 210H188"/><path d="M330 210H358"/><path d="M500 210H528"/><path d="M670 210H698"/><path d="M840 210H882"/></g>
<g font-family="Arial, sans-serif" font-size="16" fill="#003a70"><text x="220" y="330">Guardrails · custos · LGPD · revisão humana · versionamento · fallback</text></g>
</svg>"""
    write(ROOT / "assets" / "img" / "modulos" / "m12-visual.svg", svg)


def card_m12(href: str) -> str:
    return (
        '<div class="module-card m12" data-search="Módulo 12 - Automação Inteligente com n8n, Pipelines, Skills e LLMs">'
        '<h3><span class="num">12</span>Automação Inteligente com n8n, Pipelines, Skills e LLMs</h3>'
        f'<p>12 unidades. <a href="{href}">Acessar módulo</a></p></div>'
    )


def add_m12_to_module_lists() -> None:
    for path, href in [
        (ROOT / "modulos.html", "modulos/m12.html"),
        (ROOT / "modulos" / "index.html", "m12.html"),
        (ROOT / "index.html", "modulos/m12.html"),
    ]:
        text = read(path)
        if path.name == "index.html" and "module-card m11" not in text:
            m11 = (
                '<div class="module-card m11" data-search="Módulo 11 - Agentes de IA, Skills e Automação Inteligente">'
                '<h3><span class="num">11</span>Agentes de IA, Skills e Automação Inteligente</h3>'
                '<p>6 unidades. <a href="modulos/m11.html">Acessar módulo</a></p></div>'
            )
            text = text.replace("</div><h2 class=\"section-title\">Materiais da coleção</h2>", m11 + "</div><h2 class=\"section-title\">Materiais da coleção</h2>", 1)
        if "module-card m12" not in text:
            if path.name == "index.html":
                text = text.replace("</div><h2 class=\"section-title\">Materiais da coleção</h2>", card_m12(href) + "</div><h2 class=\"section-title\">Materiais da coleção</h2>", 1)
            else:
                text = text.replace("</div></div></main>", card_m12(href) + "</div></div></main>", 1)
        text = text.replace("dez módulos", "doze módulos")
        text = text.replace("dez módulos", "doze módulos")
        write(path, text)


CONCEPTS = [
    ("workflow", "Workflow", "Fluxo organizado de etapas, condições, entradas e saídas para executar um processo.", "M11", "M12"),
    ("pipeline", "Pipeline", "Sequência de processamento de dados dentro de uma automação, como receber, validar, transformar, decidir, registrar e responder.", "M12", "M11"),
    ("skill", "Skill", "Capacidade reutilizável de uma automação ou agente, com objetivo, entradas, ações, saídas, validações, logs e riscos.", "M11", "M12"),
    ("tool", "Tool", "Ferramenta ou função acionada por um workflow, skill ou agente para consultar, registrar, enviar, transformar ou executar uma ação.", "M11", "M12"),
    ("webhook", "Webhook", "Endereço que recebe eventos de outro sistema e inicia uma automação quando algo acontece.", "M11", "M12"),
    ("api", "API", "Interface que permite a comunicação entre sistemas por chamadas controladas, geralmente com autenticação, parâmetros e respostas estruturadas.", "M11", "M12"),
    ("json", "JSON", "Formato textual estruturado para trocar dados entre sistemas, APIs, workflows e modelos de linguagem.", "M12", "M11"),
    ("credenciais", "Credenciais", "Chaves, tokens, contas ou permissões usadas para autenticar uma integração e acessar sistemas com segurança.", "M11", "M12"),
    ("logs", "Logs", "Registros de execução que permitem saber o que aconteceu, quando aconteceu, qual dado foi usado, qual erro ocorreu e quem deve revisar.", "M11", "M12"),
    ("guardrails", "Guardrails", "Limites, regras, bloqueios e verificações que impedem a automação ou a IA de executar ações inadequadas ou inseguras.", "M11", "M12"),
    ("governanca-ia", "Governança de IA", "Conjunto de responsabilidades, regras, versionamento, auditoria e supervisão para uso seguro e responsável de IA.", "M7", "M12"),
    ("humano-no-loop", "Humano no loop", "Etapa em que uma pessoa revisa, aprova ou corrige decisões importantes antes que a automação continue.", "M11", "M12"),
    ("trigger-node", "Trigger e node no n8n", "No n8n, trigger é o gatilho que inicia um workflow; node é cada bloco responsável por uma ação, condição ou integração.", "M12", "M11"),
    ("sub-workflow", "Sub-workflow", "Workflow chamado por outro workflow para reutilizar uma rotina, organizar skills e reduzir repetição.", "M12", "M11"),
]


def concept_page(slug: str, title: str, definition: str, m1: str, m2: str) -> str:
    modules = {"M7": "m7.html", "M11": "m11.html", "M12": "m12.html"}
    pills = "".join(f'<a class="pill" href="../modulos/{modules[m]}">{m}</a>' for m in (m1, m2))
    return f"""<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} | unesp.IA</title><link rel="stylesheet" href="../assets/css/style.css?v={CSS_VERSION}"><script src="../assets/js/search.js"></script></head><body>
{topbar("../")}<main><div class="container content" id="top"><div class="breadcrumbs"><a href="../index.html">Início</a> / <a href="../conceitos.html">Conceitos</a> / {html.escape(title)}</div><h1>{html.escape(title)}</h1><div class="callout"><b>Definição simples:</b> {html.escape(definition)}</div><h2>Explicação didática</h2><p>No contexto do unesp.IA, este conceito ajuda a transformar o uso isolado de IA em processos mais organizados, verificáveis e responsáveis. Ele é especialmente importante nos módulos de agentes, skills e automações inteligentes.</p><div class="two-col"><div class="callout practice"><h3>Exemplos didáticos</h3><p><b>Educação:</b> automatizar inscrições, confirmações, dúvidas frequentes ou geração de materiais com revisão humana.</p><p><b>Negócios:</b> organizar atendimento, estoque, leads, propostas, notificações e relatórios.</p><p><b>Gestão:</b> registrar logs, separar permissões, acompanhar indicadores e manter rastreabilidade.</p></div><div class="callout warn"><h3>Riscos e cuidados</h3><p>Antes de automatizar, verifique dados pessoais, credenciais, permissões, custos, logs, guardrails, fontes oficiais e necessidade de aprovação humana.</p></div></div><h2>Relações</h2><p><b>Módulos relacionados:</b> {pills}</p><p><b>Conceitos associados:</b><span class="concept-related-links"><a class="pill" href="automacao.html">Automação com IA</a><a class="pill" href="agentes-ia.html">Agentes de IA</a><a class="pill" href="llm.html">LLM</a><a class="pill" href="lgpd.html">LGPD</a></span></p><h2>Ferramentas relacionadas</h2><p><a class="pill" href="../ferramentas/n8n.html">n8n</a><a class="pill" href="../ferramentas/apis-webhooks.html">APIs e Webhooks</a><a class="pill" href="../ferramentas/apps-script.html">Apps Script</a><a class="pill" href="../ferramentas/google-forms.html">Google Forms</a></p></div></main><a class="backtop" href="#top">Topo</a>{footer()}</body></html>"""


def update_concepts() -> None:
    for slug, title, definition, m1, m2 in CONCEPTS:
        write(ROOT / "conceitos" / f"{slug}.html", concept_page(slug, title, definition, m1, m2))
    for path, prefix in [(ROOT / "conceitos.html", "conceitos/"), (ROOT / "conceitos" / "index.html", "")]:
        text = read(path)
        if "workflow.html" not in text:
            cards = []
            for slug, title, definition, m1, m2 in CONCEPTS:
                href = f"{prefix}{slug}.html"
                mod_href = "../modulos/" if path.parent.name == "conceitos" else "modulos/"
                pills = f'<a class="pill" href="{mod_href}{m1.lower()}.html">{m1}</a><a class="pill" href="{mod_href}{m2.lower()}.html">{m2}</a>'
                cards.append(f'<div class="card" data-search="{html.escape(title)} {html.escape(definition)}"><h3><a href="{href}">{html.escape(title)}</a></h3><p>{html.escape(definition)}</p><p>{pills}</p></div>')
            text = text.replace("</div></div></main>", "".join(cards) + "</div></div></main>", 1)
        text = text.replace("style.css?v=20260702-logo", f"style.css?v={CSS_VERSION}")
        text = text.replace("style.css?v=20260708-m11-tools", f"style.css?v={CSS_VERSION}")
        # Add M11/M12 pills to existing high-value concepts.
        text = text.replace('href="modulos/m10.html">M10</a></p></div><div class="card" data-search="Agentes de IA', 'href="modulos/m10.html">M10</a></p></div><div class="card" data-search="Agentes de IA')
        write(path, text)


def update_tools() -> None:
    tool_slugs = [
        "n8n", "apis-webhooks", "google-forms", "excel-sheets", "gmail", "google-calendar",
        "google-docs", "apps-script", "chatgpt", "gemini", "whatsapp-business", "manychat",
    ]
    for path, inside_dir in [(ROOT / "ferramentas.html", False), (ROOT / "ferramentas" / "index.html", True)]:
        text = read(path)
        text = text.replace("style.css?v=20260708-m11-tools", f"style.css?v={CSS_VERSION}")
        text = text.replace("integrações do Módulo 11.", "integrações dos Módulos 11 e 12.")
        text = text.replace("Módulo 11.", "Módulos 11 e 12.")
        for slug in tool_slugs:
            title_href = f'{slug}.html' if inside_dir else f'ferramentas/{slug}.html'
            mod_href = "../modulos/m12.html" if inside_dir else "modulos/m12.html"
            pattern = rf'(<article class="tool-card" id="ferramenta-{re.escape(slug)}".*?<div class="tool-module-links"><strong>Módulos relacionados</strong><div>)(.*?)(</div></div>)'
            def add_pill(m, mod_href=mod_href):
                links = m.group(2)
                if "m12.html" not in links:
                    links += f'<a class="pill" href="{mod_href}">M12</a>'
                return m.group(1) + links + m.group(3)
            text = re.sub(pattern, add_pill, text, count=1, flags=re.S)
        write(path, text)

    # Tool detail pages: update direct M11-only relationship where M12 is central.
    for slug in ["n8n", "apis-webhooks", "google-forms", "gmail", "google-calendar", "apps-script"]:
        path = ROOT / "ferramentas" / f"{slug}.html"
        if path.exists():
            text = read(path).replace("style.css?v=20260708-m11-tools", f"style.css?v={CSS_VERSION}")
            text = text.replace(
                '<a href="../modulos/m11.html">Módulo 11 - Agentes de IA, Skills e Automação Inteligente</a>',
                '<a href="../modulos/m11.html">Módulo 11 - Agentes de IA, Skills e Automação Inteligente</a><br><a href="../modulos/m12.html">Módulo 12 - Automação Inteligente com n8n, Pipelines, Skills e LLMs</a>',
            )
            text = text.replace("No Módulo 11,", "Nos Módulos 11 e 12,")
            write(path, text)


def update_trails() -> None:
    path = ROOT / "trilhas.html"
    text = read(path)
    if "Automação Inteligente e Agentes Aplicados" not in text:
        card = (
            '<div class="card"><h3>Automação Inteligente e Agentes Aplicados</h3>'
            '<p><b>Público:</b> participantes avançados, equipes técnicas, gestores de processos, empreendedores e grupos multiempresa</p>'
            '<p><b>Módulos:</b> <a class="pill" href="modulos/m1.html">M1</a><a class="pill" href="modulos/m2.html">M2</a><a class="pill" href="modulos/m11.html">M11</a><a class="pill" href="modulos/m12.html">M12</a></p><p><b>Carga horária:</b> 68h</p>'
            '<p>Trilha avançada para projetar workflows, skills, agentes, integrações, logs, guardrails e automações com n8n.</p></div>'
        )
        text = text.replace("</div></div></main>", card + "</div></div></main>", 1)
    text = text.replace("style.css?v=20260702-logo", f"style.css?v={CSS_VERSION}")
    write(path, text)


def update_css() -> None:
    path = ROOT / "assets" / "css" / "style.css"
    text = read(path)
    if ".module-card.m12" not in text:
        text = text.replace(".module-card.m11{border-color:#009A9A}", ".module-card.m11{border-color:#009A9A}.module-card.m12{border-color:#0B5AA6}")
    if ".module-full.module-m12" not in text:
        text = text.replace(".module-full.module-m10{--module-color:#6046A6;--module-soft:#F3EFFF}", ".module-full.module-m10{--module-color:#6046A6;--module-soft:#F3EFFF}\n.module-full.module-m12{--module-color:#0B5AA6;--module-soft:#EAF4FF}")
    if ".module-m12 .m12-cards" not in text:
        text += """
.module-m12 .m12-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:16px 0}
.module-m12 .m12-cards .card,.module-m12 .catalog-category{background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
.module-m12 .m12-pipeline{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.module-m12 .m12-pipeline span{background:#F8FBFD;border:1px solid var(--border);border-radius:999px;padding:7px 10px;font-weight:700;color:#234}
.module-m12 .m12-pipeline span:not(:last-child)::after{content:" →";color:var(--module-color);font-weight:800;margin-left:8px}
.module-m12 .m12-skills-grid{display:grid;grid-template-columns:1fr;gap:14px}
.module-m12 .m12-skill-card{border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff;box-shadow:var(--shadow)}
.module-m12 .m12-skill-card header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.module-m12 .skill-index{background:var(--module-color);color:#fff;border-radius:10px;padding:5px 8px;font-weight:800}
.module-m12 pre{background:#0F172A;color:#E2E8F0;padding:16px;border-radius:14px;overflow:auto;white-space:pre-wrap}
"""
    write(path, text)


def main() -> None:
    build_m12()
    svg_m12()
    add_m12_to_module_lists()
    update_concepts()
    update_tools()
    update_trails()
    update_css()


if __name__ == "__main__":
    main()
