# His Majesty the Worm — card-table data schema

Hand-authored, content-pack style: the rules the card table needs live here as
data, never in app code. Two files, both tracked twice — source in
`content/hmtw/data/`, served copy in `static/content-packs/hmtw/data/` — the
same arrangement `tools/build_moves.ts` describes for Stonetop.

Source: *His Majesty the Worm* (Joshua McCrowell, Exalted Funeral Press), ch. 1
and ch. 7. Game text reused under the book's own grant — see the pack's
`LICENSE.md`.

**What is deliberately absent:** anything that would let the app *rule* on a
play. There are no totals here, because a total is a card plus an attribute
(with favour at ±3, and Resolve spendable for favour) and this pack holds no
character at all. The catalogues below populate menus and suggest counts. Every
one of them is meant to be overridable at the table.

## `deck.json`

| key | type | notes |
|---|---|---|
| `schemaVersion` | number | bumped with any shape change; the engine migrates on load |
| `source` | object | `{ book, chapters, note }` |
| `suits` | Suit[] | the four minor suits, in book order |
| `ranks` | Rank[] | fourteen, ace through king |
| `minors` | Card[] | the fifty-six, generated from suits × ranks |
| `majors` | Major[] | twenty-two, the Fool at 0 through the World at XXI |
| `doomTiers` | Tier[] | lesser 1–14, greater 15–21 (ch. 7, "Enemy actions") |
| `decks` | Deck[] | which cards each physical deck holds |

**Suit** — `{ id, name, glyph }`. `glyph` is a pack-relative path to the
hand-authored suit SVG already served for the game landing.

**Rank** — `{ id, name, value }`. Values are the ch. 7 sidebar's: aces 1, pages
11, knights 12, queens 13, kings 14, the rest by their numeral.

**Card** — `{ id, suit, rank, value, name }`. `id` is `<suit>-<rank>`; `name`
follows the book's own style ("II of Swords", "King of Pentacles").

**Major** — `{ id, name, numeral, value }`. Numbering is Rider–Waite–Smith, as
the book uses it: Strength is VIII and Justice XI — confirmed by ch. 7's worked
example, which deals "Justice \[XI]".

**Deck** — `{ id, name, arcana, includesMajors?, excludesMajors?, note }`. The
player deck is the minor arcana *plus the Fool*, borrowed from the majors
(ch. 1); the GM deck is I–XXI without it.

## `challenge.json`

| key | type | notes |
|---|---|---|
| `schemaVersion` | number | as above |
| `source` | object | as above |
| `handSizes.player` | object | `{ default: 4, note }` — always four, and facedown cards in play do not reduce it |
| `handSizes.gm` | object | `{ base: 3, modifiers, mulligan, note }` |
| `actions` | object | `{ free, bySuit, anySuit }` |

**GM modifier** — `{ id, label, amount, kind }`. `kind` is `"toggle"` (true or
false: outnumbering, an elite, a dungeon lord) or `"count"` (once per instance:
each enemy type, each larger-than-human enemy). Cumulative, and rechecked at the
start of every round — as enemies fall, the GM draws fewer.

**Mulligan** — `{ label, note }` and nothing more. The book's condition is a
hand that is "*mostly* greater dooms", with no threshold given, so this is a
button the GM chooses to press and never a computed state.

**Action** — `{ id, name, summary, rule, greaterDoomForbidden? }`. Grouped by the suit that
pays for them, plus `anySuit` (the miscellaneous actions) and `free` (talking,
moving within your zone — no card at all). The grouping is what lets the table
answer "what does this card let me do?" while knowing only one rule: *suit
matches action*. `greaterDoomForbidden` marks Vigilance, the single
miscellaneous action a greater doom may not pay for.

`summary` is the rule in one or two sentences, written by hand against ch.7
rather than cut from its first paragraph, and read by Chris before it shipped
(2026-11-24). It is what the table shows under the action menu. It is a
reminder, never the rule: `rule` is the reference page that holds the rule
itself — a page id, as for `endOfRound`, checked by the pack test. The two free
actions point at "Free actions", and the GM's two at "Greater dooms".

The GM reads this catalogue by doom tier rather than by suit: a lesser doom pays
for any Challenge Action, a greater doom for greater doom abilities or a
miscellaneous action other than Vigilance. The suit-matching requirement is
waived for the GM's *minor* actions specifically, because the majors have no
suits.

`endOfRound` is ch.7 step 5's assessment, which the table says once everybody
who put an initiative down has had their turn: `text` is the prompt (surrender
if the guild has clearly won, ask about retreating if it is in a bad way), and
`rule` names a page of the generated reference — `page` is its id, `label` the
link text. The pack test loads `rules/pages/<page>.json`, so a reimport that
renames the heading fails a test rather than leaving a dead link. It is a prompt
to say aloud, and it shows whether or not the GM has guiding switched on.

## Not here yet

Summaries for talents and spells. Only the core Challenge Actions are here;
Gramarye, Chirurgeon and the rest live on character sheets.
