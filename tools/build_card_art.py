#!/usr/bin/env python3
"""Fetch the His Majesty the Worm card art from Wikimedia Commons.

The 1911 first edition of A. E. Waite's *The Pictorial Key to the Tarot*
carries Pamela Colman Smith's seventy-eight designs as black-and-white line
plates, and Commons holds the set as individual files named
`Pictorial Key to the Tarot 13 Death.jpg` / `... Cups 04.jpg`.

  python3 tools/build_card_art.py [--out static/content-packs/hmtw/art/plates]

Generated — never hand-edit the output. Re-run to refresh.

**Provenance is proved per plate, not asserted.** Every file's Commons licence
tag is fetched and checked, and the build *fails* if any of the seventy-eight
lacks a public-domain tag. The tags land in `art-manifest.json` beside each
plate's hash, dimensions and crop box, and that manifest is what the pack's
LICENSE.md points at. A sentence claiming the art is free would be worth less
than the file that shows it.

**Why black and white, when the colour set is also public domain.** The table
is black ink on a paper-coloured card, and its dark mode is a straight
inversion of the room with the cards keeping their ink — the book's own
treatment. Colour plates would be the only colour on a monochrome surface, and
would spend the one signal that surface reserves (the book's red, for greater
dooms) on decoration. The 1911 plates *are* the design.

**The crop.** Each plate is an illustration inside a printed rule, then a gap,
then the card's name in letterpress. The name is unreadable at the size a table
renders a card, so it is cropped away — but at the rule, found per plate, not
at a fixed fraction of the image. A fixed fraction was tried first and ate into
the picture on 37 of the 45 plates it could be measured against, because the
rule sits at a median 91% of plate height and wanders between 86% and 95%.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - a developer's first run
    sys.exit("Pillow is required: pip install Pillow")

API = "https://commons.wikimedia.org/w/api.php"
PREFIX = "Pictorial Key to the Tarot"
# Commons wants a real contact in the agent; anonymous bulk fetches get 403.
AGENT = "SplatbookCardArt/1.0 (https://splatbook.app; https://github.com/blockbeard/splatbook)"

# The plate set is named for the book; the pack names cards for the game.
MAJORS = {
    "00": "fool", "01": "magician", "02": "high-priestess", "03": "empress",
    "04": "emperor", "05": "hierophant", "06": "lovers", "07": "chariot",
    "08": "strength", "09": "hermit", "10": "wheel-of-fortune", "11": "justice",
    "12": "hanged-man", "13": "death", "14": "temperance", "15": "devil",
    "16": "tower", "17": "star", "18": "moon", "19": "sun", "20": "judgement",
    "21": "world",
}
RANKS = {
    1: "ace", 2: "ii", 3: "iii", 4: "iv", 5: "v", 6: "vi", 7: "vii", 8: "viii",
    9: "ix", 10: "x", 11: "page", 12: "knight", 13: "queen", 14: "king",
}
SUITS = ("Cups", "Swords", "Wands", "Pentacles")

#: Wide enough for the zoomed view; the table draws a card at about a fifth of it.
WIDTH = 360
QUALITY = 80

#: Where the printed rule is allowed to be, as a fraction of plate height. A
#: mis-detection outside this is clamped rather than trusted, so the worst case
#: is a sliver of the name band rather than a beheaded figure.
RULE_MIN, RULE_MAX = 0.86, 0.95


def card_id(filename: str) -> str | None:
    """The pack's id for a plate, or None if the file is not one of the 78."""
    stem = filename.replace("_", " ").removeprefix(PREFIX + " ").removesuffix(".jpg")
    if len(stem) > 2 and stem[:2] in MAJORS and not stem[:2].isalpha():
        return MAJORS[stem[:2]]
    for suit in SUITS:
        if stem.startswith(suit + " "):
            n = stem[len(suit) + 1 :].strip()
            if n.isdigit() and int(n) in RANKS:
                return f"{suit.lower()}-{RANKS[int(n)]}"
    return None


def api(**params) -> dict:
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def list_plates() -> list[dict]:
    out, cont = [], None
    while True:
        p = dict(action="query", list="allimages", aiprefix=PREFIX, ailimit="500",
                 aiprop="url|size")
        if cont:
            p["aicontinue"] = cont
        d = api(**p)
        out += d["query"]["allimages"]
        cont = d.get("continue", {}).get("aicontinue")
        if not cont:
            return out


def licences(names: list[str]) -> dict[str, dict]:
    """Licence, author and date for each file, straight from Commons."""
    out: dict[str, dict] = {}
    for i in range(0, len(names), 25):
        titles = "|".join("File:" + n for n in names[i : i + 25])
        d = api(action="query", prop="imageinfo", iiprop="extmetadata", titles=titles)
        for page in d.get("query", {}).get("pages", []):
            meta = (page.get("imageinfo") or [{}])[0].get("extmetadata", {}) or {}
            # `allimages` names files with underscores and `query` titles them
            # with spaces; same file, two spellings. Key on one of them.
            out[page["title"].removeprefix("File:").replace(" ", "_")] = {
                "licence": (meta.get("LicenseShortName") or {}).get("value"),
                "credit": (meta.get("Credit") or {}).get("value", "")[:200],
                "date": (meta.get("DateTimeOriginal") or {}).get("value", "")[:80],
            }
        time.sleep(0.3)
    return out


def fetch(url: str, tries: int = 4) -> bytes:
    """Download one plate. Commons rate-limits bulk fetches, so back off."""
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": AGENT})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            if data[:2] == b"\xff\xd8":  # a JPEG, not an error page
                return data
        except Exception:
            pass
        time.sleep(1.5 + attempt * 2.5)
    raise SystemExit(f"could not fetch {url}")


def rule_line(im: Image.Image) -> tuple[int, int, int, int]:
    """The illustration's printed rule: (left, top, right, bottom) in pixels."""
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    row = [sum(1 for x in range(w) if px[x, y] < 150) / w for y in range(h)]
    col = [sum(1 for y in range(h) if px[x, y] < 150) / h for x in range(w)]

    lo, hi = int(h * 0.78), int(h * 0.97)
    bottom = max(range(lo, hi), key=lambda y: row[y])
    if row[bottom] < 0.45:
        # No continuous rule found — a very dark plate. Fall back to where the
        # ink stops, which is the same edge by another route.
        inked = [y for y in range(lo, hi) if row[y] > 0.10]
        bottom = inked[0] if inked else int(h * 0.90)
    bottom = min(max(bottom, int(h * RULE_MIN)), int(h * RULE_MAX))

    top = next((y for y in range(int(h * 0.15)) if row[y] > 0.45), int(h * 0.01))
    left = next((x for x in range(int(w * 0.15)) if col[x] > 0.35), int(w * 0.02))
    right = next((x for x in range(w - 1, int(w * 0.85), -1) if col[x] > 0.35), int(w * 0.98))
    return min(left, int(w * 0.08)), min(top, int(h * 0.06)), max(right, int(w * 0.92)), bottom


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="static/content-packs/hmtw/art/plates")
    ap.add_argument("--cache", default=".cache/pkt-plates", help="raw downloads")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)

    plates = [f for f in list_plates() if card_id(f["name"])]
    print(f"commons: {len(plates)} plates")
    if len(plates) != 78:
        sys.exit(f"expected 78 plates, found {len(plates)} — check the Commons naming")

    tags = licences([p["name"] for p in plates])
    unfree = sorted(n for n, t in tags.items() if "public domain" not in (t["licence"] or "").lower())
    if unfree:
        # The whole point of the check. A plate whose tag has changed is not
        # something to ship and quietly hope about.
        sys.exit("not public domain on Commons:\n  " + "\n  ".join(unfree))
    print(f"licences: {len(tags)} checked, all public domain")

    manifest, aspects = [], []
    for i, p in enumerate(sorted(plates, key=lambda p: p["name"]), 1):
        cid = card_id(p["name"])
        raw = cache / p["name"]
        if not raw.exists() or raw.stat().st_size < 2000:
            raw.write_bytes(fetch(p["url"]))
            time.sleep(0.6)
        im = Image.open(raw).convert("L")
        box = rule_line(im)
        art = im.crop(box)
        aw, ah = art.size
        aspects.append(aw / ah)
        art = art.resize((WIDTH, round(WIDTH * ah / aw)), Image.LANCZOS)
        dest = out / f"{cid}.webp"
        art.save(dest, "WEBP", quality=QUALITY, method=6)
        manifest.append({
            "card": cid,
            "commonsFile": p["name"],
            "commonsPage": f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(p['name'])}",
            "licence": tags[p["name"]]["licence"],
            "date": tags[p["name"]]["date"],
            "sourceSize": list(im.size),
            "cropBox": list(box),
            "output": f"{dest.name}",
            "outputSize": list(art.size),
            "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
        })
        if i % 20 == 0:
            print(f"  {i}/{len(plates)}")

    (out.parent / "art-manifest.json").write_text(
        json.dumps(
            {
                "source": {
                    "work": "A. E. Waite, The Pictorial Key to the Tarot (William Rider & Son, 1911)",
                    "illustrator": "Pamela Colman Smith",
                    "via": "Wikimedia Commons",
                    "basis": "Published 1911; public domain in the United Kingdom and the "
                             "United States. Every file's Commons licence tag is recorded "
                             "below and checked on every build.",
                },
                "tool": "tools/build_card_art.py",
                "plates": manifest,
            },
            indent="\t",
        )
        + "\n"
    )
    total = sum((out / m["output"]).stat().st_size for m in manifest)
    print(f"wrote {len(manifest)} plates, {total / 1e6:.2f} MB")
    print(f"art aspect: median 1:{1 / statistics.median(aspects):.2f}")


if __name__ == "__main__":
    main()
