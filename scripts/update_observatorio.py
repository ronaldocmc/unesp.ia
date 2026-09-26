"""Coleta fontes configuradas e prepara a fila de curadoria do Observatório unesp.IA.

O script nunca altera o acervo publicado. Novos registros são gravados em
assets/data/observatorio-candidatos.json para revisão humana.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "assets" / "data"
SOURCES_FILE = DATA / "observatorio-fontes.json"
PUBLISHED_FILE = DATA / "observatorio-conteudos.json"
CANDIDATES_FILE = DATA / "observatorio-candidatos.json"
USER_AGENT = "unesp.IA-Observatorio/1.0 (+https://ronaldocmc.github.io/unesp.ia/observatorio.html)"


def clean_text(value: str | None, limit: int = 560) -> str:
    text = re.sub(r"<[^>]+>", " ", html.unescape(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else f"{text[: limit - 1].rstrip()}…"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json, application/atom+xml, application/rss+xml, application/xml, text/xml"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.read()


def first_text(node: ET.Element, names: tuple[str, ...]) -> str:
    for name in names:
        found = node.find(name)
        if found is not None and found.text:
            return found.text.strip()
    return ""


def parse_feed(payload: bytes, source: dict[str, Any]) -> list[dict[str, Any]]:
    root = ET.fromstring(payload)
    items: list[dict[str, Any]] = []
    nodes = root.findall(".//item")
    atom = False
    if not nodes:
        nodes = root.findall(".//{http://www.w3.org/2005/Atom}entry")
        atom = True
    for node in nodes[:25]:
        if atom:
            title = first_text(node, ("{http://www.w3.org/2005/Atom}title",))
            summary = first_text(node, ("{http://www.w3.org/2005/Atom}summary", "{http://www.w3.org/2005/Atom}content"))
            published = first_text(node, ("{http://www.w3.org/2005/Atom}published", "{http://www.w3.org/2005/Atom}updated"))
            link_node = node.find("{http://www.w3.org/2005/Atom}link")
            link = link_node.get("href", "") if link_node is not None else ""
            authors = [clean_text(author.findtext("{http://www.w3.org/2005/Atom}name"), 120) for author in node.findall("{http://www.w3.org/2005/Atom}author")]
        else:
            title = first_text(node, ("title",))
            summary = first_text(node, ("description", "summary"))
            published = first_text(node, ("pubDate", "date", "{http://purl.org/dc/elements/1.1/}date"))
            link = first_text(node, ("link", "guid"))
            authors = []
        if title and link:
            items.append(normalize(source, title, link, published, summary, authors))
    return items


def date_parts(value: Any) -> str:
    try:
        parts = value["date-parts"][0]
        return "-".join(str(part).zfill(2) for part in (parts + [1, 1])[:3])
    except (KeyError, IndexError, TypeError):
        return ""


def parse_crossref(payload: bytes, source: dict[str, Any]) -> list[dict[str, Any]]:
    records = json.loads(payload).get("message", {}).get("items", [])
    items = []
    for record in records:
        title = clean_text(" ".join(record.get("title", [])), 300)
        link = record.get("URL") or (f"https://doi.org/{record['DOI']}" if record.get("DOI") else "")
        authors = [" ".join(filter(None, (author.get("given"), author.get("family")))) for author in record.get("author", [])]
        if title and link:
            items.append(normalize(source, title, link, date_parts(record.get("published")), record.get("abstract", ""), authors))
    return items


def restore_abstract(index: dict[str, list[int]] | None) -> str:
    if not index:
        return ""
    positions = [(position, word) for word, values in index.items() for position in values]
    return " ".join(word for _, word in sorted(positions))


def parse_openalex(payload: bytes, source: dict[str, Any]) -> list[dict[str, Any]]:
    records = json.loads(payload).get("results", [])
    items = []
    for record in records:
        location = record.get("primary_location") or {}
        link = location.get("landing_page_url") or record.get("id", "")
        authors = [entry.get("author", {}).get("display_name", "") for entry in record.get("authorships", [])]
        title = clean_text(record.get("display_name"), 300)
        if title and link:
            items.append(normalize(source, title, link, record.get("publication_date", ""), restore_abstract(record.get("abstract_inverted_index")), authors))
    return items


def normalize(source: dict[str, Any], title: str, link: str, published: str, summary: str, authors: list[str]) -> dict[str, Any]:
    collected = datetime.now(timezone.utc).isoformat(timespec="seconds")
    identity = hashlib.sha256(link.strip().encode("utf-8")).hexdigest()[:16]
    return {
        "id": identity,
        "status": "pendente",
        "tipo": source["categoria"],
        "titulo": clean_text(title, 300),
        "resumoOriginal": clean_text(summary),
        "dataPublicacao": clean_text(published, 40),
        "fonte": source["nome"],
        "fonteId": source["id"],
        "href": link.strip(),
        "autores": [name for name in authors if name][:12],
        "coletadoEm": collected,
        "revisao": "Pendente de curadoria humana"
    }


def main() -> None:
    configuration = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    published = json.loads(PUBLISHED_FILE.read_text(encoding="utf-8")).get("itens", [])
    previous = json.loads(CANDIDATES_FILE.read_text(encoding="utf-8")) if CANDIDATES_FILE.exists() else {"itens": []}
    known = {item.get("href") for item in [*published, *previous.get("itens", [])] if item.get("href")}
    collected = list(previous.get("itens", []))
    errors = []
    parsers = {"rss": parse_feed, "crossref": parse_crossref, "openalex": parse_openalex}

    for source in configuration.get("fontes", []):
        if not source.get("ativa"):
            continue
        try:
            parser = parsers[source["tipo"]]
            for item in parser(fetch(source["url"]), source):
                if item["href"] not in known:
                    collected.append(item)
                    known.add(item["href"])
        except Exception as exc:  # Registra falhas isoladas sem interromper outras fontes.
            errors.append({"fonte": source.get("id"), "erro": f"{type(exc).__name__}: {exc}"})

    output = {
        "geradoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(collected),
        "erros": errors,
        "itens": collected[-200:]
    }
    CANDIDATES_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Observatório: {len(collected)} candidatos; {len(errors)} fontes com erro.")


if __name__ == "__main__":
    main()
