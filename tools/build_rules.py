#!/usr/bin/env python3
"""Build the clean rules snapshot from a game's Obsidian vault.

One-way transformation (vault = source of truth, output = derived):
  - copies the config's sourceDirs markdown, minus excluded dirs/files
  - optionally truncates a file at a named heading (excluded appendix material),
    appending a configured replacement note
  - strips art & PDF embeds (no license to redistribute art)
  - remaps page-anchor links [[Note#^pNNN|label]] to section links [[Note#Heading|label]]
  - removes ^pNNN block anchors
  - collapses leftover blank runs

Usage:
  python3 tools/build_rules.py --vault /path/to/Vault --out content/<game>/rules \
      --config tools/rules.<game>.json

Config keys (see tools/rules.stonetop.json):
  sourceDirs        vault-relative dirs to copy (required)
  excludeDirNames   directory names skipped anywhere in the tree
  excludeFiles      vault-relative .md paths to skip entirely
  truncateAtHeading vault-relative path -> {"heading": exact heading line,
                    "replacement": note appended in place of the cut tail}.
                    Runs at read time, so cut headings are not link targets.
  stripCallouts     callout types (e.g. "hmw-nav") whose whole block is removed
  stripCalloutTitles callout *inline titles* (e.g. "Splatbook Note") whose whole
                    block is removed — the dedupe guard for notes that live in
                    this config's `insertions` but may linger in the vault
  linkRewrites      "Note#Fragment" (as written in the link) -> new "Note" or
                    "Note#Fragment" target, or null to degrade the link to its
                    label text. Applied before verification.
  insertions        vault-relative path -> [{"after": substring of an existing
                    line, "markdown": block to insert after it}] — pack-authored
                    additions (Splatbook Notes) that must NOT live in the shared
                    vault, which other importers also read
  keepImages        vault image src -> served URL. Art we own (hand-authored
                    diagrams): the <img>/markdown reference survives with its
                    src rewritten instead of being stripped
  demoteHeadingsToBold  exact heading texts rendered as **bold** body text
                    instead of headings (the book's "Component:" x40)
  preserveLineBreaks vault-relative paths whose single newlines are meaningful
                    (index entries, spell lists): eligible lines gain markdown
                    hard breaks so they don't merge into one paragraph

Re-run whenever the vault changes; never hand-edit the output.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

CONFIG_KEYS = {
    "$comment",
    "sourceDirs",
    "excludeDirNames",
    "excludeFiles",
    "truncateAtHeading",
    "stripCallouts",
    "stripCalloutTitles",
    "linkRewrites",
    "insertions",
    "keepImages",
    "demoteHeadingsToBold",
    "preserveLineBreaks",
}


def load_config(path: Path) -> dict:
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        sys.exit(f"config {path}: {e}")
    unknown = set(cfg) - CONFIG_KEYS
    if unknown:
        sys.exit(f"config {path}: unknown keys {sorted(unknown)}")
    if not cfg.get("sourceDirs"):
        sys.exit(f"config {path}: sourceDirs is required and non-empty")
    for rel, spec in cfg.get("truncateAtHeading", {}).items():
        if not spec.get("heading"):
            sys.exit(f"config {path}: truncateAtHeading[{rel!r}] needs a heading")
    return cfg

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
# An Obsidian callout that opens with a heading -- `> [!move] ## **CLASH**` --
# is a heading too: it's linkable, and its callout type becomes the section's
# `kind` downstream in build_srd.py. Mirrors build_srd.py's CALLOUT_HEADING_RE.
CALLOUT_HEADING_RE = re.compile(r"^>\s*\[!([\w-]+)\][+-]?\s*(#{1,6})\s+(.+?)\s*$")
CALLOUT_OPEN_RE = re.compile(r"^>\s*\[!([\w-]+)\][+-]?")
PAGE_ANCHOR_LINE_RE = re.compile(r"^\s*\^p\d+[a-z]?\s*$")
TRAILING_ANCHOR_RE = re.compile(r"\s*\^p\d+[a-z]?\s*$")
EMBED_RE = re.compile(r"!\[\[[^\]]+?\.(pdf|png|jpe?g|webp|gif|bmp|svg|canvas)(\|[^\]]*)?\]\]", re.I)
# Art in non-Obsidian-embed forms: plain markdown images, raw <img> tags (the
# HMtW corpus ships light/dark pairs), and the wrapper spans left empty once
# their images are gone. No license to redistribute art in any syntax.
MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
EMPTY_ART_SPAN_RE = re.compile(r'<span class="(?:hmw-fig|nav-spacer)">\s*</span>')
# Target is optional -- `[[#^pNNN|label]]` is a same-note page-anchor link.
LINK_RE = re.compile(r"\[\[([^\]#|]*?)#(\^p\d+[a-z]?)((?:\\)?\|[^\]]*)?\]\]")
# Target is optional here too -- `[[#CLASH|label]]` is a same-note heading link.
ANY_LINK_RE = re.compile(r"\[\[([^\]#|]*)(#([^\]|]+))?(\|[^\]]*)?\]\]")


def parse_heading(line: str) -> str | None:
    """-> heading text if `line` opens a section (plain or callout), else None."""
    m = CALLOUT_HEADING_RE.match(line)
    if m:
        return m.group(3)
    m = HEADING_RE.match(line)
    if m:
        return m.group(2)
    return None


def collect_files(vault: Path, cfg: dict) -> list[Path]:
    exclude_dirs = set(cfg.get("excludeDirNames", []))
    exclude_files = set(cfg.get("excludeFiles", []))
    files = []
    seen_excludes: set[str] = set()
    for src in cfg["sourceDirs"]:
        base = vault / src
        if not base.is_dir():
            sys.exit(f"source dir not found: {base}")
        for p in sorted(base.rglob("*.md")):
            rel = p.relative_to(vault)
            if any(part in exclude_dirs for part in rel.parts):
                continue
            if rel.as_posix() in exclude_files:
                seen_excludes.add(rel.as_posix())
                continue
            files.append(p)
    for miss in sorted(exclude_files - seen_excludes):
        sys.exit(f"excludeFiles entry matches nothing (typo?): {miss}")
    return files


def read_source(path: Path, vault: Path, cfg: dict) -> str:
    """Read a vault file: truncate-at-heading, pack-authored insertions, and
    heading-to-bold demotion all apply here, before anchor maps are built, so
    every later stage (and verify()) sees one consistent text."""
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(vault).as_posix()

    spec = cfg.get("truncateAtHeading", {}).get(rel)
    if spec is not None:
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if line.strip() == spec["heading"]:
                kept = "\n".join(lines[:i]).rstrip()
                replacement = spec.get("replacement", "").strip()
                text = kept + ("\n\n" + replacement + "\n" if replacement else "\n")
                break
        else:
            sys.exit(f"truncateAtHeading: heading {spec['heading']!r} not found in {rel}")

    # Title-matched strip runs BEFORE insertions: it exists to remove vault
    # copies of config-inserted notes, and must never eat the insertions
    # themselves.
    strip_titles = set(cfg.get("stripCalloutTitles", []))
    if strip_titles:
        text = "\n".join(strip_callout_blocks(text.splitlines(), set(), strip_titles)) + "\n"

    for ins in cfg.get("insertions", {}).get(rel, []):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if ins["after"] in line:
                lines[i + 1 : i + 1] = [""] + ins["markdown"].splitlines()
                break
        else:
            sys.exit(f"insertions: anchor {ins['after']!r} not found in {rel}")
        text = "\n".join(lines) + "\n"

    demote = set(cfg.get("demoteHeadingsToBold", []))
    if demote:
        lines = []
        for line in text.splitlines():
            m = HEADING_RE.match(line)
            lines.append(f"**{m.group(2)}**" if m and m.group(2).strip() in demote else line)
        text = "\n".join(lines) + "\n"

    return text


def build_anchor_maps(files: list[Path], texts: dict[Path, str]) -> tuple[dict, dict, list[str]]:
    """Per note basename: anchor -> heading text; also heading sets per note."""
    anchor_map: dict[str, dict[str, str | None]] = {}
    headings_map: dict[str, list[str]] = {}
    warnings: list[str] = []
    for path in files:
        name = path.stem
        lines = texts[path].splitlines()
        headings: list[str] = []
        current: str | None = None
        amap: dict[str, str | None] = {}
        for idx, line in enumerate(lines):
            heading = parse_heading(line)
            if heading is not None:
                current = heading
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
                        nxt_heading = parse_heading(nxt)
                        if nxt_heading is not None:
                            mapped = nxt_heading
                        break
                amap[anchor] = mapped
                if mapped and headings.count(mapped) > 1:
                    warnings.append(f"{name}: ^{anchor} maps to duplicated heading '{mapped}'")
        if name in anchor_map:
            warnings.append(f"duplicate note basename: {name} ({path})")
        anchor_map[name] = amap
        headings_map[name] = headings
    return anchor_map, headings_map, warnings


def strip_callout_blocks(lines: list[str], types: set[str], titles: set[str]) -> list[str]:
    """Remove whole callout blocks (opening line + quoted body) matched by
    callout type or by exact inline title."""
    out: list[str] = []
    i = 0
    while i < len(lines):
        m = re.match(r">\s*\[!([\w-]+)\][+-]?\s*(.*)$", lines[i])
        if m and (m.group(1).lower() in types or m.group(2).strip() in titles):
            i += 1
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out


def rewrite_links(text: str, rewrites: dict, warnings: list[str], src_name: str) -> str:
    """Apply the config's linkRewrites map: retarget a link, or degrade it to its label."""

    def repl(m: re.Match) -> str:
        target, frag, pipe = m.group(1).strip().rstrip("\\"), m.group(3), m.group(4) or ""
        key = f"{target}#{frag.rstrip('\\')}" if frag else target
        if key not in rewrites:
            return m.group(0)
        new = rewrites[key]
        if new is None:  # degrade to label text
            label = pipe.lstrip("\\|").strip()
            return label or frag or target
        return f"[[{new}{pipe}]]"

    return ANY_LINK_RE.sub(repl, text)


def transform(
    text: str, anchor_map: dict, warnings: list[str], src_name: str, rel: str, cfg: dict
) -> str:
    # 1. strip configured callout blocks wholesale (e.g. HMtW's [!hmw-nav]
    #    chrome). Title-matched stripping already ran in read_source, before
    #    the config's own insertions.
    lines_in = text.splitlines()
    strip_types = {t.lower() for t in cfg.get("stripCallouts", [])}
    if strip_types:
        lines_in = strip_callout_blocks(lines_in, strip_types, set())

    # 2. art we own (keepImages) survives with its src rewritten to the served
    #    pack URL; everything else — embeds, markdown images, raw <img> tags —
    #    is stripped in every syntax (bare or inside callout quotes)
    keep_images: dict[str, str] = cfg.get("keepImages", {})
    kept_urls = tuple(keep_images.values())

    def strip_img_tag(m: re.Match) -> str:
        return m.group(0) if kept_urls and any(u in m.group(0) for u in kept_urls) else ""

    lines: list[str] = []
    for line in lines_in:
        for src, url in keep_images.items():
            if src in line:
                line = line.replace(f'src="{src}"', f'src="{url}"').replace(f"]({src})", f"]({url})")
        if EMBED_RE.search(line) or MD_IMAGE_RE.search(line) or IMG_TAG_RE.search(line):
            line = EMBED_RE.sub("", line)
            line = MD_IMAGE_RE.sub(lambda m: m.group(0) if any(u in m.group(0) for u in kept_urls) else "", line)
            line = IMG_TAG_RE.sub(strip_img_tag, line)
            line = EMPTY_ART_SPAN_RE.sub("", line)
            if line.strip() in {"", ">", ">-"}:
                continue
        lines.append(line)

    # 3. drop callout headers left with no body (e.g. the printable-playbook wrapper)
    out: list[str] = []
    for i, line in enumerate(lines):
        if re.match(r"^>\s*\[![\w-]+\][+-]?\s*", line):
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if not nxt.lstrip().startswith(">"):
                continue
        out.append(line)
    lines = out

    # 4. retarget/degrade links per config (stragglers into truncated ranges etc.)
    rewrites = cfg.get("linkRewrites", {})
    if rewrites:
        lines = rewrite_links("\n".join(lines), rewrites, warnings, src_name).splitlines()

    # 5. remap page-anchor links, then strip anchors
    def repl(m: re.Match) -> str:
        target, anchor = m.group(1).strip().rstrip("\\"), m.group(2)[1:]
        pipe = m.group(3) or ""  # preserves \| escaping inside tables
        lookup = target.split("/")[-1] or src_name  # same-note link: [[#^pNNN|label]]
        heading = anchor_map.get(lookup, {}).get(anchor)
        if heading:
            return f"[[{target}#{heading}{pipe}]]"
        if lookup not in anchor_map:
            warnings.append(f"{src_name}: link to unknown note [[{target}#^{anchor}]]")
        else:
            warnings.append(f"{src_name}: anchor ^{anchor} not found in [[{target or src_name}]]; fragment dropped")
        return f"[[{target}{pipe}]]"

    text = "\n".join(lines)
    text = LINK_RE.sub(repl, text)
    kept: list[str] = []
    for line in text.splitlines():
        if PAGE_ANCHOR_LINE_RE.match(line):
            continue
        kept.append(TRAILING_ANCHOR_RE.sub("", line) if TRAILING_ANCHOR_RE.search(line) else line)
    text = "\n".join(kept)

    # 6. hard breaks where single newlines are meaningful (index entries,
    #    spell lists) — otherwise markdown merges adjacent lines into one
    #    paragraph. Headings, quotes, and table rows are left alone.
    if rel in set(cfg.get("preserveLineBreaks", [])):
        broken = []
        for line in text.splitlines():
            if line and not line.startswith(("#", ">", "|")) and not line.endswith("  "):
                line += "  "
            broken.append(line)
        text = "\n".join(broken)

    # 7. collapse 3+ blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def normalize_heading(text: str) -> str:
    """Match Obsidian's fuzziness: formatting markers are ignored in heading links."""
    return re.sub(r"[*_`]", "", text).strip().lower()


BLOCK_ID_RE = re.compile(r"\^([\w-]+)\b")
PAGE_ANCHOR_SHAPE_RE = re.compile(r"p\d+[a-z]?")


def verify(out_dir: Path) -> list[str]:
    problems: list[str] = []
    notes: dict[str, list[str]] = {}  # ordered, for nested-anchor scoping
    block_ids: dict[str, set[str]] = {}
    for p in out_dir.rglob("*.md"):
        text = p.read_text(encoding="utf-8")
        headings = (parse_heading(line) for line in text.splitlines())
        notes[p.stem] = [normalize_heading(h) for h in headings if h is not None]
        # named block ids (^basic-moves-section, ^clash…) are real, permanent
        # link targets -- ^pNNN page anchors are transient and stripped by
        # transform() already, so anything still page-anchor-shaped here is
        # not a definition to trust.
        block_ids[p.stem] = {
            bid for bid in BLOCK_ID_RE.findall(text) if not PAGE_ANCHOR_SHAPE_RE.fullmatch(bid)
        }
    for p in sorted(out_dir.rglob("*.md")):
        for m in ANY_LINK_RE.finditer(p.read_text(encoding="utf-8")):
            target = m.group(1).strip().rstrip("\\").split("/")[-1] or p.stem  # same-note: [[#CLASH|…]]
            frag = m.group(3).rstrip("\\") if m.group(3) else None
            if target not in notes:
                problems.append(f"{p.stem}: unresolved note [[{target}]]")
            elif frag and frag.startswith("^"):
                if frag[1:] not in block_ids.get(target, set()):
                    problems.append(f"{p.stem}: unresolved block id [[{target}#{frag}]]")
            elif frag:
                # Obsidian nested anchors (#Parent#Child) scope each part to
                # after the previous one; a plain fragment is the 1-part case.
                headings_seq = notes[target]
                pos = -1
                for part in (normalize_heading(x) for x in frag.split("#")):
                    pos = next((i for i in range(pos + 1, len(headings_seq)) if headings_seq[i] == part), -1)
                    if pos == -1:
                        problems.append(f"{p.stem}: unresolved heading [[{target}#{frag}]]")
                        break
    return problems


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--config", required=True, type=Path)
    args = ap.parse_args()

    cfg = load_config(args.config)
    files = collect_files(args.vault, cfg)
    texts = {p: read_source(p, args.vault, cfg) for p in files}
    anchor_map, _headings, warnings = build_anchor_maps(files, texts)

    written: set[Path] = set()
    for path in files:
        rel = path.relative_to(args.vault)
        dest = args.out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(
            transform(texts[path], anchor_map, warnings, path.stem, rel.as_posix(), cfg),
            encoding="utf-8",
        )
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
