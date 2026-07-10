#!/usr/bin/env python3
"""Build searchable document-tree JSON from the generated rules markdown.

Second stage of the content pipeline (vault --build_rules.py--> markdown
--build_srd.py--> document trees). One document tree per configured book; each
markdown heading becomes a section whose `body` is the prose directly under it
(children are their own sections). Hierarchy is carried by heading `level` and
the ancestor `path`, matching `$lib/reference/document-tree`.

  python3 tools/build_srd.py [--config tools/srd.config.json]

Output is generated — never hand-edit. Re-run after regenerating the rules or
editing the config. The emitted files must be listed in each pack's manifest
and mapped to `documentTreeSchema` by the game module (see docs/content-packs.md).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
EMPHASIS_RE = re.compile(r"[*_`]")
# The generated rules occasionally carry an OCR artifact from the source PDF:
# a heading line that runs on into a whole paragraph or inventory blob. Real
# headings are short (p99 ~83 chars); anything past this is demoted to body
# text — kept and searchable, but not polluting the TOC or section titles.
MAX_HEADING_LEN = 120
# [[Note#Heading|Label]] / [[Note|Label]] / [[Note]] -> display text
WIKILINK_RE = re.compile(r"\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]")

REPO_ROOT = Path(__file__).resolve().parent.parent


def clean_title(text: str) -> str:
    """Heading text as plain prose: resolve wikilinks to their label, drop emphasis."""
    text = WIKILINK_RE.sub(lambda m: (m.group(2) or m.group(1).split("#")[-1]).strip(), text)
    return EMPHASIS_RE.sub("", text).strip()


def slugify(text: str) -> str:
    text = EMPHASIS_RE.sub("", text).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "section"


def file_slug(source_dir: Path, path: Path) -> str:
    """Stable id prefix from a file's path within the document, keeping subfolders."""
    rel = path.relative_to(source_dir).with_suffix("")
    return "-".join(slugify(part) for part in rel.parts)


def collect_files(source_root: Path, exclude: set[str]) -> list[Path]:
    if not source_root.is_dir():
        sys.exit(f"source dir not found: {source_root}")
    # Sorted relative paths: numbered chapter files (00..20) precede the
    # Playbooks/ subfolder alphabetically, which is the reading order we want.
    files = [p for p in source_root.rglob("*.md") if p.stem not in exclude]
    return sorted(files, key=lambda p: str(p.relative_to(source_root)).lower())


def parse_file(path: Path, source_dir: Path, used_ids: set[str], warnings: list[str]) -> list[dict]:
    """Turn one markdown file into an ordered list of section dicts."""
    prefix = file_slug(source_dir, path)
    lines = path.read_text(encoding="utf-8").splitlines()

    sections: list[dict] = []
    # Heading stack of (level, title) for building each section's ancestor path.
    stack: list[tuple[int, str]] = []
    current: dict | None = None
    body: list[str] = []
    slug_counts: dict[str, int] = {}

    def flush() -> None:
        if current is not None:
            current["body"] = "\n".join(body).strip()
            sections.append(current)

    saw_heading = False
    for line in lines:
        m = HEADING_RE.match(line)
        if not m:
            if current is None:
                if line.strip():
                    # prose before the first heading — shouldn't happen in the
                    # generated rules (every file opens with an h1)
                    warnings.append(f"{path.name}: text before first heading dropped")
                continue
            body.append(line)
            continue

        title = clean_title(m.group(2))
        # Demote a pathologically long "heading" (OCR run-on) to body text,
        # unless it would be the file's opening line (nothing to attach it to).
        if len(title) > MAX_HEADING_LEN and current is not None:
            warnings.append(f"{path.name}: over-long heading demoted to body ({len(title)} chars)")
            body.append(line)
            continue

        flush()
        saw_heading = True
        level = len(m.group(1))

        # ancestor path: pop headings at or below this level, then read the stack
        while stack and stack[-1][0] >= level:
            stack.pop()
        section_path = [t for _, t in stack]
        stack.append((level, title))

        base = f"{prefix}--{slugify(title)}" if section_path else prefix
        n = slug_counts.get(base, 0)
        slug_counts[base] = n + 1
        sid = base if n == 0 else f"{base}-{n + 1}"
        if sid in used_ids:  # cross-file collision guard (defensive)
            k = 2
            while f"{sid}-{k}" in used_ids:
                k += 1
            sid = f"{sid}-{k}"
        used_ids.add(sid)

        current = {"id": sid, "title": title, "level": level, "path": section_path}
        body = []

    flush()
    if not saw_heading:
        warnings.append(f"{path.name}: no headings found; skipped")
    return sections


def build_document(doc: dict, rules_source: Path, warnings: list[str]) -> dict:
    source_dir = rules_source / doc["sourceDir"]
    visibility = doc.get("visibility", "player")
    exclude = set(doc.get("exclude", []))
    used_ids: set[str] = set()
    sections: list[dict] = []
    for path in collect_files(source_dir, exclude):
        for section in parse_file(path, source_dir, used_ids, warnings):
            if visibility != "player":
                section["visibility"] = visibility
            sections.append(section)
    return {"id": doc["id"], "title": doc["title"], "sections": sections}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", type=Path, default=REPO_ROOT / "tools" / "srd.config.json")
    args = ap.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    warnings: list[str] = []
    total_docs = 0
    total_sections = 0

    for pack in config["packs"]:
        pack_root = REPO_ROOT / pack["packRoot"]
        rules_source = REPO_ROOT / pack["rulesSource"]
        out_dir = pack_root / pack.get("outDir", "rules")
        out_dir.mkdir(parents=True, exist_ok=True)
        for doc in pack["documents"]:
            tree = build_document(doc, rules_source, warnings)
            out_path = out_dir / f"{doc['id']}.json"
            out_path.write_text(json.dumps(tree, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")
            rel = out_path.relative_to(REPO_ROOT)
            print(f"{rel}: {len(tree['sections'])} sections")
            total_docs += 1
            total_sections += len(tree["sections"])

    print(f"\n{total_docs} document(s), {total_sections} sections")
    if warnings:
        print(f"{len(warnings)} warnings:")
        for w in sorted(set(warnings)):
            print("  " + w)


if __name__ == "__main__":
    main()
