# Origins 5.5e pack data — schema

Everything in `static/content-packs/origins/data/` is **generated** by
`tools/build_origins_data.py` and must never be hand-edited. Two files in this
folder are the hand-authored inputs; the rest of the pack comes from SRD 5.2.1
markdown.

```
SRD 5.2.1 markdown ─┐
                    ├─ build_origins_data.py ─→ static/content-packs/origins/data/*.json
content/origins/ ───┘   (origins-rules.json, species-choices.json)
```

Regenerate with:

```
python3 tools/build_origins_data.py --srd <path to a dnd-5e-srd-markdown checkout>
```

The authoritative shapes are the Zod schemas in
`src/lib/games/origins/pack-schemas.ts`; this document says what the fields
*mean* and why they are shaped that way. `src/lib/games/origins/pack.test.ts`
snapshots the ids and checks the cross-references.

## Conventions

- **Ids are kebab-case** and derived from the SRD name (`Sleight of Hand` →
  `sleight-of-hand`). They are the stable key a saved character stores, so a
  renamed id is a migration, not a cosmetic change — hence the snapshots.
- **Money is copper** (`costCp`). The SRD mixes CP, SP and GP in one table and a
  builder has to total a purse; integers in the smallest unit avoid the
  floating-point nonsense. `costText` keeps the SRD's own wording for display,
  and is the only thing to show when a cost is "Varies".
- **Weights are pounds** (`weightLb`), `null` when the SRD gives none.
- **Prose fields carry Markdown emphasis**, matching the SRD's own text.
- **Nothing is inferred.** Where the SRD writes a list of items as prose
  ("4 Handaxes"), the pack keeps the prose rather than inventing item ids for
  it — an extractor guessing at joins is how a builder starts quietly lying.

## Files

### `origins-rules.json` — authored

The hack's own rules and text (Patchwork Paladin, CC BY 4.0), quoted from the
post. This is the only file carrying Origins' departures from the SRD, and it
carries them as **data**: the engine takes `rules.*` as arguments rather than
hard-coding them, so changing a number is a pack edit.

| field | meaning |
| --- | --- |
| `rules.proficiencyBonus` | Fixed at 2. There are no levels for it to scale with. |
| `rules.referenceClass.grants` | The only four traits a reference class contributes. Not saving throws, not class skills, not features. |
| `rules.equipment.startingGold` | Option B's gold: 100, or 150 with Medium or Heavy armor training. (The SRD's own backgrounds still say 50 — see below.) |
| `rules.hitPoints.method` | `roll` — roll the hit die and add the CON modifier, rather than 5e's take-the-maximum at level 1. |
| `rules.spellcasting` | `maxSpellLevel: 1`, and the three lists Magic Initiate opens. No slots and no preparation: one casting per Long Rest, cantrips and rituals free. |
| `abilityGeneration` | Standard array, the point-buy cost table and budget, and the roll notation. |

`steps` and `playerAdvice` are the post's own words, for the builder to show at
the point each rule applies. The post's **DM advice** is deliberately not here.

### `backgrounds.json` — generated

The SRD's four backgrounds. `abilityScores` is the three abilities the
background offers (increase one by 2 and another by 1, or all three by 1).
`feat.spellList` is present only for Magic Initiate, and naming it is what makes
a character a spellcaster in Origins.

`equipment.options` keeps the SRD's **50 GP** for Option B, unmodified. The
Origins override lives in `origins-rules.json` and is applied by the engine —
so the pack stays a faithful copy of the SRD, and the hack stays visible as a
hack rather than being baked into the data.

### `species.json` — generated, plus the `species-choices.json` overlay

The SRD's nine species. `traits` are the species' special traits in order, each
keeping any table it owns as rows of cells. Origins grants the **level 1
benefit only**, so a trait's text may describe higher-level scaling the builder
ignores.

`choices` comes from the authored `species-choices.json` overlay: the SRD writes
its choice points as prose ("Choose a lineage from the Elven Lineages table")
and a builder needs them as options. A choice has either an explicit `options`
list or a `from` pool (`skills`, `origin-feats`), never both, and `grants` says
what picking it actually gives the character. `trait` names the trait the choice
belongs to; it is absent for the Human and Tiefling size choices, which hang off
the species' Size line rather than a trait.

### `reference-classes.json` — generated

All twelve SRD classes, each carrying the four traits Origins borrows —
`hitDie`, `armorTraining` (parsed into booleans plus the SRD's own wording),
`weaponProficiencies`, `startingEquipment`.

`notGranted` carries the class's primary ability, saving-throw proficiencies and
skill proficiencies **for display only**. They are here precisely because they
are *not* granted: a player picking Rogue as a reference class needs to see that
they are not getting Rogue's saving throws, and the builder can only tell them
if the data is present.

### `feats.json` — generated

The SRD's four Origin feats. `benefits` splits the feat into its named parts
(`_Two Cantrips._`, `_Level 1 Spell._`); `text` is the whole entry.

### `equipment.json` — generated

`weapons`, `armor`, `packs`, `gear`, `tools`.

Armor carries the AC formula in parts so the sheet can compute rather than
parse: `baseAc` + `addsDex` + `dexCap`. A Shield is the one row that breaks the
pattern — it has no `baseAc` and an `acBonus` of 2 — and `acText` always keeps
the SRD's own wording.

`packs` are the equipment kits Origins tells you to add to a background's
Option A, with their `contents` split out.

### `spells.json` — generated

Cantrips and level 1 spells from the Cleric, Druid and Wizard lists — the whole
of what a Magic Initiate background can reach in Origins. `lists` says which of
the three a spell is on; `ritual` matters because a ritual sidesteps the
once-per-Long-Rest limit.

### `reference.json` — generated

The small tables the sheet needs: the six abilities, the eighteen skills with
their governing ability, and the standard languages.

## What the pack deliberately omits

Class features, subclasses, spells above level 1, monsters, magic items, and the
SRD's gameplay chapters. A classless, level-less game has no use for them, and
the pack is scoped to the character builder. See the pack's `LICENSE.md`.
