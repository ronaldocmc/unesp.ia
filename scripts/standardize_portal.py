from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

# Each translation is added only once per page. Product names stay unchanged.
TERMS = [
    (r"\bMachine Learning\b(?!\s*\()", "Machine Learning (Aprendizado de Máquina)", "Aprendizado de Máquina"),
    (r"\bDeep Learning\b(?!\s*\()", "Deep Learning (Aprendizado Profundo)", "Aprendizado Profundo"),
    (r"\bPrompt Engineering\b(?!\s*\()", "Prompt Engineering (Engenharia de Prompts)", "Engenharia de Prompts"),
    (r"\bNatural Language Processing\b(?!\s*\()", "Natural Language Processing (Processamento de Linguagem Natural)", "Processamento de Linguagem Natural"),
    (r"\bComputer Vision\b(?!\s*\()", "Computer Vision (Visão Computacional)", "Visão Computacional"),
    (r"\bLarge Language Models\b(?!\s*\()", "Large Language Models (Modelos de Linguagem de Grande Escala)", "Modelos de Linguagem de Grande Escala"),
    (r"\bLarge Language Model\b(?!\s*\()", "Large Language Model (Modelo de Linguagem de Grande Escala)", "Modelo de Linguagem de Grande Escala"),
    (r"\bbrainstorming\b(?!\s*\()", "brainstorming (tempestade de ideias)", "tempestade de ideias"),
    (r"\bstorytelling\b(?!\s*\()", "storytelling (narrativa)", "storytelling (narrativa)"),
    (r"\bworkflows\b(?!\s*\()", "workflows (fluxos de trabalho)", "fluxos de trabalho"),
    (r"\bworkflow\b(?!\s*\()", "workflow (fluxo de trabalho)", "workflow (fluxo de trabalho)"),
    (r"\bdashboards\b(?!\s*\()", "dashboards (painéis de indicadores)", "painéis de indicadores"),
    (r"\bdashboard\b(?!\s*\()", "dashboard (painel de indicadores)", "dashboard (painel de indicadores)"),
    (r"\bfeedback\b(?!\s*\()", "feedback (retorno)", "feedback (retorno)"),
    (r"\bno-code\b(?!\s*\()", "no-code (sem código)", "no-code (sem código)"),
    (r"\blow-code\b(?!\s*\()", "low-code (pouco código)", "low-code (pouco código)"),
    (r"\bdatasets\b(?!\s*\()", "datasets (conjuntos de dados)", "conjuntos de dados"),
    (r"\bdataset\b(?!\s*\()", "dataset (conjunto de dados)", "dataset (conjunto de dados)"),
    (r"\bchatbots\b(?!\s*\()", "chatbots (assistentes conversacionais)", "assistentes conversacionais"),
    (r"\bchatbot\b(?!\s*\()", "chatbot (assistente conversacional)", "chatbot (assistente conversacional)"),
    (r"\bdeepfakes\b(?!\s*\()", "deepfakes (conteúdos sintéticos falsificados)", "conteúdos sintéticos falsificados"),
    (r"\bdeepfake\b(?!\s*\()", "deepfake (conteúdo sintético falsificado)", "deepfake (conteúdo sintético falsificado)"),
    (r"\bfake news\b(?!\s*\()", "fake news (notícias falsas)", "fake news (notícias falsas)"),
    (r"\bquizzes\b(?!\s*\()", "quizzes (questionários)", "quizzes (questionários)"),
    (r"\bquiz\b(?!\s*\()", "quiz (questionário)", "quiz (questionário)"),
    (r"\bprompts\b(?!\s*\()", "prompts (instruções para a IA)", "prompts (instruções para a IA)"),
    (r"\bprompt\b(?!\s*\()", "prompt (instrução para a IA)", "prompt (instrução para a IA)"),
    (r"\bfine-tuning\b(?!\s*\()", "fine-tuning (ajuste fino)", "fine-tuning (ajuste fino)"),
    (r"\boverfitting\b(?!\s*\()", "overfitting (sobreajuste)", "overfitting (sobreajuste)"),
    (r"\bunderfitting\b(?!\s*\()", "underfitting (subajuste)", "underfitting (subajuste)"),
    (r"\bopen source\b(?!\s*\()", "open source (código aberto)", "open source (código aberto)"),
]


def standardize_body(body: str) -> str:
    fragments = re.split(r"(<[^>]+>)", body)
    skipped_tag: str | None = None
    seen = {marker: replacement.casefold() in body.casefold() for _, replacement, marker in TERMS}

    for index, fragment in enumerate(fragments):
        if fragment.startswith("<"):
            tag = re.match(r"</?\s*([a-z0-9]+)", fragment, re.I)
            if tag:
                name = tag.group(1).lower()
                if name in {"script", "style"}:
                    skipped_tag = None if fragment.startswith("</") else name
            if not skipped_tag:
                def translate_attribute(match: re.Match[str]) -> str:
                    value = match.group(2)
                    for pattern, replacement, marker in TERMS:
                        if seen[marker]:
                            continue
                        value, count = re.subn(pattern, replacement, value, count=1, flags=re.I)
                        if count:
                            seen[marker] = True
                    return match.group(1) + value + match.group(3)

                fragment = re.sub(
                    r'(\b(?:placeholder|aria-label)=")([^"]*)(")',
                    translate_attribute,
                    fragment,
                    flags=re.I,
                )
                fragments[index] = fragment
            continue
        if skipped_tag or not fragment.strip():
            continue
        for pattern, replacement, marker in TERMS:
            if seen[marker]:
                continue
            updated, count = re.subn(pattern, replacement, fragment, count=1, flags=re.I)
            if count:
                fragment = updated
                seen[marker] = True
        fragments[index] = fragment
    return "".join(fragments)


def standardize_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"(<body\b[^>]*>)(.*)(</body>)", text, flags=re.I | re.S)
    if not match:
        return
    body = standardize_body(match.group(2))
    updated = text[: match.start()] + match.group(1) + body + match.group(3) + text[match.end() :]
    path.write_text(updated, encoding="utf-8")


def active_html_files() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("*.html")
        if "modulos_v3_original" not in path.parts
    ]


def standardize_portal() -> None:
    for path in active_html_files():
        standardize_file(path)


if __name__ == "__main__":
    standardize_portal()
