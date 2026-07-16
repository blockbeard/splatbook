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

**Entity types** is a map keyed by the persisted `entityType`. Each entry’s slots are
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
manifest. Trees are generated from vault markdown by `tools/build_srd.py` (config in
`tools/srd.config.json`) — never hand-edited — and a build-time MiniSearch index
(`npm run build:search`) powers offline client-side search. Details in
`docs/content-packs.md`.

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
