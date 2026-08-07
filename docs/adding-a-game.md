# Adding a game

The framework promise, stated plainly: **adding a second game touches only two
folders** — `static/content-packs/<gameId>/` (its text and data) and
`src/lib/games/<gameId>/` (its schemas, engine, and UI) — plus a single line to
register it. If a step needs a change anywhere else in the shell, that is the
extraction moment: make the abstraction deliberately, in its own commit, with two
real games in hand (see `architecture.md`, "What done looks like").

This walkthrough is written against the real Stonetop module, so every step points
at code you can open and copy. Stonetop exercises the whole surface — a
wizard-built entity type (characters), two editor-first ones (steadings, threats),
a rules reference, and a GM guide — so a new game will use some subset of it.

**The promise has now been walked twice.** His Majesty the Worm (phase 22) is the
minimal subset: a rules reference and nothing else — no entity types, no engine,
no GM guide. It landed in `content/hmtw/` + `static/content-packs/hmtw/` +
`src/lib/games/hmtw/` plus the two registration lines, exactly as promised; the
handful of shell extractions it needed (optional `entityTypes`, per-game spoiler
keys, `landing.json`, embed mode) were made deliberately, each in its own
commit, before the pack landed. `src/lib/games/hmtw/` is the reference-only
crib: four small files (module, pack-schemas, pack test, theme).

## The layers, in one breath

Content pack (JSON/markdown, no code) → engine (pure TypeScript, no UI/DB imports)
→ app (the shell iterates your module through the `GameModule` registry). The three
rules in `architecture.md` hold throughout: the shell reaches game code only via the
registry, game modules never import each other, and every game-visible string lives
in the pack.

## 1. Make the content pack

Create `static/content-packs/<gameId>/` with:

- **`manifest.json`** — `id` (= the folder name), `name`, `version`, `license`
  (SPDX, e.g. `CC-BY-SA-4.0`), `attribution` (the credit line the `/credits` page
  shows), and `files` (every data file, pack-relative). See
  `static/content-packs/stonetop/manifest.json`.
- **`LICENSE.md`** — the text's license and attribution. **Check the publisher's
  licensing / fan-content position first.** Stonetop's text is CC BY-SA 4.0, which
  grants reproduction and adaptation with attribution + share-alike; the pack is
  therefore itself CC BY-SA 4.0 (`static/content-packs/stonetop/LICENSE.md`).
- **`data/…`** — your structured data. Write a `SCHEMA.md` beside it as you go; it
  is the document you will thank yourself for when you write the Zod schemas.
  A reference-only game has none — HMtW's pack is its rules trees, a
  `landing.json`, and licensing.
- **`landing.json`** (optional) — the game's front-door copy: tagline, blurb,
  a logo image, outbound buy links. Shell-owned schema
  (`$lib/packs/landing.ts`), returned by your `schemaFor` for that filename;
  without one the shell shows honest defaults (builder-speak only if you have
  builders).
- **`art/…`** (optional) — pack-owned images the theme or landing reference by
  URL. Not manifest-listed: the manifest lists validated JSON only.

Pack files are validated at build/CI and then trusted at runtime, so the app fetches
them without re-parsing through Zod. See `docs/content-packs.md` for the manifest,
validation, document-tree (reference), and GM-guide pack formats in detail.

## 2. Write the pack schemas

`src/lib/games/<gameId>/pack-schemas.ts`: Zod schemas for your data files plus a
`schemaFor(relPath)` resolver that maps a pack-relative path to its schema (this is
what the validation harness calls). Start **strict** for whatever the app consumes
first and pin looser envelopes for the rest, firming them up in the phase that
consumes them — Stonetop's GM playbook was a loose envelope until the GM tools were
built (`src/lib/games/stonetop/pack-schemas.ts`). Export the inferred types; the UI
and engine import them.

## 3. Write the engine

`src/lib/games/<gameId>/engine/`: pure functions implementing the rules — the entity
model(s), validators, level-up legality, tracker logic. **No UI, DB, or SvelteKit
imports.** Each entity type gets a shape, a `create…()` seed, and a `migrate…()` that
brings older blobs up to the current `schemaVersion`. Keep the subtle rules test-first
(`*.test.ts` next to the code): Stonetop's level-up legality, threat portents, and the
flow-diagram geometry are all unit-tested. This purity is what makes a game module
portable and its rules trustworthy.

## 4. Create the game module

`src/lib/games/<gameId>/index.ts` exports a `GameModule`:

```ts
{
  id, name,
  packSchemas: schemaFor,   // from pack-schemas.ts
  engine,                   // opaque to the shell
  entityTypes: { … },       // one entry per creatable/saveable thing
  gmGuide?: { … }           // optional GM reference guide
}
```

**Entity types** is a map keyed by the persisted `entityType` — and the whole map
is optional (phase 22): a reference-only game omits it, and the shell then offers
no builders, sheets, or campaign creation for that game. Each entry’s slots are
all optional, so a type is only as big as it needs (`src/lib/games/types.ts`):

- A **wizard-built** type (Stonetop `character`) sets `newDraft` + `wizardSteps`
  (rendered by the generic wizard shell), a read-only `sheetComponent`, and an
  editable `playComponent`.
- An **editor-first** type (Stonetop `steading`, `threat`) skips `wizardSteps`: it’s
  an editable sheet from birth, so its editor goes in `playComponent` and the shell’s
  "create" action routes straight there. `entityMeta(draft)` reports the `name` and
  `schemaVersion` the shell persists, without the shell ever parsing your blob.

The shell **iterates this map** — routes are `/[game=game]/[type]/{build,play,sheet}`,
and the dashboard/landing page/save-load all read the type from the map key. Stonetop
added a third entity type (`threat`) in phase 7 with no shell change at all; that is
the map doing its job.

**GM guide** (optional, `gmGuide`) is the other registry slot: read-only reference
material that isn’t an entity type (nothing is saved). It declares its pack file, its
ordered nav `sections`, and a `component` that renders one section; the shell serves
it at `/[game=game]/gm` without inspecting the pack shape. See
`src/lib/games/stonetop/gm/`.

## 5. Register it

Two one-line edits, both required and kept in sync:

- `src/lib/games/index.ts` → `registerGame(<game>)` (the app shell; loads your
  Svelte components).
- `src/lib/games/schemas.ts` → `registerPackSchemas('<gameId>', schemaFor)` (the
  UI-free registration that `validate:packs` uses, since its tsx runner can’t load
  `.svelte` files).

`/<gameId>` now resolves (the `game` param matcher only accepts registered ids,
so static routes can never be shadowed), and the header nav becomes a game
picker the moment a second game exists.

## 6. Rules reference (optional)

Ship the SRD as one or more **document trees** under the pack’s `rules/` folder,
point `schemaFor` at `documentTreeSchema` for `rules/*.json`, and list them in the
manifest. Trees are generated from vault markdown by `tools/build_rules.py` (a
per-game `tools/rules.<gameId>.json` config: source dirs, excludes,
truncate-at-heading, callout stripping, link rewrites) then `tools/build_srd.py`
(config in `tools/srd.config.json`) — never hand-edited — and a build-time
MiniSearch index (`npm run build:search`) powers offline client-side search.

Corpus knobs phase 22 added, all per-document in `srd.config.json`:
`demoteExtraH1` for multi-H1 source files, `chapterTitles` overrides for stems
that don't parse into clean numbers/titles, and `fileVisibility` to gate
individual GM files inside one folder. A `referenceSpoilers` module slot names
the opt-in toggle/badge and an `interstitialSectionId` so links into gated
content land on an explanation instead of a 404. A pack can also ship curated
pinned search terms (`content/<gameId>/index-terms.json` → split player/GM
artifacts at build). Details in `docs/content-packs.md`.

## 7. GM guide (optional)

If the game has GM-running material, ship it as a single structured pack file and add
the `gmGuide` slot (step 4). The interactive bits — rollable tables, diagrams — are
your component’s concern, built from the same typed pack data; keep their logic in
pure, tested helpers (Stonetop’s `gm/roll.ts`, `gm/diagram.ts`).

## 8. Theme it (optional)

Override the `--sb-*` design tokens under a `[data-game="<gameId>"]` scope in your own
CSS (`architecture.md`, "Theming"). Never introduce raw colors in components.

## 9. Prove it

- `npm run validate:packs` green (every pack file parses against its schema).
- Round-trip tests like `src/lib/games/stonetop/pack.test.ts`: parse every file,
  snapshot the ids so an accidental rename fails CI, check cross-references.
- `npm run check`, `npm run lint`, `npm test`, `npm run build` all green — the
  quality bar every commit meets.

## What you do _not_ do

Import another game’s module; put game-visible strings in app code; or bend a shell
abstraction to fit. Those are the three rules in `architecture.md`. If the shell is
genuinely missing something your game needs, grow the `GameModule` interface for it —
explicitly, in its own commit — exactly as `entityTypes` (phase 6) and `gmGuide`
(phase 7) were added.
