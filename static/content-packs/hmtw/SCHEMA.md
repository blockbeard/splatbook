# His Majesty the Worm — card-table data schema

Hand-authored, content-pack style: the rules the card table needs live here as
data, never in app code. Two files, both tracked twice — source in
`content/hmtw/data/`, served copy in `static/content-packs/hmtw/data/` — the
same arrangement `tools/build_moves.ts` describes for Stonetop. The pictures
are generated rather than hand-authored, and are described at the end.

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
| `art` | object? | optional; where the pack keeps a picture per card |

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

**Art** — `{ plates: { dir, ext, note? } }`, and optional. The pack says where
its own pictures live and the app composes no paths of its own: a face is
`<packBase>/<dir>/<card id>.<ext>`. Leave it out and the table falls back to
the suit glyph, which is what it drew before there were any pictures — so a
pack with no art still validates and still plays.

## `art/plates/` and `art/art-manifest.json`

**Generated — never hand-edit.** `python3 tools/build_card_art.py` writes both.

Seventy-eight black-and-white plates, one per card id, from Pamela Colman
Smith's designs as printed in A. E. Waite's *The Pictorial Key to the Tarot*
(William Rider & Son, 1911) and held on Wikimedia Commons. Black and white
because the table is black ink on paper stock whose dark mode inverts the room
around the cards; a colour set would be the only colour on that surface.

The manifest is the licence basis, per plate rather than per set: for each of
the seventy-eight it records the Commons file, that file's licence tag, the
crop taken from it, the output's dimensions and a SHA-256 of the file that
shipped. **The build re-fetches every tag and fails if one is not public
domain**, so `LICENSE.md` can point at evidence instead of making a claim.

The crop is found per plate rather than taken as a fraction. Each plate is an
illustration inside a printed rule, then the card's name in letterpress, which
is unreadable at the size a table draws a card; the rule sits at a median 91%
of plate height and wanders between 86% and 95%, so it is detected and then
clamped to that range.

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

**Action** — `{ id, name, greaterDoomForbidden? }`. Grouped by the suit that
pays for them, plus `anySuit` (the miscellaneous actions) and `free` (talking,
moving within your zone — no card at all). The grouping is what lets the table
answer "what does this card let me do?" while knowing only one rule: *suit
matches action*. `greaterDoomForbidden` marks Vigilance, the single
miscellaneous action a greater doom may not pay for.

The GM reads this catalogue by doom tier rather than by suit: a lesser doom pays
for any Challenge Action, a greater doom for greater doom abilities or a
miscellaneous action other than Vigilance. The suit-matching requirement is
waived for the GM's *minor* actions specifically, because the majors have no
suits.

## Not here yet

A black-and-white set is what shipped, so the swap the `art` block exists for
is a *colour* one — a second directory and one line of JSON, if anyone wants it.

Rule links. A menu entry that could open the reference at its own rule would be
worth having, and needs section anchors this file does not yet carry.
