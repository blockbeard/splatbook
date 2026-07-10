#!/usr/bin/env python3
"""Build the clean rules snapshot from the Stonetop Obsidian vault.

One-way transformation (vault = source of truth, output = derived):
  - copies Book I / Book II markdown (and Playbooks/*.md, excluding data/)
  - strips art & PDF embeds (no license to redistribute art; CC BY-SA covers text)
  - remaps page-anchor links [[Note#^pNNN|label]] to section links [[Note#Heading|label]]
  - removes ^pNNN block anchors
  - collapses leftover blank runs

Usage:
  python3 tools/build_rules.py --vault /path/to/StonetopVault --out content/stonetop/rules

Re-run whenever the vault changes; never hand-edit the output.
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

SOURCE_DIRS = ["Book I Stonetop", "Book II The Wider World"]
EXCLUDE_DIR_NAMES = {"data", "images", ".obsidian", ".trash"}

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
PAGE_ANCHOR_LINE_RE = re.compile(r"^\s*\^p\d+[a-z]?\s*$")
TRAILING_ANCHOR_RE = re.compile(r"\s*\^p\d+[a-z]?\s*$")
EMBED_RE = re.compile(r"!\[\[[^\]]+?\.(pdf|png|jpe?g|webp|gif|bmp|svg)(\|[^\]]*)?\]\]", re.I)
LINK_RE = re.compile(r"\[\[([^\]#|]+?)#(\^p\d+[a-z]?)((?:\\)?\|[^\]]*)?\]\]")
ANY_LINK_RE = re.compile(r"\[\[([^\]#|]+)(#([^\]|]+))?(\|[^\]]*)?\]\]")


def collect_files(vault: Path) -> list[Path]:
    files = []
    for src in SOURCE_DIRS:
        base = vault / src
        if not base.is_dir():
            sys.exit(f"source dir not found: {base}")
        for p in sorted(base.rglob("*.md")):
            if any(part in EXCLUDE_DIR_NAMES for part in p.relative_to(vault).parts):
                continue
            files.append(p)
    return files


def build_anchor_maps(files: list[Path]) -> tuple[dict, dict, list[str]]:
    """Per note basename: anchor -> heading text; also heading sets per note."""
    anchor_map: dict[str, dict[str, str | None]] = {}
    headings_map: dict[str, list[str]] = {}
    warnings: list[str] = []
    for path in files:
        name = path.stem
        lines = path.read_text(encoding="utf-8").splitlines()
        headings: list[str] = []
        current: str | None = None
        amap: dict[str, str | None] = {}
        for idx, line in enumerate(lines):
            m = HEADING_RE.match(line)
            if m:
                current = m.group(2)
                headings.append(current)
                continue
            for am in re.finditer(r"\^(p\d+[a-z]?)\b", line):
                anchor = am.group(1)
                # anchors sitting right before a heading belong to the section they introduce
                mapped = current
                if PAGE_ANCHOR_LINE_RE.match(line):
                    for nxt in lines[idx + 1 : idx + 3]:
                        if not nxt.strip():
                            continue
                        hm = HEADING_RE.match(nxt)
                        if hm:
                            mapped = hm.group(2)
                        break
                amap[anchor] = mapped
                if mapped and headings.count(mapped) > 1:
                    warnings.append(f"{name}: ^{anchor} maps to duplicated heading '{mapped}'")
        if name in anchor_map:
            warnings.append(f"duplicate note basename: {name} ({path})")
        anchor_map[name] = amap
        headings_map[name] = headings
    return anchor_map, headings_map, warnings


def transform(text: str, anchor_map: dict, warnings: list[str], src_name: str) -> str:
    # 1. strip art/PDF embeds (bare or inside callout quotes)
    lines_in = text.splitlines()
    lines: list[str] = []
    for line in lines_in:
        if EMBED_RE.search(line):
            stripped = EMBED_RE.sub("", line).strip()
            if stripped in {"", ">", ">-"}:
                continue
            line = EMBED_RE.sub("", line)
        lines.append(line)

    # 2. drop callout headers left with no body (e.g. the printable-playbook wrapper)
    out: list[str] = []
    for i, line in enumerate(lines):
        if re.match(r"^>\s*\[!\w+\][+-]?\s*", line):
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if not nxt.lstrip().startswith(">"):
                continue
        out.append(line)
    lines = out

    # 3. remap page-anchor links, then strip anchors
    def repl(m: re.Match) -> str:
        target, anchor = m.group(1).strip().rstrip("\\"), m.group(2)[1:]
        pipe = m.group(3) or ""  # preserves \| escaping inside tables
        heading = anchor_map.get(target.split("/")[-1], {}).get(anchor)
        if heading:
            return f"[[{target}#{heading}{pipe}]]"
        if target.split("/")[-1] not in anchor_map:
            warnings.append(f"{src_name}: link to unknown note [[{target}#^{anchor}]]")
        else:
            warnings.append(f"{src_name}: anchor ^{anchor} not found in [[{target}]]; fragment dropped")
        return f"[[{target}{pipe}]]"

    text = "\n".join(lines)
    text = LINK_RE.sub(repl, text)
    kept: list[str] = []
    for line in text.splitlines():
        if PAGE_ANCHOR_LINE_RE.match(line):
            continue
        kept.append(TRAILING_ANCHOR_RE.sub("", line) if TRAILING_ANCHOR_RE.search(line) else line)
    text = "\n".join(kept)

    # 4. collapse 3+ blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def normalize_heading(text: str) -> str:
    """Match Obsidian's fuzziness: formatting markers are ignored in heading links."""
    return re.sub(r"[*_`]", "", text).strip().lower()


def verify(out_dir: Path) -> list[str]:
    problems: list[str] = []
    notes: dict[str, set[str]] = {}
    for p in out_dir.rglob("*.md"):
        heads = {normalize_heading(m.group(2)) for m in map(HEADING_RE.match, p.read_text(encoding="utf-8").splitlines()) if m}
        notes[p.stem] = heads
    for p in sorted(out_dir.rglob("*.md")):
        for m in ANY_LINK_RE.finditer(p.read_text(encoding="utf-8")):
            target = m.group(1).strip().rstrip("\\").split("/")[-1]
            frag = m.group(3).rstrip("\\") if m.group(3) else None
            if target not in notes:
                problems.append(f"{p.stem}: unresolved note [[{target}]]")
            elif frag and not frag.startswith("^") and normalize_heading(frag) not in notes[target]:
                problems.append(f"{p.stem}: unresolved heading [[{target}#{frag}]]")
            elif frag and frag.startswith("^"):
                problems.append(f"{p.stem}: residual block anchor link [[{target}#{frag}]]")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    files = collect_files(args.vault)
    anchor_map, _headings, warnings = build_anchor_maps(files)

    written: set[Path] = set()
    for path in files:
        rel = path.relative_to(args.vault)
        dest = args.out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(transform(path.read_text(encoding="utf-8"), anchor_map, warnings, path.stem), encoding="utf-8")
        written.add(dest.resolve())
    if args.out.exists():
        for stray in sorted(p for p in args.out.rglob("*.md") if p.resolve() not in written):
            warnings.append(f"stray output file (source removed?): {stray} — delete manually")

    problems = verify(args.out)
    print(f"{len(files)} notes written to {args.out}")
    if warnings:
        print(f"\n{len(warnings)} warnings:")
        for w in sorted(set(warnings)):
            print("  " + w)
    if problems:
        print(f"\n{len(problems)} link problems:")
        for pr in sorted(set(problems))[:50]:
            print("  " + pr)
        sys.exit(1)
    print("all output links resolve")


if __name__ == "__main__":
    main()
