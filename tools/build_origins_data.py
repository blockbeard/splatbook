#!/usr/bin/env python3
"""Build the Origins 5.5e content pack's structured data from SRD 5.2.1 markdown.

Origins 5.5e is a classless, level-less hack of SRD 5.2.1: a character is a
background, a species, ability scores, and a "reference class" borrowed for
four traits only. Almost everything the builder offers is therefore SRD text,
and this script is how it gets into the pack.

  python3 tools/build_origins_data.py --srd <path to dnd-5e-srd-markdown>

`--srd` points at a checkout of the SRD-as-markdown source (the same shape as
`build_rules.py --vault`: sources live outside the repo, artifacts inside it).
Output lands in `static/content-packs/origins/data/` and is **generated —
never hand-edit**. The two hand-authored inputs live in `content/origins/`:

- `origins-rules.json`  the hack's own rules and text (Patchwork Paladin's),
                        copied into the pack verbatim.
- `species-choices.json` an overlay naming the choice points inside species
                        traits (Draconic Ancestry, Elven Lineage, …), which are
                        prose in the SRD and options in a builder. Same idea as
                        `build_rules.py`'s `insertions`: pack-authored structure
                        that a re-import must not clobber.

The source is a *community* markdown conversion, not the publisher's PDF, so
this script is deliberately strict: anything it cannot parse is a hard error,
never a silent omission. If the SRD source changes shape, this fails loudly and
`pack.test.ts`'s id snapshots catch anything that slips through.

Both bodies of text are CC BY 4.0; see the pack's LICENSE.md.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO_ROOT / "content" / "origins"
OUT_DIR = REPO_ROOT / "static" / "content-packs" / "origins" / "data"

# The 12 SRD classes, in the order the SRD prints them. A reference class
# contributes exactly four things (see the Origins rules); this list is the
# closed set the parser expects to find, so a source that loses one is an error.
CLASSES = [
    "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
    "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
]
# Magic Initiate opens exactly these three lists, and Origins caps spells at
# level 1, so this is the whole of the pack's spell surface.
SPELL_LISTS = ["Cleric", "Druid", "Wizard"]

ABBREV = {
    "Strength": "STR", "Dexterity": "DEX", "Constitution": "CON",
    "Intelligence": "INT", "Wisdom": "WIS", "Charisma": "CHA",
}


class BuildError(Exception):
    """A source the script could not parse. Always fatal — never a silent skip."""


def slug(text: str) -> str:
    """A stable kebab-case id: "Sleight of Hand" -> "sleight-of-hand"."""
    s = re.sub(r"[’']", "", text.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


# --------------------------------------------------------------------------
# Markdown + embedded-HTML plumbing
#
# The SRD markdown embeds real <table> elements rather than pipe tables, so
# every table in this source needs an HTML pass. Everything else is markdown.
# --------------------------------------------------------------------------

class _TableParser(HTMLParser):
    """Collects <table> elements as lists of rows of cell text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            self._table.append(self._row)
            self._row = None
        elif tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._cell = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)


def tables_in(text: str) -> list[list[list[str]]]:
    """Every HTML table in `text`, as rows of plain-text cells."""
    p = _TableParser()
    p.feed(text)
    return p.tables


def sections(text: str, level: int) -> list[tuple[str, str]]:
    """Split markdown into (heading title, body) pairs at exactly `level`.

    Body runs to the next heading of the same or a shallower level, so a
    section keeps its own subsections.
    """
    hashes = "#" * level
    pattern = re.compile(rf"^{hashes} (.+?)\s*$", re.MULTILINE)
    stop = re.compile(rf"^#{{1,{level}}} ", re.MULTILINE)
    out: list[tuple[str, str]] = []
    for m in pattern.finditer(text):
        rest = text[m.end():]
        nxt = stop.search(rest)
        out.append((m.group(1).strip(), rest[: nxt.start()] if nxt else rest))
    return out


def field(body: str, name: str) -> str | None:
    """A `**Name:** value` line's value, or None."""
    m = re.search(rf"^\*\*{re.escape(name)}:\*\*\s*(.+?)\s*$", body, re.MULTILINE)
    return m.group(1).strip() if m else None


def first_field(body: str, *names: str) -> str | None:
    """The first of several spellings of a field line that is present.

    The SRD markdown is inconsistent about `**Components:**` vs
    `**Component:**` (12 spells of 339 use the singular), which is the kind of
    thing a community conversion is allowed to be wrong about and a strict
    parser must not die on.
    """
    for name in names:
        value = field(body, name)
        if value is not None:
            return value
    return None


def require(value, what: str):
    if value in (None, "", [], {}):
        raise BuildError(f"could not parse {what}")
    return value


def prose(body: str) -> str:
    """Body text with HTML tables and bold-label field lines stripped out."""
    t = re.sub(r"(?s)<table.*?</table>", "", body)
    t = re.sub(r"^\*\*[A-Za-z ]+:\*\*.*$", "", t, flags=re.MULTILINE)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def traits_in(body: str) -> list[dict]:
    """`_Trait Name._ text` paragraphs, in order, as {name, text}.

    A trait's text runs to the next trait, and keeps any table under it (turned
    into a markdown table) because several species traits *are* their table.
    """
    marks = list(re.finditer(r"^_([A-Z][^._]*)\._\s*", body, re.MULTILINE))
    out: list[dict] = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        chunk = body[m.end():end]
        text = re.sub(r"(?s)<table.*?</table>", "", chunk)
        text = re.sub(r"^\*\*[^*]+\*\*\s*$", "", text, flags=re.MULTILINE)
        entry: dict = {"name": m.group(1).strip(), "text": re.sub(r"\n{3,}", "\n\n", text).strip()}
        tbls = tables_in(chunk)
        if tbls:
            entry["table"] = tbls[0]
        out.append(entry)
    return out


def write(name: str, payload: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_text(json.dumps(payload, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")
    count = next((len(v) for v in payload.values() if isinstance(v, list)), len(payload))
    print(f"  {path.relative_to(REPO_ROOT)} ({count} entries)")


# --------------------------------------------------------------------------
# Cost, weight, and the little parsers the tables need
# --------------------------------------------------------------------------

COIN = {"CP": 1, "SP": 10, "EP": 50, "GP": 100, "PP": 1000}


def copper(cost: str) -> int | None:
    """"5 GP" -> 500 copper. "Varies"/"—" -> None. Money is stored in copper so
    the builder can add a Bell to a Greataxe without floating-point silliness."""
    m = re.match(r"^([\d,]+)\s*(CP|SP|EP|GP|PP)$", cost.strip(), re.IGNORECASE)
    if not m:
        return None
    return int(m.group(1).replace(",", "")) * COIN[m.group(2).upper()]


def pounds(weight: str) -> float | None:
    m = re.match(r"^([\d.]+)\s*lb\.?$", weight.strip())
    return float(m.group(1)) if m else None


def gold_in(text: str) -> int:
    """The "…, and 15 GP" tail of an equipment option, in gold."""
    m = re.search(r"(\d+)\s*GP\s*$", text.strip())
    return int(m.group(1)) if m else 0


def item_list(text: str) -> list[str]:
    """"Greataxe, 4 Handaxes, Explorer's Pack, and 15 GP" -> the items, sans gold."""
    body = re.sub(r",?\s*and\s+\d+\s*GP\s*$", "", text.strip())
    body = re.sub(r"^\d+\s*GP$", "", body)
    parts = [p.strip(" .") for p in re.split(r",\s*(?:and\s+)?", body) if p.strip(" .")]
    return [p for p in parts if not re.fullmatch(r"\d+\s*GP", p)]


OPTION_RE = re.compile(r"\(([A-Z])\)\s*(.+?)(?=;\s*(?:or\s+)?\([A-Z]\)|$)", re.DOTALL)


def equipment_choice(text: str) -> dict:
    """"Choose A or B: (A) Spear, …, 14 GP; or (B) 50 GP" -> the labelled options.

    Backgrounds always offer A or B; a few classes (Fighter, Paladin, Ranger)
    offer A, B, or C, so this returns a list rather than two named fields.
    """
    options = [
        {
            "id": m.group(1).lower(),
            "label": m.group(1),
            "items": item_list(m.group(2)),
            "gp": gold_in(m.group(2)),
        }
        for m in OPTION_RE.finditer(text.strip())
    ]
    if len(options) < 2:
        raise BuildError(f"unrecognised starting-equipment line: {text!r}")
    return {"options": options}


# --------------------------------------------------------------------------
# Backgrounds — the spine of an Origins character
# --------------------------------------------------------------------------

def build_backgrounds(srd: Path) -> dict:
    text = (srd / "character-origins.md").read_text(encoding="utf-8")
    descriptions = dict(sections(text, 3)).get("Background Descriptions")
    require(descriptions, "the Background Descriptions section")

    out = []
    for name, body in sections(descriptions, 4):
        abilities = [
            ABBREV[a.strip()]
            for a in require(field(body, "Ability Scores"), f"{name}'s ability scores").split(",")
        ]
        raw_feat = require(field(body, "Feat"), f"{name}'s feat")
        feat = re.sub(r"\s*\(see .*?\)\s*$", "", raw_feat).strip()
        # "Magic Initiate (Cleric)" names both the feat and the spell list it opens.
        list_match = re.match(r"^(.*?)\s*\((Cleric|Druid|Wizard)\)$", feat)
        entry = {
            "id": slug(name),
            "name": name,
            "abilityScores": abilities,
            "feat": {"id": slug(list_match.group(1) if list_match else feat), "name": feat},
            "skillProficiencies": [
                s.strip()
                for s in re.split(
                    r",\s*|\s+and\s+", require(field(body, "Skill Proficiencies"), f"{name}'s skills")
                )
            ],
            "toolProficiency": re.sub(
                r"_", "", require(field(body, "Tool Proficiency"), f"{name}'s tool")
            ),
            "equipment": equipment_choice(require(field(body, "Equipment"), f"{name}'s equipment")),
        }
        if list_match:
            entry["feat"]["spellList"] = list_match.group(2).lower()
        if len(entry["abilityScores"]) != 3:
            raise BuildError(f"{name}: expected 3 ability scores, got {entry['abilityScores']}")
        if len(entry["skillProficiencies"]) != 2:
            raise BuildError(f"{name}: expected 2 skills, got {entry['skillProficiencies']}")
        out.append(entry)

    if not out:
        raise BuildError("no backgrounds parsed")
    return {"backgrounds": out}


# --------------------------------------------------------------------------
# Species — level 1 benefit only, per the Origins rules
# --------------------------------------------------------------------------

def build_species(srd: Path) -> dict:
    text = (srd / "character-origins.md").read_text(encoding="utf-8")
    descriptions = dict(sections(text, 3)).get("Species Descriptions")
    require(descriptions, "the Species Descriptions section")

    overlay_path = SOURCE_DIR / "species-choices.json"
    overlay = json.loads(overlay_path.read_text(encoding="utf-8")) if overlay_path.exists() else {}
    overlay = {k: v for k, v in overlay.items() if not k.startswith("$")}

    out = []
    for name, body in sections(descriptions, 4):
        size = require(field(body, "Size"), f"{name}'s size")
        speed = require(field(body, "Speed"), f"{name}'s speed")
        speed_ft = re.match(r"^(\d+)\s*feet", speed)
        entry = {
            "id": slug(name),
            "name": name,
            "creatureType": require(field(body, "Creature Type"), f"{name}'s creature type"),
            "size": re.match(r"^(Small|Medium|Small or Medium)", size).group(1)
            if re.match(r"^(Small|Medium|Small or Medium)", size)
            else size,
            "sizeNote": size,
            "speed": int(speed_ft.group(1)) if speed_ft else 30,
            "traits": require(traits_in(body), f"{name}'s traits"),
        }
        # Choice points inside traits are prose in the SRD and options in a
        # builder; the pack-authored overlay is what makes them selectable.
        if entry["id"] in overlay:
            entry["choices"] = overlay[entry["id"]]
        out.append(entry)

    if not out:
        raise BuildError("no species parsed")
    unknown = set(overlay) - {s["id"] for s in out}
    if unknown:
        raise BuildError(f"species-choices.json names species that do not exist: {sorted(unknown)}")
    return {"species": out}


# --------------------------------------------------------------------------
# Reference classes — four traits borrowed, the rest carried but not granted
# --------------------------------------------------------------------------

ARMOR_KINDS = ("Light", "Medium", "Heavy")


def armor_training(text: str) -> dict:
    """"Light and Medium armor and Shields" -> which trainings, plus shields."""
    return {
        "light": "Light" in text,
        "medium": "Medium" in text,
        "heavy": "Heavy" in text,
        "shields": "Shield" in text,
        "text": text,
    }


def build_reference_classes(srd: Path) -> dict:
    text = (srd / "classes.md").read_text(encoding="utf-8")
    by_name = dict(sections(text, 2))

    out = []
    for name in CLASSES:
        body = by_name.get(name)
        if body is None:
            raise BuildError(f"class {name!r} is missing from classes.md")
        tbls = tables_in(body)
        if not tbls:
            raise BuildError(f"{name}: no Core Traits table")
        traits = {row[0]: row[1] for row in tbls[0] if len(row) == 2}

        die = require(traits.get("Hit Point Die"), f"{name}'s hit die")
        die_m = re.match(r"^[Dd](\d+)", die)
        if not die_m:
            raise BuildError(f"{name}: unrecognised hit die {die!r}")
        armor = require(traits.get("Armor Training"), f"{name}'s armor training")

        out.append({
            "id": slug(name),
            "name": name,
            # The four traits Origins actually borrows.
            "hitDie": int(die_m.group(1)),
            "armorTraining": armor_training(armor),
            "weaponProficiencies": require(
                traits.get("Weapon Proficiencies"), f"{name}'s weapon proficiencies"
            ),
            "startingEquipment": equipment_choice(
                require(traits.get("Starting Equipment"), f"{name}'s starting equipment")
            ),
            # Carried for display, deliberately *not* granted — Origins takes
            # only the four traits above. The builder shows these so a player
            # can see what the reference class does not give them.
            "notGranted": {
                "primaryAbility": traits.get("Primary Ability", ""),
                "savingThrowProficiencies": traits.get("Saving Throw Proficiencies", ""),
                "skillProficiencies": traits.get("Skill Proficiencies", ""),
            },
        })

    return {"referenceClasses": out}


# --------------------------------------------------------------------------
# Origin feats — the only feats an Origins character can have
# --------------------------------------------------------------------------

def build_feats(srd: Path) -> dict:
    text = (srd / "feats.md").read_text(encoding="utf-8")
    origin = dict(sections(text, 3)).get("Origin Feats")
    require(origin, "the Origin Feats section")

    out = []
    for name, body in sections(origin, 4):
        out.append({
            "id": slug(name),
            "name": name,
            "text": prose(re.sub(r"^_Origin Feat_\s*$", "", body, flags=re.MULTILINE)),
            "benefits": traits_in(body),
        })
    if not out:
        raise BuildError("no origin feats parsed")
    return {"feats": out}


# --------------------------------------------------------------------------
# Equipment — weapons, armor, packs, tools, gear
# --------------------------------------------------------------------------

def build_equipment(srd: Path) -> dict:
    text = (srd / "equipment.md").read_text(encoding="utf-8")
    top = dict(sections(text, 2))

    # --- Weapons: one table, with `Simple Melee Weapons`-style category rows.
    weapons: list[dict] = []
    wt = tables_in(require(top.get("Weapons"), "the Weapons section"))
    for row in next(t for t in wt if any(len(r) == 6 for r in t)):
        if len(row) == 1:
            category, kind = row[0].split(" ", 1)
            current = (category, kind.replace(" Weapons", ""))
            continue
        if len(row) != 6 or row[0] == "Name":
            continue
        name, damage, props, mastery, weight, cost = row
        dm = re.match(r"^(\d+d\d+)\s+(\w+)$", damage)
        weapons.append({
            "id": slug(name),
            "name": name,
            "category": current[0],          # Simple | Martial
            "kind": current[1],              # Melee | Ranged
            "damageDice": dm.group(1) if dm else None,
            "damageType": dm.group(2) if dm else None,
            "damage": damage,
            "properties": [] if props == "—" else [p.strip() for p in props.split(",")],
            "mastery": None if mastery == "—" else mastery,
            "weightLb": pounds(weight),
            "costCp": copper(cost),
        })
    if not weapons:
        raise BuildError("no weapons parsed")

    # --- Armor: same shape, and the AC formula is what the builder actually needs.
    armor: list[dict] = []
    at = tables_in(require(top.get("Armor"), "the Armor section"))
    for row in next(t for t in at if any(len(r) == 6 for r in t)):
        if len(row) == 1:
            current = row[0].split(" (")[0].replace(" Armor", "")
            continue
        if len(row) != 6 or row[0] == "Armor":
            continue
        name, ac, strength, stealth, weight, cost = row
        base = re.match(r"^(\d+)", ac)
        cap = re.search(r"max (\d+)", ac)
        # A Shield's AC column reads "+2" — it adds to AC rather than setting it.
        bonus = re.match(r"^\+(\d+)$", ac)
        armor.append({
            "id": slug(name),
            "name": name,
            # "Shield" is its own category in the table and adds to AC rather
            # than replacing it — the builder treats it separately.
            "category": current,
            "baseAc": int(base.group(1)) if base else None,
            "acBonus": int(bonus.group(1)) if bonus else None,
            "addsDex": "Dex modifier" in ac,
            "dexCap": int(cap.group(1)) if cap else None,
            "acText": ac,
            "minStrength": int(strength) if strength.isdigit() else None,
            "stealthDisadvantage": stealth == "Disadvantage",
            "weightLb": pounds(weight),
            "costCp": copper(cost),
        })
    if not armor:
        raise BuildError("no armor parsed")

    # --- Gear, including the equipment packs Origins tells you to add.
    gear: list[dict] = []
    packs: list[dict] = []
    for name, body in sections(require(top.get("Adventuring Gear"), "Adventuring Gear"), 4):
        m = re.match(r"^(.+?)\s*\((.+?)\)$", name)
        if not m:
            raise BuildError(f"unrecognised gear heading: {name!r}")
        label, cost = m.group(1), m.group(2)
        entry = {
            "id": slug(label),
            "name": label,
            "costCp": copper(cost),
            "costText": cost,
            "text": prose(body),
        }
        if label.endswith("Pack"):
            contents = re.search(r"contains the following items:\s*(.+?)\.", body, re.DOTALL)
            entry["contents"] = item_list(contents.group(1)) if contents else []
            packs.append(entry)
        else:
            gear.append(entry)
    if not packs:
        raise BuildError("no equipment packs parsed — Origins needs them by name")

    # --- Tools: name + cost, enough to pick a proficiency and buy the thing.
    tools: list[dict] = []
    for section_name, body in sections(require(top.get("Tools"), "the Tools section"), 4):
        for m in re.finditer(r"^\*\*(.+?)\s*\((.+?)\)\*\*\s*$", body, re.MULTILINE):
            label, cost = m.group(1), m.group(2)
            tools.append({
                "id": slug(label),
                "name": label,
                "category": section_name,
                "costCp": copper(cost),
                "costText": cost,
            })
    if not tools:
        raise BuildError("no tools parsed")

    return {"weapons": weapons, "armor": armor, "packs": packs, "gear": gear, "tools": tools}


# --------------------------------------------------------------------------
# Spells — cantrips and level 1 only, from the three Magic Initiate lists
# --------------------------------------------------------------------------

SUBTITLE_RE = re.compile(r"^_(?:Level (\d+) (\w+)|(\w+) Cantrip)\s*\(([^)]*)\)_", re.MULTILINE)


def build_spells(srd: Path) -> dict:
    text = (srd / "spells.md").read_text(encoding="utf-8")
    # Deliberately sliced to end-of-file rather than taken via `sections`: a
    # handful of spells embed a stat block under its own `##` heading (Giant
    # Insect, Draconic Spirit), which would otherwise close the section early
    # and silently drop every spell after it.
    start = re.search(r"^## Spell Descriptions\s*$", text, re.MULTILINE)
    require(start, "the Spell Descriptions section")
    descriptions = text[start.end():]

    out = []
    for name, body in sections(descriptions, 4):
        m = SUBTITLE_RE.search(body)
        if not m:
            continue
        level = int(m.group(1)) if m.group(1) else 0
        if level > 1:
            continue
        classes = [c.strip() for c in m.group(4).split(",")]
        lists = [c for c in SPELL_LISTS if c in classes]
        if not lists:
            continue
        casting_time = require(field(body, "Casting Time"), f"{name}'s casting time")
        out.append({
            "id": slug(name),
            "name": name,
            "level": level,
            "school": m.group(2) or m.group(3),
            # Which of the three Magic Initiate lists this spell is on.
            "lists": [l.lower() for l in lists],
            "castingTime": casting_time,
            # Rituals are free in Origins — cast without spending the one
            # per-Long-Rest casting — so the builder needs this flag.
            "ritual": "Ritual" in casting_time,
            "range": require(field(body, "Range"), f"{name}'s range"),
            "components": require(
                first_field(body, "Components", "Component"), f"{name}'s components"
            ),
            "duration": require(field(body, "Duration"), f"{name}'s duration"),
            "concentration": "Concentration" in (field(body, "Duration") or ""),
            "text": prose(re.sub(r"^_.*?_\s*$", "", body, count=1, flags=re.MULTILINE)),
        })

    if not out:
        raise BuildError("no spells parsed")
    return {"spells": out}


# --------------------------------------------------------------------------
# Skills, abilities, languages — the small reference tables the sheet needs
# --------------------------------------------------------------------------

def build_reference(srd: Path) -> dict:
    play = (srd / "playing-the-game.md").read_text(encoding="utf-8")
    skills = []
    for table in tables_in(play):
        header = table[0] if table else []
        if header[:2] != ["Skill", "Ability"]:
            continue
        for row in table[1:]:
            if len(row) < 2 or row[0] == "Skill":
                continue
            skills.append({
                "id": slug(row[0]),
                "name": row[0],
                "ability": ABBREV[row[1]],
                "example": row[2] if len(row) > 2 else "",
            })
        break
    if len(skills) != 18:
        raise BuildError(f"expected 18 skills, parsed {len(skills)}")

    creation = (srd / "character-creation.md").read_text(encoding="utf-8")
    languages: list[str] = []
    for table in tables_in(creation):
        if table and table[0][:2] == ["1d12", "Language"]:
            languages = [row[1] for row in table[1:] if len(row) == 2]
            break
    if not languages:
        raise BuildError("could not parse the Standard Languages table")

    return {
        "abilities": [{"id": abbr, "name": name} for name, abbr in ABBREV.items()],
        "skills": skills,
        "languages": languages,
    }


# --------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--srd",
        required=True,
        type=Path,
        help="path to a checkout of the SRD 5.2.1 markdown source",
    )
    args = ap.parse_args(argv)
    srd: Path = args.srd
    if not (srd / "character-origins.md").is_file():
        print(f"error: {srd} does not look like the SRD markdown source", file=sys.stderr)
        return 2

    try:
        print(f"Building the Origins 5.5e pack data from {srd}:")
        write("backgrounds.json", build_backgrounds(srd))
        write("species.json", build_species(srd))
        write("reference-classes.json", build_reference_classes(srd))
        write("feats.json", build_feats(srd))
        write("equipment.json", build_equipment(srd))
        write("spells.json", build_spells(srd))
        write("reference.json", build_reference(srd))

        # The hack's own rules are authored, not extracted; copied through so
        # the pack is one self-contained thing and the manifest lists it.
        rules = SOURCE_DIR / "origins-rules.json"
        if not rules.is_file():
            raise BuildError(f"{rules.relative_to(REPO_ROOT)} is missing")
        write("origins-rules.json", json.loads(rules.read_text(encoding="utf-8")))
    except BuildError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
