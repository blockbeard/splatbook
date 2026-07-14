#!/usr/bin/env python3
"""
One-off: pull the Avara webfont out of the Stonetop vault's Obsidian theme
snippet and drop it in static/fonts/ as plain woff2 files.

Avara (Raphaël Bastide / Velvetyne Type Foundry, SIL OFL) is the book's
display face for H1-H4 (commit 94). Unlike Libre Caslon Text and IM Fell
English, it has no @fontsource package, so there's nowhere to `npm install`
it from — the vault snippet's `@font-face` rules, each with the font baked in
as a base64 `data:` URL, are the only copy in the project. This script reads
those rules and writes each one back out as a real woff2 file plus the
@font-face CSS to load it, so the app can `@import` it like any other font
instead of shipping a 320KB CSS file full of base64.

Run once, from the repo root, with the vault mounted:

    python3 tools/extract_avara_font.py --vault <path to Stonetop vault>

Not part of the regular content pipeline (build_rules.py / build_srd.py) —
the font doesn't change when the rules text does, so there's no reason to
re-run this except to pick up a font update from the vault.
"""

from __future__ import annotations

import argparse
import base64
import re
from pathlib import Path

FONT_FACE = re.compile(
    r"@font-face\{font-family:'(?P<family>[^']+)';"
    r"font-style:(?P<style>\w+);"
    r"font-weight:(?P<weight>\d+);"
    r"font-display:swap;"
    r"src:url\(data:font/woff2;base64,(?P<data>[A-Za-z0-9+/=]+)\)"
    r"(?:\s*format\('woff2'\))?;?\}"
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True, help="Path to the Stonetop Obsidian vault")
    parser.add_argument(
        "--out", default="static/fonts", help="Output directory (default: static/fonts)"
    )
    parser.add_argument(
        "--css-out",
        default="src/lib/games/stonetop/fonts-avara.css",
        help="Where to write the generated @font-face CSS",
    )
    args = parser.parse_args()

    snippet = Path(args.vault) / ".obsidian" / "snippets" / "stonetop-theme.css"
    text = snippet.read_text(encoding="utf-8")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    faces: list[tuple[str, str, str]] = []  # (weight, style, filename)
    for m in FONT_FACE.finditer(text):
        if m.group("family") != "Avara":
            continue
        weight = m.group("weight")
        style = m.group("style")
        suffix = "-italic" if style == "italic" else ""
        filename = f"avara-{weight}{suffix}.woff2"
        out_dir.joinpath(filename).write_bytes(base64.b64decode(m.group("data")))
        faces.append((weight, style, filename))
        print(f"wrote {out_dir / filename} ({style} {weight})")

    if not faces:
        raise SystemExit("no Avara @font-face rules found in the snippet")

    css_lines = [
        "/*",
        " * Avara (Raphaël Bastide / Velvetyne Type Foundry, SIL OFL) — the book's",
        " * H1-H4 display face. Extracted from the Stonetop vault's Obsidian theme",
        " * snippet by tools/extract_avara_font.py; not on @fontsource, so this file",
        " * plays the same role a @fontsource package's CSS would.",
        " */",
    ]
    for weight, style, filename in faces:
        css_lines.append(
            "@font-face {\n"
            "\tfont-family: 'Avara';\n"
            f"\tfont-style: {style};\n"
            f"\tfont-weight: {weight};\n"
            "\tfont-display: swap;\n"
            f"\tsrc: url('/fonts/{filename}') format('woff2');\n"
            "}"
        )

    Path(args.css_out).write_text("\n".join(css_lines) + "\n", encoding="utf-8")
    print(f"wrote {args.css_out}")


if __name__ == "__main__":
    main()
