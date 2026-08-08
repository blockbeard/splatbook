# Content packs

*Pack format reference and the "adding a new game" walkthrough. This file is part
of the pack-boundary contract: any commit that changes the envelope, the harness,
or the `GameModule` interface updates this file in the same commit. Stale docs
here are a bug (implementation plan, commit 12).*

## What a pack is

A content pack is a folder of data — JSON and markdown, **no code** — carrying
everything game-visible for one game: playbooks, moves, rules text, tables, names,
flavor, plus its own license and attribution. Packs are layer 1 of the three-layer
architecture (see `architecture.md`); the licensing boundary runs along the pack
edge, with GPL app code on one side and the game's licensed text on the other.

Packs live at:

```
static/content-packs/<gameId>/
  manifest.json        ← required: the envelope
  LICENSE.md           ← the pack's own license + attribution note
  SCHEMA.md            ← human-readable schema documentation (convention)
  data/…               ← structured game data (validated)
  rules/…              ← document trees: rules/SRD text, generated (phase 2)
```

`<gameId>` is kebab-case and must match three things: the `id` in the manifest,
the id of the registered `GameModule`, and the `/<gameId>` URL segment (matched
by `src/params/game.ts` since commit 95 retired the `/g/` prefix).

## The manifest

`manifest.json` is the only file the shell requires, and the only shape the shell
understands (`PackManifest` in `src/lib/packs/types.ts`, validated by
`manifestSchema` in `src/lib/packs/envelope.ts`):

| field         | meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `id`          | game id, kebab-case, must equal the pack folder name               |
| `name`        | display name of the game                                           |
| `version`     | semver of the pack *content* — independent of the app version      |
| `license`     | SPDX identifier for the pack text, e.g. `CC-BY-SA-4.0`             |
| `attribution` | human-readable credit line (author, publisher, disclaimers)        |
| `files`       | every data file in the pack, as paths relative to the pack root    |

Everything in `files` gets validated (see below). Files not listed — `LICENSE.md`,
`SCHEMA.md` — are documentation and travel with the pack unvalidated. An `art/`
folder of pack-owned images (referenced by URL from the theme, landing, or
rules bodies) is likewise unlisted: the manifest lists validated JSON only.

**`landing.json`** (optional, manifest-listed) is the pack's front-door copy —
tagline, blurb, a logo image, outbound buy links — validated by the
*shell-owned* `landingSchema` (`src/lib/packs/landing.ts`), which the game's
`schemaFor` returns for that filename. Without one the shell shows honest
defaults: builder-speak only for games that actually have builders. Both live
packs ship one.

## Validation

`npm run validate:packs` (also a CI step, between test and build) walks every
folder under `static/content-packs/` that contains a manifest and checks:

1. **Envelope** — the manifest parses, its `id` matches the folder name, every
   listed file exists and is valid JSON (`src/lib/packs/fs-loader.ts`).
2. **Content** — each listed file is validated against the Zod schema its game
   module registered. The harness (`src/lib/packs/harness.ts`) is deliberately
   strict about coverage: a pack whose game registered no schemas is an **error**,
   and so is a listed file the game's resolver returns no schema for.
   Unvalidated content is a bug, not a default.

Game modules provide schemas as a resolver function — pack-relative path in, Zod
schema (or `null`) out — via the `packSchemas` field of their `GameModule`.
Registration happens as a side effect of `registerGame()`, so the app shell and
the validation tooling always agree; both import `src/lib/games/index.ts`, which
is where every built-in module gets registered.

**Strictness policy** (see `src/lib/games/stonetop/pack-schemas.ts` for the
worked example): data the app consumes *now* validates strictly — every key
pinned, unknown keys rejected. Data whose consuming phase hasn't arrived yet gets
a pinned envelope (id, name, type, source) with interiors left `unknown`, firmed
up in the commit that starts consuming it. Round-trip tests snapshot the ids that
other data refers to, so renames fail CI instead of orphaning references.

## Generated content

Some pack content is generated from external sources rather than hand-written —
each game's `content/<game>/rules/` is produced from its Obsidian vault by
`tools/build_rules.py` and must never be hand-edited (see `CLAUDE.md`). The
tool is config-driven per game (`tools/rules.<game>.json`): source dirs and
excludes, truncate-at-heading, callout stripping and hoisting, link rewrites,
pack-authored `insertions` (notes that must not live in a shared vault),
owned-art allowlists, heading demotion, and hard-break preservation — the
tool's docstring documents every key, and HMtW's config exercises most of
them. Hand-maintained structured data (`data/*.json`) is source, not output;
its human-readable schema lives in the pack's `SCHEMA.md`.

Four data files are the exception, generated *from the pack's own rules tree* by
`tools/build_moves.ts` (phase 11; grown since) and likewise not hand-edited:

| File | What it holds |
| --- | --- |
| `data/basic-moves.json` | The moves every character can make. |
| `data/special-moves.json` | The special moves as handout cards (commit 113): Advantage/Disadvantage, Burn Brightly, End of Session, Death's Door — the Moves & Gear page's second section. |
| `data/steading-moves.json` | The Homefront moves that roll a *steading* stat. |
| `data/end-of-session.json` | The end-of-session move, split into personal prompts, group questions, and closing prose (the guided flow's structured shape — `special-moves.json` carries the same move as a flat card). |

They exist because the play sheets need these moves as **data**, while the rules
carry them as prose — and retyping licensed text by hand is how text drifts from
its source. Each carries a `source` block naming the rules file and section it was
lifted from. Round-trip tests assert the shipped files parse and still say what
the rules say, so a regeneration that mangles them fails CI.

Two per-move fields are recorded at extraction rather than hand-authored:

- **`sectionId`** (commit 115) — the rules section the move's card deep-links
  to: the full write-up chapters (Player Moves for a character's moves,
  Homefront for the steading's) preferred over the summary chapter the text is
  lifted from. The link is data, not string-matching at runtime.
- **`rollsDamage`** (commit 108) — moves whose own resolution *is* "deal your
  damage" (Clash, Let Fly), detected by a hand-curated id list in the
  generator because the phrase also appears as one option inside moves that
  aren't about damage (Defend).

Note what is *not* stored: which stat a move rolls. That is read from the move's
own text ("roll +STR", "rolls +Fortunes"), so a playbook move and a basic move are
rollable by exactly the same rule, and the pack has no second copy of a fact to
disagree with.

### Typed insert schemas

Every playbook insert file (`data/insert-*.json`) that a play component actually
parses has its own strict schema in `pack-schemas.ts` — `insert-inventory`,
`insert-followers`, `insert-crew`, `insert-animal-companion`,
`insert-initiates-of-danu`, `insert-invocations`, `insert-ghost`,
`insert-revenant`, `insert-thrall` — with the generic `insertSchema` as the
fallback for any `insert-*.json` not listed. Strict objects on purpose: an
unknown key in pack data is a typo or a schema the code hasn't caught up with,
and either should fail validation, not ship silently.

## Document trees (rules reference)

A game's rules/SRD text ships as one or more **document trees** under the pack's
`rules/` folder, validated by `documentTreeSchema` (`src/lib/reference/document-tree.ts`).
A tree is a flat, document-ordered list of sections — each with a stable `id`
(the deep-link target), `title`, heading `level`, ancestor `path`, `body`
markdown, optional print `pages`, optional `kind`, optional `chapter`, and a
`player`/`gm` `visibility` flag. Nesting is rebuilt from `level` for a table of
contents; search stays a linear scan.

**`chapters` and `chapter`.** Each source file is a first-class chapter node:
the tree carries a document-ordered `chapters` list (`documentChapterSchema`)
with an `id` (the file-slug prefix its section ids are built from), a `title`,
and an optional `number` — both parsed from the filename by `build_srd.py`
(`03 - Playing the Game.md` → number 3, title "Playing the Game"; a file with
no leading number, e.g. a `Playbooks/*.md` entry, is still its own chapter,
just unnumbered). Every section carries a matching `chapter` id back into that
list. Both fields are optional on the schema — a tree with no `chapters` (or a
section with no `chapter`) still validates — because the schema change and the
content regen are deliberately separate commits (phase 12); the pipeline
itself always emits both once a tree is rebuilt. Two per-document
`srd.config.json` knobs (phase 22) tame corpora whose filenames or heading
structure don't parse cleanly: `chapterTitles` overrides a stem's parsed
title/number (HMtW's appendices stop inheriting positional chapter numbers),
and `demoteExtraH1` cascades every heading after a file's first down one
level, so a multi-H1 file keeps the book's real tree instead of flattening
into siblings.

**Page granularity** (`referencePageDepth`, a game-module slot — phase 22).
The tree stays one-section-per-heading; *display* granularity is the game's
choice. Headings at or above the declared depth get pages; deeper sections
render inline on their nearest page ancestor as real headings carrying the
section id as an anchor, and an inline section's URL redirects to
`parent#anchor` — so search hits, wikilinks, and old deep links survive.
Absent, every heading is a page (stonetop). HMtW sets 3: talents and
statblock fragments read as one page.

**Pinned search terms** (phase 22). A pack may ship a hand-authored
`content/<game>/index-terms.json` (the book's own index vocabulary);
`build:search` resolves every target through the link index — failing the
build on dead anchors — and emits `pinned-terms.json` / `pinned-terms-gm.json`
split by target visibility, because the term labels are themselves the
spoiler. Matching terms pin above the fuzzy search hits; the GM artifact
loads only on spoiler opt-in. No source file → no artifact → no UI.

**`kind`.** A heading can come from an Obsidian callout instead of a plain
`#…` line — `> [!move] ## **CLASH**` opens a section exactly like a heading
would, but also tags it `kind: "move"`. Both build scripts recognize the
pattern (`build_rules.py` for anchor mapping and link verification,
`build_srd.py` for section-splitting); the callout type travels through
untouched as `kind` for the renderer to key styling off later (`[!move]`,
`[!monster]`, `[!box]`, …). The section's `body` still contains the callout's
raw `>`-continuation markdown, unstripped — rendering it as a styled aside
instead of a blockquote is the renderer's job, not the pipeline's.

The trees are **generated**, the second stage of the content pipeline:

```
vault --build_rules.py--> content/<game>/rules/*.md --build_srd.py--> <pack>/rules/*.json
```

`tools/build_srd.py` reads `tools/srd.config.json`, which maps each source book
folder to an output document (`id`, `title`, `visibility`, optional `exclude`
list for back-matter like indexes). Each markdown heading becomes a section whose
body is the prose directly under it; over-long OCR-artifact "headings" are demoted
to body text so they stay searchable without polluting the TOC. Re-run after
regenerating the rules or editing the config; never hand-edit the JSON.

A game module opts in by pointing its `schemaFor` resolver at `documentTreeSchema`
for `rules/*.json` and listing the generated files in its manifest.

A third pipeline stage, `tools/build_search.ts` (`npm run build:search`), flattens
the document trees into a MiniSearch index written to `<pack>/search-index.json`.
That file is a derived artifact, **not** listed in the manifest (so the harness
leaves it alone); it is served statically and loaded in the browser for
client-side, offline-capable search. Regenerate it whenever the trees change.

The same stage also writes `<pack>/link-index.json` (phase 21): the compact
wikilink lookup (`title`/`^block-id` → section id) that surfaces *outside* the
reference — move cards, steading lines, anything printing pack text that quotes
vault cross-references — fetch instead of the full trees, via
`fetchLinkIndex` + `resolveWikilinks` in `$lib/reference`. Derived like the
search indexes: not in the manifest, never hand-edited, regenerated together.

**Visibility.** Each section carries a `player`/`gm` flag — set for a whole
document via the config's `visibility` (Stonetop's Book II), or per source file
via the document's `fileVisibility` map (HMtW's interleaved GM chapters). The
gate is a *reader opt-in*, not a permission (commit 97 replaced the old hard
gate): each game's spoiler preference (`reference.showSetting.<gameId>`,
`SpoilerToggle` in the reference sidebar) feeds `isVisible(section, gmVisible)`
in `$lib/reference/load`. Until opted in, gated sections — and any chapter left
with no visible sections — drop from the table of contents, a gated section URL
renders the game's interstitial with the opt-in button rather than a flat 404,
and search ships as two indexes (`search-index.json` / `search-index-gm.json`,
likewise the pinned-term artifacts) with the GM half fetched only after opt-in.
This is still an application-level hide, not access control: the raw GM tree
JSON remains fetchable by URL, which matches the books' own "it's okay for
players to read this if they want to" stance.

## The GM guide (structured reference)

The rules reference above is generated, uniform document-tree prose. A game's
**GM guide** is the other kind of reference: heterogeneous, hand-structured data
— an agenda list, move menus, numbered build procedures, `d6` outcome tables,
and a flow-of-play node/edge graph — that wants bespoke rendering rather than a
markdown body. It ships as a single pack file (Stonetop: `data/the-gm.json`,
validated by `gmSchema`) and is surfaced by the shell at `/<game>/gm`.

A game opts in through one optional slot on its `GameModule`:

```ts
gmGuide: {
  packFile: 'data/the-gm.json',   // shell fetches /content-packs/<game>/<packFile>
  sections: GM_SECTIONS,          // [{ id, title }] — the sidebar nav + route ids
  component: GmGuide              // renders one section from the (opaque) pack data
}
```

The shell stays game-agnostic: its `/gm` layout fetches `packFile`, renders the
`sections` nav, and mounts the game's `component` per section — it never inspects
the pack shape. The guide is **read-only reference**, so it is deliberately *not*
an entity type (nothing is saved). Interactive tables (Die of Fate, weather) and
diagrams are the game component's concern, built from the same typed pack data.
The GM guide is public today (unlike GM-only *rules* documents, which stay gated
by `GM_CONTENT_VISIBLE`); if a future game's guide needs gating, that is the
same phase-9 gate to reuse.

## The dice slot (module code, not pack data)

Dice are **code, not pack content**, and they hang off the **entity type**, not
the game (`EntityTypeModule.dice`; moved there in phase 11, because a roll belongs
to the thing being played — a steading rolls its own moves, never "+STR"). The
shell owns a generic dice core (`$lib/dice`: `XdY±mod` notation, an injectable-rng
`roll`, advantage/disadvantage); a type opts in by supplying **presets** and a
resolver:

```ts
dice: {
  presets: [
    { id: 'roll-dex', label: 'Roll +DEX', notation: '2d6', meta: { stat: 'DEX' } }
    // …
  ],
  // The modifier lives inside the game's own character shape, which the shell
  // holds opaquely — so the shell hands both back and rolls what it gets.
  resolve: (preset, entity) => ({ label: 'Roll +DEX (+2)', notation: '2d6+2' })
}
```

Each preset is an id, a game-visible `label` (the game's words, per rule 3), a
base `notation` the generic core parses, and an opaque `meta` bag only the game
reads (Stonetop stores which stat the roll adds). A game's sheet can also roll
directly through `PlayProps.roll(label, notation)` — that is what tapping a stat
or a move does. The presets live in the module
(`src/lib/games/<gameId>/dice.ts`), not the pack, because they are structural
rather than licensed text; a game's stat vocabulary is drawn from its engine so it
can't drift. See `architecture.md`, "The dice slot".

## The wizard summary hook

`EntityTypeModule.summary(draft)` feeds the wizard's choices-so-far rail: it
returns already-human `{ label, value, stepId }` rows, grouped into titled
sections. The shell renders them and links each back to the step that owns it; it
never inspects the draft. Resolving an id to a name means reading the pack, so the
hook may be async (Stonetop's reads the chosen playbook, memoised).

## Per-game theming

A game themes itself: ship a `theme.css` in the module, import it from the
module's own entry, and override the shell's `--sb-*` tokens under
`html[data-game="<gameId>"]` (plus `html.dark[data-game="<gameId>"]` for the dark
variant). The shell stamps `data-game` on `<html>` for that game's routes and does
nothing else; a game with no theme gets the shell's defaults. Fonts are
self-hosted so a pack's look doesn't depend on a third-party CDN — Stonetop
ships Libre Caslon Text and IM Fell English via `@fontsource/*`, plus Avara
(the book's heading face) extracted into `static/fonts/` by
`tools/extract_avara_font.py`.

## The end-of-session slot

`GameModule.sessionComponent` is the game's end-of-session ritual, surfaced by the
shell at `/campaigns/[id]/session`. The shell supplies the table (characters +
steading, opaque), a GM-authorised `save`, and `roll`; the game asks the questions
and computes the awards. The shell persists exactly the blob the game hands it.

Since phase 17 the props also carry `record(run)`: after every sheet takes its
award, the game writes the run into the campaign's session ledger — its own
answer shape as opaque `triggers`, plus the two things the ledger renders
(award lines and notes) already shaped for display. The shell assigns the
session number and the date; see `architecture.md` for the table.

## The table-reference slot

`GameModule.tableReference` (commit 113) is a player-facing handout page —
Stonetop's Moves & Gear — surfaced by the shell at `/[game]/table` and linked
from the game landing and the play view. `label` is nav chrome; the component
fetches its own pack data, exactly like the session component. Absent → no
page, no links.

## Adding a new game

This file is the **pack-format reference** — the manifest, validation, document
trees, and the GM-guide pack shape above. The end-to-end **walkthrough** for adding
a game (pack → schemas → engine → module → register → prove), written against the
real Stonetop module, is `docs/adding-a-game.md`. The boundary it keeps: everything
touches only `static/content-packs/<gameId>/` and `src/lib/games/<gameId>/`, plus
the two one-line registrations — if a step needs a shell change, that is the
abstraction moment, made deliberately in its own commit (rules 1–3 in
`architecture.md`).
