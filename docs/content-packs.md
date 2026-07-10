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
the id of the registered `GameModule`, and the `/g/<gameId>` URL segment.

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
`SCHEMA.md` — are documentation and travel with the pack unvalidated.

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
for Stonetop, `content/stonetop/rules/` is produced from the Obsidian vault by
`tools/build_rules.py` and must never be hand-edited (see `CLAUDE.md`). Hand-
maintained structured data (`data/*.json`) is source, not output; its human-
readable schema lives in the pack's `SCHEMA.md`.

## Document trees (rules reference)

A game's rules/SRD text ships as one or more **document trees** under the pack's
`rules/` folder, validated by `documentTreeSchema` (`src/lib/reference/document-tree.ts`).
A tree is a flat, document-ordered list of sections — each with a stable `id`
(the deep-link target), `title`, heading `level`, ancestor `path`, `body`
markdown, optional print `pages`, and a `player`/`gm` `visibility` flag. Nesting
is rebuilt from `level` for a table of contents; search stays a linear scan.

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

**Visibility.** Each section carries a `player`/`gm` flag (a whole document can be
made GM-only via the config's `visibility`, e.g. Stonetop's Book II). The gate
lives in one place, `GM_CONTENT_VISIBLE` in `$lib/reference/load` — a hard `false`
today, so GM sections are dropped from the table of contents, return 404 if
addressed directly, and are excluded from the public search index entirely. This
is an application-level hide, not yet access control: the raw `rules/book-ii.json`
is still fetchable by URL. Phase 9 (campaigns) turns the flag into a real gate
keyed on campaign-GM membership; that is the point to also stop serving GM trees
to non-GM clients.

## Adding a new game (first draft)

*This walkthrough gets refined every time the boundary is exercised, and gets a
full rewrite against reality when game #2 actually lands (plan, commit 56). The
test of the framework: all of this touches only `static/content-packs/<gameId>/`
and `src/lib/games/<gameId>/` — if a step needs a shell change, that is the
abstraction moment, and the shell change happens deliberately, in its own commit.*

1. **Make the pack.** `static/content-packs/<gameId>/` with `manifest.json`
   (id = folder name), `LICENSE.md` recording the text's license and attribution
   — check the publisher's fan-content / licensing position *first* — and your
   data files under `data/`. Write a `SCHEMA.md` as you go; it is the document
   you will thank yourself for.
2. **Write the schemas.** `src/lib/games/<gameId>/pack-schemas.ts`: Zod schemas
   for your data files and a `schemaFor(relPath)` resolver. Start strict for
   whatever the app will consume first; pin envelopes for the rest.
3. **Create the module.** `src/lib/games/<gameId>/index.ts` exporting a
   `GameModule` (`{ id, name, packSchemas, entityTypes: {} }` to begin with).
   Each entity type your game offers (character, steading, …) is an entry in
   `entityTypes`, keyed by its persisted `entityType`; its slots (`label`,
   `newDraft`, `entityMeta`, `wizardSteps`, `sheetComponent`, `playComponent`)
   fill in as the game grows into the later phases. All slots are optional — a
   wizard-built type sets `wizardSteps` + `newDraft`; an editor-first type
   (steading) leaves `wizardSteps` empty and puts its editor in `playComponent`.
4. **Register it.** Add one `registerGame(<game>)` line to
   `src/lib/games/index.ts`. This is the only edit outside your two folders.
5. **Prove it.** `npm run validate:packs` green; add round-trip tests like
   `src/lib/games/stonetop/pack.test.ts` (parse every file, snapshot ids,
   check cross-references). `/g/<gameId>` now resolves, and the header nav
   becomes a game picker the moment a second game exists.

What you do *not* do: import another game's module, put game strings in app
code, or bend a shell abstraction to fit — rules 1–3 in `architecture.md`.
