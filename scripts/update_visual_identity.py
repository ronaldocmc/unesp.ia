from __future__ import annotations

import html
import re
from pathlib import Path

from standardize_portal import standardize_portal


ROOT = Path(__file__).resolve().parents[1]
IMG_ROOT = ROOT / "assets" / "img"

MODULES = {
    1: {
        "title": "Compreender, usar e questionar",
        "subtitle": "Letramento em IA para decisões conscientes no cotidiano.",
        "nodes": ["Reconhecer IA", "Verificar respostas", "Usar com segurança"],
        "character": "maria",
        "character_name": "Maria",
        "guide": "Maria observa onde a IA aparece em sua rotina e aprende a usá-la com autonomia e segurança.",
        "color": "#0057A8",
        "soft": "#E8F2FF",
    },
    2: {
        "title": "Pensar antes de perguntar",
        "subtitle": "Prompts claros, contexto e avaliação crítica das respostas.",
        "nodes": ["Objetivo", "Contexto", "Critérios"],
        "character": "joao",
        "character_name": "João",
        "guide": "João transforma uma dúvida ampla em um pedido claro e depois compara a resposta com outras fontes.",
        "color": "#008C95",
        "soft": "#E6FAFA",
    },
    3: {
        "title": "Criar, revisar e comunicar",
        "subtitle": "Conteúdo com IA exige intenção, autoria e revisão humana.",
        "nodes": ["Ideia", "Produção", "Revisão"],
        "character": "ana",
        "character_name": "Ana",
        "guide": "Ana usa IA para explorar formatos, mas mantém decisões editoriais, autoria e checagem final.",
        "color": "#2F8F4E",
        "soft": "#ECF8EF",
    },
    4: {
        "title": "Dos dados ao resultado",
        "subtitle": "Modelos aprendem padrões, cometem erros e precisam ser avaliados.",
        "nodes": ["Dados", "Treinamento", "Avaliação"],
        "character": "carlos",
        "character_name": "Carlos",
        "guide": "Carlos acompanha o caminho dos dados e percebe como qualidade, viés e teste alteram o resultado.",
        "color": "#D98B00",
        "soft": "#FFF7E2",
    },
    5: {
        "title": "Da necessidade ao protótipo",
        "subtitle": "Uma solução útil começa pelo problema e termina com teste e documentação.",
        "nodes": ["Problema", "Protótipo", "Teste"],
        "character": "pedro",
        "character_name": "Pedro",
        "guide": "Pedro constrói uma solução pequena, testa com usuários e registra limites antes de ampliar o projeto.",
        "color": "#B51C35",
        "soft": "#FFF0F3",
    },
    6: {
        "title": "IA com propósito no negócio",
        "subtitle": "Produtividade, atendimento e dados precisam gerar valor responsável.",
        "nodes": ["Cliente", "Processo", "Indicador"],
        "character": "ana",
        "character_name": "Ana",
        "guide": "Ana avalia onde a IA economiza tempo sem perder qualidade, transparência e atenção ao cliente.",
        "color": "#6046A6",
        "soft": "#F3EFFF",
    },
    7: {
        "title": "Tecnologia a serviço do cidadão",
        "subtitle": "Gestão pública com transparência, proteção de dados e supervisão.",
        "nodes": ["Demanda", "Serviço", "Transparência"],
        "character": "carlos",
        "character_name": "Carlos",
        "guide": "Carlos usa dados para melhorar um serviço público e mantém critérios claros para explicar cada decisão.",
        "color": "#0072BC",
        "soft": "#E9F5FF",
    },
    8: {
        "title": "Ensinar com mediação humana",
        "subtitle": "A IA apoia planejamento, materiais e feedback, sem substituir o educador.",
        "nodes": ["Planejar", "Adaptar", "Avaliar"],
        "character": "joao",
        "character_name": "João",
        "guide": "João compara materiais gerados por IA e escolhe o que realmente favorece aprendizagem e inclusão.",
        "color": "#2F8F4E",
        "soft": "#ECF8EF",
    },
    9: {
        "title": "Informação não é diagnóstico",
        "subtitle": "IA pode apoiar organização e compreensão, mas não substitui profissionais.",
        "nodes": ["Informar", "Cuidar", "Procurar ajuda"],
        "character": "maria",
        "character_name": "Maria",
        "guide": "Maria usa IA para organizar perguntas e compreender termos, sem compartilhar dados sensíveis nem se automedicar.",
        "color": "#B51C35",
        "soft": "#FFF0F3",
    },
    10: {
        "title": "Pesquisar com integridade",
        "subtitle": "Fontes, método, autoria e rastreabilidade orientam o uso acadêmico da IA.",
        "nodes": ["Buscar", "Analisar", "Referenciar"],
        "character": "pedro",
        "character_name": "Pedro",
        "guide": "Pedro usa IA para organizar a leitura, mas consulta os textos originais e registra como a ferramenta foi usada.",
        "color": "#6046A6",
        "soft": "#F3EFFF",
    },
}

ASSOCIATED_LINKS = {
    "Agentes": "agentes-ia.html",
    "Algoritmo": "algoritmo.html",
    "Aprendizado supervisionado": "machine-learning.html",
    "Automação": "automacao.html",
    "Bolhas de informação": "sistemas-recomendacao.html",
    "Chatbots": "chatbots.html",
    "Classificação": "classificacao.html",
    "Contexto": "prompt-engineering.html",
    "Critérios": "prompt-engineering.html",
    "Dados": "dados.html",
    "Deep Learning": "deep-learning.html",
    "Design": "canva-ia.html",
    "Documentos": "notebooklm.html",
    "Fluxo de trabalho": "automacao.html",
    "Fontes": "fontes-confiaveis.html",
    "Fontes confiáveis": "fontes-confiaveis.html",
    "Imagem com IA": "ia-generativa.html",
    "Indicadores": "power-bi.html",
    "LLM": "llm.html",
    "Low-code": "automacao.html",
    "Machine Learning": "machine-learning.html",
    "Matriz de confusão": "classificacao.html",
    "Modelo": "modelo.html",
    "No-code": "automacao.html",
    "Padrões": "modelo.html",
    "Personalização": "sistemas-recomendacao.html",
    "Pesquisa": "perplexity.html",
    "Previsão": "regressao.html",
    "Prompt": "prompt.html",
    "Python": "google-colab.html",
    "RAG": "rag.html",
    "Resumo": "resumo.html",
    "Segmentação": "agrupamento.html",
    "Síntese": "resumo.html",
    "Supervisão humana": "explicabilidade.html",
    "Tomada de decisão": "power-bi.html",
    "Transparência": "explicabilidade.html",
    "Verificação": "fontes-confiaveis.html",
}

def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def logo_svg() -> str:
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 170" role="img" aria-labelledby="title desc">
<title id="title">unesp.IA</title><desc id="desc">Cérebro conectado a circuitos e nome unesp.IA</desc>
<g fill="none" stroke="#08769A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
<path d="M78 28c-20 0-35 15-35 35-17 5-27 19-27 36 0 16 9 29 23 35 5 20 22 31 41 27 14 10 36 4 42-12V45c-5-13-18-20-31-17-4-1-8-1-13 0Z"/>
<path d="M70 50c16-3 27 7 27 22M42 73c14-8 30-3 34 10M39 112c14-8 30-4 36 9M78 145c-2-17 7-29 22-31M91 91c13 0 24 8 31 20"/>
<path d="M123 58h34l17-17h24M123 82h58l19-19h30M123 106h73l18 18h28M123 130h42l19 19h29"/>
<circle cx="202" cy="41" r="7"/><circle cx="234" cy="63" r="7"/><circle cx="246" cy="124" r="7"/><circle cx="217" cy="149" r="7"/>
</g>
<text x="278" y="98" font-family="Arial,Helvetica,sans-serif" font-size="70" font-weight="800"><tspan fill="#111111">unesp</tspan><tspan fill="#20549A">.IA</tspan></text>
<text x="281" y="132" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="700" fill="#08769A">Inteligência Artificial para Todos</text>
</svg>"""


def fitted_font_size(text: str, max_width: int, preferred: int, minimum: int) -> int:
    estimated = max(1, len(text)) * preferred * 0.56
    if estimated <= max_width:
        return preferred
    return max(minimum, int(preferred * max_width / estimated))


def wrap_card_label(label: str, max_chars: int = 16) -> list[str]:
    words = label.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > max_chars:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:2]


def module_svg(number: int, data: dict[str, object]) -> str:
    color = str(data["color"])
    soft = str(data["soft"])
    nodes = list(data["nodes"])
    title = str(data["title"])
    subtitle = str(data["subtitle"])
    title_size = fitted_font_size(title, 720, 41, 29)
    subtitle_size = fitted_font_size(subtitle, 720, 23, 18)
    cards = []
    for index, label in enumerate(nodes):
        x = 425 + index * 245
        lines = wrap_card_label(str(label))
        label_size = fitted_font_size(max(lines, key=len), 175, 21, 17)
        text_y = 314 if len(lines) == 1 else 305
        tspans = "".join(
            f'<tspan x="{x + 108}" y="{text_y + line_index * 25}">{html.escape(line)}</tspan>'
            for line_index, line in enumerate(lines)
        )
        cards.append(
            f'<rect x="{x}" y="245" width="216" height="126" rx="22" fill="#fff" stroke="{color}" stroke-width="3"/>'
            f'<circle cx="{x + 108}" cy="276" r="13" fill="{color}"/>'
            f'<text text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="{label_size}" font-weight="700" fill="#173247">{tspans}</text>'
            f'<path d="M{x + 46} 349h124" stroke="{color}" stroke-width="5" stroke-linecap="round" opacity=".28"/>'
        )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" role="img" '
        f'aria-label="Ilustração didática do módulo {number}">'
        f'<rect width="1200" height="500" fill="{soft}"/>'
        f'<circle cx="180" cy="230" r="128" fill="{color}" opacity=".12"/>'
        f'<circle cx="180" cy="230" r="94" fill="#fff" stroke="{color}" stroke-width="7"/>'
        f'<text x="180" y="216" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="700" fill="{color}">MÓDULO</text>'
        f'<text x="180" y="286" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="78" font-weight="800" fill="{color}">{number}</text>'
        f'<text x="390" y="105" font-family="Arial,Helvetica,sans-serif" font-size="{title_size}" font-weight="800" fill="#003B71">{html.escape(title)}</text>'
        f'<text x="390" y="153" font-family="Arial,Helvetica,sans-serif" font-size="{subtitle_size}" fill="#38505F">{html.escape(subtitle)}</text>'
        f'<path d="M286 230C350 230 350 308 414 308" fill="none" stroke="{color}" stroke-width="5" stroke-linecap="round"/>'
        + "".join(cards)
        + f'<circle cx="1070" cy="86" r="9" fill="{color}"/><circle cx="1110" cy="118" r="6" fill="{color}" opacity=".55"/>'
        f'<path d="M1040 420h96M1088 372v96" stroke="{color}" stroke-width="8" stroke-linecap="round" opacity=".28"/>'
        '<text x="1000" y="474" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800"><tspan fill="#111">unesp</tspan><tspan fill="#20549A">.IA</tspan></text>'
        "</svg>"
    )


def generate_assets() -> None:
    write(IMG_ROOT / "logo-unesp-ia.svg", logo_svg())
    for number, data in MODULES.items():
        write(IMG_ROOT / "modulos" / f"m{number}-visual.svg", module_svg(number, data))


def relative_prefix(path: Path) -> str:
    depth = len(path.relative_to(ROOT).parts) - 1
    return "../" * depth


def active_html_files() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("*.html")
        if "modulos_v3_original" not in path.parts
    ]


def brand_html(prefix: str) -> str:
    return (
        f'<a class="brand" href="{prefix}index.html"><img class="brand-logo" '
        f'src="{prefix}assets/img/logo-unesp-ia.svg" alt="unesp.IA">'
        "<small>Coleção Editorial | Portal Didático dos Participantes</small></a>"
    )


def update_branding() -> None:
    topbar_pattern = re.compile(
        r'<(?:div|a) class="brand"[^>]*>.*?</(?:div|a)>(?=\s*<div class="nav">)',
        flags=re.S,
    )
    sidebar_pattern = re.compile(
        r'<(?:div|a) class="brand"[^>]*>(?:UNESP|unesp)\.IA\s*<small>.*?</small></(?:div|a)>',
        flags=re.S,
    )
    for path in active_html_files():
        text = path.read_text(encoding="utf-8")
        prefix = relative_prefix(path)
        text = topbar_pattern.sub(brand_html(prefix), text, count=1)
        text = sidebar_pattern.sub(brand_html(prefix), text, count=1)
        text = text.replace("UNESP.IA", "unesp.IA")
        path.write_text(text, encoding="utf-8")


def module_visual_html(number: int, data: dict[str, object]) -> str:
    character = str(data["character"])
    character_name = str(data["character_name"])
    return (
        '<section class="module-visual" aria-label="Apoio visual do módulo">'
        "<figure>"
        f'<img src="../assets/img/modulos/m{number}-visual.svg" alt="Mapa visual do módulo {number}: {html.escape(str(data["title"]))}">'
        "</figure>"
        '<aside class="character-guide">'
        f'<img src="../assets/img/personagens/{character}.png" alt="Personagem {character_name}">'
        f"<h3>{character_name} acompanha este módulo</h3>"
        f"<p>{html.escape(str(data['guide']))}</p>"
        f'<a class="pill" href="../personagens/{character}.html">Conhecer {character_name}</a>'
        "</aside></section>"
    )


def update_modules() -> None:
    for number, data in MODULES.items():
        path = ROOT / "modulos" / f"m{number}.html"
        text = path.read_text(encoding="utf-8")
        text = re.sub(r'<section class="module-visual".*?</section>\s*', "", text, flags=re.S)
        visual = module_visual_html(number, data)
        text = re.sub(
            r'(<div class="mini-toc">.*?</div>)',
            r"\1" + visual,
            text,
            count=1,
            flags=re.S,
        )
        path.write_text(text, encoding="utf-8")


def concept_page(title: str, definition: str, examples: list[str], associated: list[str]) -> str:
    example_html = "".join(f"<li>{html.escape(item)}</li>" for item in examples)
    links = "".join(
        f'<a class="pill" href="{ASSOCIATED_LINKS[item]}">{html.escape(item)}</a>'
        for item in associated
    )
    return (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{html.escape(title)} | unesp.IA</title>"
        '<link rel="stylesheet" href="../assets/css/style.css"><script src="../assets/js/search.js"></script>'
        f'</head><body><div class="topbar">{brand_html("../")}<div class="nav">'
        '<a href="../index.html">Início</a><a href="../modulos.html">Módulos</a>'
        '<a href="../trilhas.html">Trilhas</a><a href="../conceitos.html">Conceitos</a>'
        '<a href="../ferramentas.html">Ferramentas</a><a href="../laboratorios.html">Laboratórios</a>'
        '<a href="../materiais.html">Materiais</a><a href="../personagens.html">Personagens</a>'
        '<a href="../equipe.html">Equipe</a><a href="../mapa-conhecimento.html">Mapa</a>'
        '</div></div><main><div class="container content" id="top">'
        '<div class="breadcrumbs"><a href="../index.html">Início</a> / '
        f'<a href="../conceitos.html">Conceitos</a> / {html.escape(title)}</div>'
        f"<h1>{html.escape(title)}</h1><div class=\"callout\"><b>Definição simples:</b> {html.escape(definition)}</div>"
        f"<h2>Como reconhecer</h2><ul>{example_html}</ul>"
        "<div class=\"callout practice\"><h3>Pergunta de estudo</h3>"
        f"<p>Em qual situação do curso o conceito de {html.escape(title.lower())} ajuda a compreender ou avaliar melhor uma resposta de IA?</p></div>"
        f'<h2>Conceitos associados</h2><div class="concept-related-links">{links}</div>'
        '</div></main><a class="backtop" href="#top">Topo</a>'
        '<footer class="footer"><span class="footer-primary">unesp.IA - Inteligência Artificial para Todos | '
        'Programa de Extensão Universitária | Coleção Editorial</span>'
        '<span class="footer-unit">Faculdade de Ciências e Tecnologia de Presidente Prudente - FCT/UNESP</span>'
        '<span class="footer-institution">Departamento de Matemática e Computação</span></footer></body></html>'
    )


def create_missing_concepts() -> None:
    write(
        ROOT / "conceitos" / "chatbots.html",
        concept_page(
            "Chatbots",
            "Sistemas de conversa que recebem mensagens e produzem respostas por regras, busca de informação ou modelos de linguagem.",
            [
                "Atendimento automatizado em sites e aplicativos.",
                "Assistentes que explicam conteúdos e ajudam a organizar tarefas.",
                "Bots que encaminham uma solicitação para atendimento humano.",
            ],
            ["LLM", "Prompt", "Supervisão humana"],
        ),
    )
    write(
        ROOT / "conceitos" / "resumo.html",
        concept_page(
            "Resumo e síntese",
            "Processo de reduzir um conteúdo preservando ideias centrais, contexto e informações essenciais.",
            [
                "Resumo de um artigo para orientar a leitura inicial.",
                "Síntese comparativa de documentos com pontos de concordância e diferença.",
                "Lista de conceitos-chave acompanhada das fontes originais.",
            ],
            ["LLM", "Fontes confiáveis", "Supervisão humana"],
        ),
    )
    write(
        ROOT / "conceitos" / "fontes-confiaveis.html",
        concept_page(
            "Fontes confiáveis",
            "Materiais cuja autoria, data, instituição, método e contexto podem ser verificados.",
            [
                "Páginas institucionais e documentos oficiais.",
                "Artigos científicos consultados no texto original.",
                "Dados acompanhados de metodologia, período e responsável.",
            ],
            ["Verificação", "Pesquisa", "Resumo"],
        ),
    )


def create_characters_index() -> None:
    characters = [
        (
            "maria",
            "Maria",
            "72 anos · Participante iniciante",
            "Está começando a usar IA para ganhar autonomia digital, comunicar-se com segurança e cuidar melhor da rotina.",
        ),
        (
            "joao",
            "João",
            "Professor",
            "Explora a IA para planejar aulas, criar materiais didáticos e acompanhar a aprendizagem dos estudantes.",
        ),
        (
            "carlos",
            "Carlos",
            "Empreendedor",
            "Aplica IA na divulgação de produtos, no atendimento a clientes e na organização do dia a dia do negócio.",
        ),
        (
            "ana",
            "Ana",
            "Servidora pública",
            "Utiliza IA para apoiar o atendimento ao cidadão, produzir documentos e analisar indicadores municipais.",
        ),
        (
            "pedro",
            "Pedro",
            "Pesquisador",
            "Recorre à IA para pesquisar referências, analisar dados e comunicar resultados acadêmicos com clareza.",
        ),
    ]
    cards = []
    for slug, name, profile, description in characters:
        cards.append(
            f'<article class="card character-card" id="{slug}">'
            '<figure class="character-portrait">'
            f'<img src="../assets/img/personagens/{slug}.png" alt="Ilustração de {name}">'
            '</figure><div class="character-content">'
            f'<h2>{name}</h2><span class="character-role">{profile}</span>'
            f'<p>{description}</p><a class="character-link" href="{slug}.html">'
            f'Conhecer {name} <span aria-hidden="true">→</span></a></div></article>'
        )
    page = (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Personagens | unesp.IA</title>'
        '<link rel="stylesheet" href="../assets/css/style.css?v=20260630">'
        '<script src="../assets/js/search.js"></script></head>'
        '<body class="characters-page"><div class="topbar" id="top">'
        f'{brand_html("../")}<div class="nav"><a href="../index.html">Início</a>'
        '<a href="../modulos.html">Módulos</a><a href="../trilhas.html">Trilhas</a>'
        '<a href="../conceitos.html">Conceitos</a><a href="../ferramentas.html">Ferramentas</a>'
        '<a href="../laboratorios.html">Laboratórios</a><a href="../materiais.html">Materiais</a>'
        '<a href="../personagens.html" aria-current="page">Personagens</a>'
        '<a href="../equipe.html">Equipe</a>'
        '<a href="../mapa-conhecimento.html">Mapa</a></div></div><main>'
        '<div class="container characters-container"><header class="characters-hero">'
        '<span class="characters-eyebrow">Aprendizagem com histórias</span>'
        '<h1>Personagens da Coleção</h1>'
        '<p>Personagens lúdicos e recorrentes aproximam os conteúdos de situações reais '
        'e ajudam a criar vínculo com os participantes.</p></header>'
        f'<div class="characters-grid">{"".join(cards)}</div></div></main>'
        '<a class="backtop" href="#top">Topo</a>'
        '<footer class="footer"><span class="footer-primary">unesp.IA - Inteligência Artificial para Todos | '
        'Programa de Extensão Universitária | Coleção Editorial</span>'
        '<span class="footer-unit">Faculdade de Ciências e Tecnologia de Presidente Prudente - FCT/UNESP</span>'
        '<span class="footer-institution">Departamento de Matemática e Computação</span></footer></body></html>'
    )
    write(ROOT / "personagens" / "index.html", page)

    legacy = ROOT / "personagens_v5" / "index.html"
    if legacy.exists():
        text = legacy.read_text(encoding="utf-8")
        for slug, *_ in characters:
            text = text.replace(
                f'../img/personagens/{slug}.svg',
                f'../assets/img/personagens/{slug}.png',
            )
        legacy.write_text(text, encoding="utf-8")


def update_associated_concepts() -> None:
    pattern = re.compile(
        r'(<p><b>Conceitos associados:</b>)(.*?)(</p>)',
        flags=re.S,
    )
    span_pattern = re.compile(r'<span class="pill">(.*?)</span>')
    for path in (ROOT / "conceitos").glob("*.html"):
        text = path.read_text(encoding="utf-8")

        def replace_block(match: re.Match[str]) -> str:
            body = match.group(2)
            body = re.sub(
                r'^\s*<span class="concept-related-links">(.*)</span>\s*$',
                r"\1",
                body,
                flags=re.S,
            )

            def replace_span(span: re.Match[str]) -> str:
                label = html.unescape(span.group(1)).strip()
                href = ASSOCIATED_LINKS.get(label)
                if not href:
                    return span.group(0)
                return f'<a class="pill" href="{href}">{html.escape(label)}</a>'

            linked = span_pattern.sub(replace_span, body)
            return match.group(1) + '<span class="concept-related-links">' + linked + "</span>" + match.group(3)

        text = pattern.sub(replace_block, text)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    generate_assets()
    create_missing_concepts()
    create_characters_index()
    update_modules()
    update_associated_concepts()
    update_branding()
    standardize_portal()


if __name__ == "__main__":
    main()
