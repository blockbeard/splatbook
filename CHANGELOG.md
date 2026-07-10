# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Extras wizard step: the playbook-specific back-page sections (sacred pouch,
  tall tales, war stories, fear & anger, collection…), fully data-driven from
  the pack — intro text, pick-one-per-line lists, nested choices, and free-text
  prompts. New typed `ExtrasSectionState` on the character model; the validator
  requires each line and nested pick (prompts stay optional). Playbooks with no
  extras skip the step cleanly.
- Possessions wizard step: fixed gear is listed, then the player picks the
  allowed number from the options — some carrying sub-choices (rendered with the
  shared `ChoiceGroup`) or a free-text write-in slot. The engine validator
  enforces the exact pick count, filled write-ins, and each item's own nested
  picks (shared `possessionChoiceKey`/`isWriteInPossession` helpers).
- Starting-moves wizard step — the rules-lawyer core. Shows what the playbook
  and background grant, resolves each "choose one" group, and gates free picks
  to the count allowed, with level-2+ moves excluded and prerequisite/`childOf`
  moves disabled until their parent is taken. Engine gains pure, test-first move
  logic (`startingMovesPlan`, `pickOneSelections`, `freeChosenMoves`,
  `fullMoveSet`, `isStartable`, `prerequisitesMet`, `choosableMoves`) and a moves
  validator enforcing one-per-group, the exact choose count, and legality of
  every chosen move.
- Stats wizard step: distribute the playbook's fixed six-number array across
  STR/DEX/CON/INT/WIS/CHA, each value used once, with values disabling as they're
  spent and live "all assigned" feedback. Engine gains pure, test-first stat
  helpers (`assignStat`, `clearStat`, `assignedValues`, `remainingValues` with
  multiset arithmetic, `isStatArrayComplete` permutation check) and a stats
  validator gating on a complete assignment.
- Instinct, appearance, and origin/name wizard steps. Instinct picks one of the
  playbook's drives, with a write-in option that reveals a text field (new
  `instinctWriteIn` on the character model). Appearance picks one descriptor per
  printed line. Origin chooses where you're from and names the character, with
  suggested names from the chosen origin as one-tap fills. Engine validators for
  all three replace their stubs (instinct chosen + write-in text when needed,
  one pick per appearance line, origin chosen and character named).
- Background wizard step: choose a background, see what it grants (moves, notes,
  a tracker), and resolve any nested "choose N" picks (e.g. the Blessed's
  initiates, with a free-text write-in). Adds shared wizard components —
  `Markdown` (trusted pack markdown), `OptionButton` (selectable card), and
  `ChoiceGroup` (a controlled sub-choice picker) — and a memoised
  `fetchPlaybook` so every step downstream of playbook-select shares one fetch.
  Engine gains pure, unit-tested sub-choice logic (`selectionCount`,
  `isSelectionValid`, `canPickMore`, `toggleOption`) and real validators for the
  playbook and background steps (replacing their stubs): a character now needs a
  playbook, a background, and each background pick within range.
- Playbook-select step and the character builder route: `/g/<game>/build`
  renders a game's wizard from the registry (steps + a `newDraft` factory, the
  new generic `GameModule` slot for seeding a draft) without importing game
  code, so any game that registers a wizard gets a builder for free. Stonetop's
  first step lists the nine playbooks with their flavor text (fetched from the
  pack via `fetchPlaybookSummaries`, which projects id/name/flavor and skips the
  steading/GM sheets); picking one records it on the draft and the shell
  autosaves. A "Build a character" link joins "Rules reference" on the game
  landing page. Loader unit-tested (file filtering, projection, fetch-error).
- Generic wizard shell (`src/lib/wizard/`): a game-agnostic step runner that
  renders a game module's ordered `WizardStep`s one at a time with a progress
  bar and Back/Next, and autosaves the working draft to localStorage so a
  half-built character survives a reload. The shell never inspects the draft's
  shape — steps read the content pack, the shell just navigates. Pure,
  unit-tested logic (`navigation`: index clamping, next/prev, progress fraction;
  `autosave`: namespaced `draftKey`, save/load round-trip over an injected
  storage, corrupt-JSON tolerance) sits behind a thin `Wizard.svelte`. Steps are
  registered with `defineWizardStep` (the single contained cast around Svelte's
  contravariant component props); `GameModule.wizardSteps` is now typed
  `readonly WizardStep[]`. Stonetop registers no steps yet — those land next.
- Stonetop engine skeleton (`src/lib/games/stonetop/engine/`): the game's pure
  rules layer, attached to the module's `engine` slot and opaque to the shell. A
  Stonetop-specific character model (playbook/background/instinct/appearance/
  origin/stats/moves/possessions/extras/introductions plus box trackers, HP, and
  advancement), stamped with a `SCHEMA_VERSION` the module will migrate against.
  Pure helpers (`createCharacter`, `setTrackerMarks` clamping to `[0, boxes]`,
  `statValue`) and a validation framework: one `Validator` per wizard step keyed
  by `StepId`, composed by `validateCharacter` into severity-tagged `Issue`s with
  `isComplete` gating on errors. Only the schema-version check has teeth today;
  the per-step validators are empty stubs that firm up as their steps land
  (21–28). No UI/DB/SvelteKit imports; unit-tested.
- GM-only visibility flag and Book II ingest: Stonetop's Book II (The Wider World,
  2,003 sections) is now built into the pack as `rules/book-ii.json`, flagged
  `gm`. A single gate (`GM_CONTENT_VISIBLE` in `$lib/reference/load`, `false` for
  now) drops GM content from the table of contents, returns 404 for GM sections
  addressed directly, resolves wikilinks only against visible content, and
  excludes GM text from the public search index. `build_srd.py` now writes an
  explicit `visibility` on every section. This is an application-level hide, not
  access control — phase 9 (campaigns) makes it a real GM gate.
- Expandable search snippets (`$lib/reference/snippet`): each result now shows the
  first sentence that mentions a query term with the terms highlighted (`<mark>`,
  apostrophe-flexible), a "more" control that expands the snippet in place to its
  surrounding sentences, and the title still links to the full section — the
  snippet → context → full-section progression lifted from Chris's Obsidian rules
  tool. Keystrokes are debounced. The search index now stores each section's
  plain-text body so snippets work offline; unit tests cover tokenizing,
  highlighting (with HTML escaping), and snippet windowing.
- Client-side rules search (`/g/<game>/reference/search`): a MiniSearch index is
  built at build time from the document trees (`tools/build_search.ts`, `npm run
build:search`) and served as a static `search-index.json`, so search runs
  entirely in the browser — no server cost, works offline once cached. Live
  prefix + fuzzy matching over titles, breadcrumbs, and body text with title
  boosting; results link to sections; a search box sits in the reference sidebar
  and the query syncs to a shareable `?q=`. Shared index config and markdown→text
  prep (`$lib/reference/search-fields`) keep the builder and client in agreement;
  unit-tested including a serialize→load round-trip. Adds `minisearch`.
- Rules reference section browser (`/g/<game>/reference`): a table-of-contents
  sidebar (nested from heading levels, auto-expanding the active branch), section
  pages with breadcrumb ancestors, in-section child lists, and document-order
  prev/next. Every heading is its own page with a shareable deep link. Section
  bodies render from markdown via `marked`, with Obsidian wikilinks resolved to
  in-app reference links where their target is identifiable and falling back to
  plain label text otherwise. Loading/navigation helpers (`$lib/reference/load`)
  and the renderer (`$lib/reference/render`) are unit-tested; `buildSectionTree`
  is now generic so the lightweight TOC nests the same way full sections do.
  Adds `marked` as a dependency.
- SRD build script (`tools/build_srd.py` + `tools/srd.config.json`): the second
  stage of the content pipeline, turning the generated rules markdown into
  document-tree JSON in the pack (`rules/*.json`). Each heading becomes a section;
  over-long OCR-artifact headings are demoted to body text; back-matter (index,
  acknowledgements) is excluded via config. Book I ingested as `rules/book-i.json`
  (1,421 sections), wired into the Stonetop manifest and `schemaFor` resolver, and
  validated by `npm run validate:packs`. Regenerate with `python3 tools/build_srd.py`.
- Document-tree format (`$lib/reference/document-tree`): the generic shape any
  game's rules/SRD text takes in a content pack. A flat, document-ordered list of
  sections (stable `id`, `title`, heading `level`, ancestor `path`, `body`
  markdown, optional print `pages`, `player`/`gm` `visibility`); hierarchy is
  rebuilt from `level` by `buildSectionTree` while search stays linear. Section
  ids are validated unique within a tree. Round-trip tests cover defaults, strict
  keys, level bounds, tree-building, and duplicate detection.
- `docs/content-packs.md`: pack format reference (envelope, validation, strictness
  policy) and the first draft of the "adding a new game" walkthrough. Kept current
  with any commit touching the pack boundary.
- Round-trip tests for the Stonetop pack: every manifest file parses into its typed
  structure through the harness; playbook/background/instinct/move/insert ids are
  snapshotted so accidental renames fail CI; move references (starting, grants,
  requires, childOf, replaces) are checked to resolve within their playbook.
- Stonetop content pack (`static/content-packs/stonetop/`): 9 character playbooks,
  9 inserts, the steading, and the GM playbook (2nd printing text, CC BY-SA 4.0,
  attribution Jeremy Strandberg / Lampblack & Brimstone; pack-level LICENSE note).
  Stonetop Zod schemas written from the pack's SCHEMA.md — playbooks validate
  strictly; insert/steading/GM interiors stay loose until their phases consume
  them. First registered game module: `/g/stonetop` resolves.
- `GameModule` interface and registry — the only door between shell and game code
  (`id`, `name`, `packSchemas` now; engine/wizard/sheet slots firm up in phase 3).
  Registering a game wires its pack schemas into the validation harness. Game routes
  live under `/g/[game]`; header nav links registered games (no picker until game #2).
- Pack validation harness: Zod schemas for the generic envelope (manifest, document
  tree); game modules register per-file schemas via `registerPackSchemas()`, and
  `npm run validate:packs` checks every pack on disk — unregistered games and
  unrecognised files are errors, not warnings. CI-friendly (non-zero exit).
- Content-pack envelope: `PackManifest` type (`id`, `name`, `version`, `license`,
  `attribution`, `files`) and a node-side loader (`$lib/packs/fs-loader`) that checks
  the envelope contract — id matches folder, listed files exist — for build tooling
  and validation. Packs live under `static/content-packs/<gameId>/`.
- SvelteKit 2 scaffold: Svelte 5 (runes forced), TypeScript strict, Vitest.
- GPL-3.0-or-later license for the application source.
- Tailwind CSS v4 with semantic theme tokens (`--sb-*` custom properties) that game
  modules can override per `data-game` scope; light/dark mode with pre-paint script.
- App shell layout: header, nav placeholder, footer, theme toggle.
- ESLint (flat config, typescript-eslint + eslint-plugin-svelte), Prettier with svelte
  and tailwind plugins, and a GitHub Actions CI running lint/check/test/build.
- Drizzle ORM + better-sqlite3 with an (intentionally) empty schema, `db:push` /
  `db:generate` / `db:migrate` / `db:studio` scripts, and a `/api/health` endpoint
  that pings the database.
- Multi-stage Dockerfile (adapter-node) and docker-compose with a SQLite volume
  for the atlas deployment; container healthcheck hits `/api/health`.
- `docs/architecture.md`: the three layers, the GameModule boundary rules, the
  entity blob model, theming and naming conventions.
