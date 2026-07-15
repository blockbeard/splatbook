# Stonetop playbook data — schema

One JSON file per playbook, content-pack style (rules as data, no rules in app code — same philosophy as arrowedisgaming's content packs). Text fields carry Markdown emphasis (`*italic*`, `**bold**`) so a renderer can display move triggers the way the book does.

Source: Stonetop 2nd printing, Book I ch. 4. Text CC BY-SA 4.0 (Lampblack & Brimstone).

## Top level

| key | type | notes |
|---|---|---|
| `id` | string | kebab-case, e.g. `the-blessed` |
| `name` | string | display name |
| `flavor` | string | italic intro blurb |
| `source` | object | `{ "book": "Book I", "pages": [105,108], "printing": 2 }` |
| `backgrounds` | Choice[] | pick exactly 1 |
| `instincts` | Choice[] | pick exactly 1; a final `"custom": true` entry = write-in |
| `appearance` | string[][] | one array per line; pick 1 per line |
| `origins` | object | `{ "prompt": string, "options": [{ "label", "names": string[], "note"? }] }` |
| `stats` | object | `{ "array": [2,1,1,0,0,-1], "debilities": [{ "name", "stats": ["STR","DEX"] }] }` |
| `base` | object | `{ "damage": "d6", "maxHp": 18 }` |
| `moves` | object | see Moves |
| `possessions` | object | `{ "prompt", "pick": 2, "fixed": Item[], "options": Item[] }` |
| `extras` | Section[] | playbook-specific back-page sections (sacred pouch, tall tales, chronicle…) |
| `introductions` | object | `{ "intro": string, "steps": Step[] }` |

## Moves

```json
"moves": {
  "starting": { "fixed": ["spirit-tongue", "call-the-spirits"], "fromBackground": 1, "choose": 1 },
  "list": [ Move, ... ]
}
```

Move:

| key | type | notes |
|---|---|---|
| `id` | string | kebab-case |
| `name` | string | as printed (title case; render however you like) |
| `text` | string | markdown; bullets as `- ` lines, paragraphs as `\n\n` |
| `maxTakes` | int? | omit = 1 |
| `requires` | object? | `{ "level"?: int, "moves"?: [ids], "note"?: string, "tracker"?: { "move": id, "count": int } }` — `note` for non-mechanical text like "the Blessed"; `tracker` gates on a tracker's marks (the Would-be Hero's Superior Stat needs 6 marks in Potential for Greatness) |
| `tracker` | object? | `{ "boxes": 4, "label": "Boon" }` for use-trackers printed on the sheet |
| `statBump` | object? | `{ "cap": 2 }` — taking this move raises one stat by +1 up to `cap` (Improved Stat +2, Superior Stat +3); the player picks the stat on Level Up |
| `childOf` | string? | id of parent move (Borrow Power / Call the Spirits sit under Spirit Tongue) |
| `rollsDamage` | bool? | this move's own resolution says to deal your base damage die (Clash, Let Fly, Ambush…) — the sheet renders a "Damage (dX)" button on the card, rolling the playbook's `base.damage`. A rider on top of *another* roll's damage (e.g. "+1d4") doesn't get this. |

## Shared shapes

**Choice** (backgrounds, instincts): `{ "id", "name", "text"?, "grants"?: { "moves": [ids], "notes"?: string[] }, "choices"?: SubChoice[] }`.
**SubChoice**: `{ "id", "prompt", "min", "max", "options": [{ "label" }] }`.
**Item** (possessions): `{ "name", "text"?, "tags"?: string[], "uses"?: int, "load"?: int, "fixed"?: true, "writeIn"?: true, "statblock"?: { hp, damage, tags, instinct, cost } }`.
**Section** (extras): `{ "id", "title", "text"?: string, "choices"?: SubChoice[], "lines"?: string[][] }` — `lines` works like `appearance` (pick 1 per line).
**Step** (introductions): `{ "n": int, "text": string, "questions"?: string[] }`.

## Conventions

- Wording matches the 2nd printing exactly, errata applied.
- `writeIn: true` marks blank "discuss with GM" style options.
- Move ids are unique **within a playbook**; cross-playbook references (Wild Soul granting Ranger moves) use `{ "requires": { "note": ... } }` prose, not ids.
- The companion markdown notes in `../` are the human-readable rendering of the same data.

## Inserts and the Steading (added later)

These files use looser, purpose-built shapes rather than the character-playbook schema. Common fields: `id`, `name`, `type` (`"insert"` or `"steading"`), `appliesTo` (playbook id or `"all"`), `source`.

- **insert-inventory.json** — the standard Inventory sheet: `outfit` (load rules + undefined slots), `gear[]` (`slots` = ◇ count, `tags`, `uses`, `ammo`), `smallItems`, `prosperity`.
- **insert-animal-companion.json** — `types[]` (Bird/Critter/Brute/Predator/Steed with base stats, `startingTraits`, `pick` + `options`), `instincts`, `cost`, `beastOfLegend`, shared follower `rules[]`.
- **insert-crew.json** — Marshal's crew: `tags` (fixed/fromBackground/choose), `instincts`, `cost`, `inventory`, `individuals` (names/tags/traits), `rules[]`.
- **insert-initiates-of-danu.json** — `pick` {min 2, max 3}, `initiates[]` (statblocks + per-line `choices`), `rules[]`.
- **insert-invocations.json** — `invocations[]` with `text`, `ongoing?`, `reduced`, `empowered`.
- **insert-followers.json** — generic follower sheet structure + player reference text (agenda, principles, when-in-doubt, triggering moves, hold & spend).
- **insert-ghost.json / insert-revenant.json** — `instincts` (replacement), `moves.list[]` (all `granted: true`), `terriblePurpose.options[]` (shared between the two; revenant marks `sameAs`), `consequences.list[]` + `final`.
- **insert-thrall.json** — `master`, `impulse`, `instincts` (replacement), `moves.list[]` (granted; Favor has a `tracker`), `marks.list[]` (`maxHpPenalty` where applicable).
- **the-steading.json** — `stats` (fortunes/surplus/size/population/prosperity/defenses with `start`/`range`), `resources`, `fortifications`, `debilities`, `placesOfInterest`, `content` (safety lists), `improvements[]` (`summary`, `requires` {`all`/`either`/`orAll`/`pick`+`options`/`andThen`/`inOrder`; entries may be `{ "text", "boxes" }` for multi-box requirements}, `effects` markdown), `otherImprovements` (blank cards), `assets`, `residents` (names + NPC traits), `neighbors`.

- **the-gm.json** — the GM playbook as reference data (`type: "gm"`): `agenda`, `coreLoop`, `gmMoves` (general/exploration/homefront), `principles`, `damageAndDebilities`, `content`, `threats` (write-up/update procedures + 8 threat types with move lists), `iWonder`, `expeditions` (Chart a Course, travel times, Die of Fate tables, weather), `sites`, `discoveries`, `hazards`, `monsters` (11-step creation), `npcs` (regional name lists, questions, impressions, Persuade), `followers` (9-step creation + play rules + group rules), `homefront` (life in Stonetop + seasonal activities), `aftermath`, `downtime` (Make a Plan), `relativeValue`, `flowOfPlay` (nodes/edges graph). Table rows are `[roll, result]` or `[label, value]` pairs.
