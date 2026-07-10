# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GM guide (phase 7).** Stonetop's GM playbook is now an in-app reference
  guide at `/g/stonetop/gm` — read-only, so it's not an entity type. The GM pack
  schema (`the-gm.json`) is now fully validated (typed `GmPlaybook`) rather than
  a loose envelope, and the guide renders from it across nine sections: the
  agenda/principles/core loop, GM moves & harm, threats and their type move
  lists, expeditions & travel (with the Die-of-Fate and weather tables), sites &
  discoveries, monster & follower build procedures, NPCs, home/downtime/
  aftermath, and the flow of play (commit 49). A game opts in through one
  optional `gmGuide` slot on its `GameModule` (`packFile` + `sections` +
  `component`); the shell serves and navigates it generically without inspecting
  the pack shape. `docs/content-packs.md` documents the slot.
- GM guide **interactive tables** (commit 50): the Die-of-Fate tables (When the
  Way is Perilous, Make Camp) and the six seasonal weather tables are rollable —
  tap to roll a d6 and the matching row lights up. The eight threat types are a
  picker with a "Suggest a move" random-portent button, and travel times gained
  a live place filter. The range-parsing and die-roll logic is a small pure
  module (`gm/roll.ts`) with unit tests; the components are thin shells over it.
- GM guide **flow diagrams** (commit 51): the flow of play renders as a node/edge
  diagram — the six campaign phases on a ring with curved, labelled, arrowed
  transitions — and the core loop as a numbered cycle with a "repeat" arc. Both
  are dependency-free SVG built from the pack's nodes/edges (and step) data; the
  ring layout and edge routing are a pure, unit-tested geometry module
  (`gm/diagram.ts`). The labelled transition list and step text remain beneath
  each diagram as the text-equivalent.
- **Threat worksheets (phase 7, commit 52).** Stonetop's *third* entity type — a
  GM worksheet for a lingering threat: its type, tracker (Homefront / Nearby /
  Distant), instinct, description, impending doom with markable grim portents,
  and optional stakes and moves. Editor-first like a steading (no wizard); a
  chosen type offers its GM-move list to drop into the worksheet, and there's a
  read-only print sheet. Threats save to the database and appear in the dashboard
  alongside characters and steadings — the entity-type map absorbed the third
  type with no shell changes, only a new `threat` entry and its pure engine
  model (`engine/threat.ts`, unit-tested). Reachable from the game home, the
  dashboard, and a link in the GM guide's Threats section.

- **Steading builder (phase 6).** Stonetop's second entity type. A
  steading has no build wizard — it's an editable tracker sheet from creation,
  reached via "Create a steading" on the game home or a fresh draft in the
  editor. The engine model covers the five numeric stats
  (Fortunes/Surplus/Population/Prosperity/Defenses) with their printed ranges,
  the Size ladder, the four-season cycle, and the three debilities, all as pure
  clamped functions. The editor (commit 44) steps stats, walks Size, picks the
  season, and toggles debilities, autosaving as you go. The steading pack schema
  (`the-steading.json`) is now fully validated rather than a loose envelope.
  Improvements (commit 45) render as collapsible cards: the engine normalises
  each Improvement's `requires` tree — `all`, choose-N, either-or, nested
  "establish" picks, sequenced follow-ups, and multi-box "Pull Together"
  requirements — into checklist groups, decides when requirements are met, and
  drives a Mark-complete toggle. Ticking a requirement is a pure engine op; the
  stat bumps an Improvement grants stay manual on the tracker.
- Steading **lists** (commit 46): editable Resources, Fortifications, Assets
  (with silver/gold treasure tallies) and Places of Interest (marker + name,
  suggesting the next map marker). A fresh steading is seeded once from the
  pack's printed starting entries and marked `seeded`, so lists you empty aren't
  refilled. Write-ins are just added rows.
- Steading **residents & neighbours** (commit 47): NPC tables. Residents are
  name / occupation / notes rows with `<datalist>` pickers drawn from the pack's
  Welsh name list, prefilled occupations, and NPC trait list; neighbours add a
  home select over the pack's places, with each place's own name list offered
  for the name field.
- Steading **print sheet & dashboard** (commit 48): a read-only, print-friendly
  steading sheet (stats, marked debilities, lists, completed Improvements,
  rosters) in the `sheetComponent` slot. Signed-in steadings now save to the
  database and appear in the dashboard alongside characters — an editor-first
  type creates its DB row on first edit and adopts the id, so there's no
  "Finish" step. The dashboard is now entity-type-agnostic (each row shows its
  type) and titled "Your sheets".

### Changed

- **`GameModule` now carries an `entityTypes` map** instead of a single flat set
  of character slots. Each entity type (`character`, `steading`, …) is keyed by
  its persisted `entityType` and owns its own optional
  `label` / `newDraft` / `entityMeta` / `wizardSteps` / `sheetComponent` /
  `playComponent`. The shell iterates the map rather than hard-coding
  `character`: routes moved from `/g/[game]/{build,play,sheet}` to
  `/g/[game]/[type]/{build,play,sheet}`, and the landing page, dashboard, and
  save/load read the type from the map key. Editor-first types (no wizard) route
  their "create" action straight to the editor (`playComponent`) and seed a fresh
  draft there. This is the phase-6 boundary generalization — the second entity
  type (steading) forced it; `entityMeta` no longer self-reports `entityType`
  (it's the map key). `docs/architecture.md` and `docs/content-packs.md` updated
  to match.

### Fixed

- `validate:packs` runs again: pack-schema registration moved to a UI-free
  module (`src/lib/games/schemas.ts`) so the tool no longer drags Svelte
  components through tsx. `registerGame` still wires schemas for the app shell;
  new games must register in both places.
- Playwright smoke: the fresh-database reset now runs inside the
  `webServer.command` chain (`e2e/reset-db.ts`) instead of `globalSetup`, which
  fired after the server had already opened (and kept a handle to) the old
  database file — every CI run failed with "no such table: users".
- CI workflow: `actions/checkout` and `actions/setup-node` bumped to v5,
  clearing the Node 20 runner deprecation warning.

## [0.2.0] - 2026-07-10

A character survives a whole campaign arc — the phase-5 milestone. Everything
since v0.1.0: accounts and persistence (phase 4), then play mode, advancement,
and the inventory sheet (phase 5).

### Added

- Inventory / Outfit view in play mode, driven by `insert-inventory.json` (whose
  insert schema is now firmed up from the loose envelope). Mark the gear and
  small items you're carrying; the total ◇ load shows your band (light / normal
  / heavy) and its tags. "Undefined" ◇ pools model marks reserved during Outfit
  but not yet assigned, and a per-item "← assign" action implements _Have What
  You Need_ — spending undefined marks onto a specific item. Inventory state
  lives on the character model (filled by the migration); all the load maths and
  transfers are pure engine functions with unit tests.
- Advancement log: the character sheet and play mode now show, in order, when
  each move (and stat bump) was gained — "Level N: <Move>", annotated with the
  raised stat or the move it replaced. The sheet's move list now reflects the
  character's current holdings (creation moves plus advancement, minus retired
  moves) and shows the character's level in the header.
- Advancement special cases (rules-as-data + engine + play UI):
  - **Improved / Superior Stat** now raise a stat. Both moves carry a
    data-driven `statBump` cap (Improved +2, Superior +3); the level-up flow
    prompts for which stat, offers only stats below the cap, and the engine
    applies the capped +1 and records which stat was raised.
  - **Potential for Greatness → Superior Stat gate.** The Would-be Hero's
    Potential for Greatness is now a 6-box tracker, and its Superior Stat is
    gated (via a new `requires.tracker` in the pack) on all 6 marks rather than
    a level — enforced in the legal-choices engine.
  - **Would-be Hero's asterisk rule.** Once the character holds an asterisk move
    (the level-6 replacements), play mode offers a "cross off Would-be" action;
    doing so flags the character a Hero (a new generic `flags` map on the model,
    filled by the migration).
- Level-up flow in play mode: once banked XP clears the threshold, a "Level Up"
  button opens a panel of only the legal moves (per the engine's gates,
  prerequisites, caps, and replacements), each shown with its rules text. Pick
  one and confirm; the engine spends the XP, raises the level, records the pick,
  and the change autosaves. Cancel backs out. Multiple level-ups in a row are
  supported — the button reappears while enough XP remains.
- Level-up legality in the engine (pure, heavily unit-tested): given a character
  and its playbook, which moves are legal to take on Level Up, and applying the
  chosen one. Level gates (a `requires.level` move opens as you reach that
  level), prerequisite moves (`requires.moves` / `childOf` must be held),
  repeat caps (`maxTakes` — Improved Stat ×3, etc.), and replacements (a move
  with `replaces` retires the named move and is only offered while it's still
  held). `applyLevelUp` spends the XP cost (6 + twice the current level), gains
  a level, records the pick in an advancement log, and re-syncs move-trackers so
  a newly-gained tracker move appears. The character model gains an
  `advancement[]` log (schema v2) with a tolerant `migrateCharacter` that
  upgrades older blobs on load.
- Play mode: an editable, at-the-table view of a finished character at
  `/g/<game>/play`, reached from the character sheet. Tap-to-mark HP, XP, and
  move-trackers; tap a stat to toggle its debility (which shows the reduced
  effective value and the playbook's debility name). A "Ready to Level Up" cue
  appears once banked XP clears the threshold (the level-up flow itself lands
  next). Every edit runs a pure engine function and autosaves — to the database
  when playing a saved entity, else to the same local draft slot the sheet
  reads. The shell gained a generic `playComponent` slot alongside the sheet
  slot; the route stays game-agnostic and persists whatever the game returns.
- Play-mode state model (engine, pure + unit-tested): the rules over a character
  _in play_. Vitals seed from the playbook the first time a finished character
  enters play (HP fills to max, base damage recorded; re-entry preserves current
  HP, only re-clamping). Move-trackers (Boon, Resolve, Piety…) reconcile against
  the moves a character currently holds — a tracker appears when its move is
  gained and vanishes when it's retired, marks preserved and re-clamped.
  XP/level helpers implement Stonetop's threshold (Level Up at XP ≥ 6 + twice
  your level); stat debilities drop a stat's effective value by 1 until treated.
  `enterPlay` seeds vitals + trackers idempotently, so characters built before
  play mode gain them without a migration.
- Playwright end-to-end smoke: sign in with dev-login, build a character in the
  wizard, finish (saving it), reload the saved sheet from the database, and
  confirm the print view drops the app chrome. Runs against the production build
  on a freshly-migrated throwaway SQLite database; kept in `e2e/` (separate from
  the vitest suite) as `npm run test:e2e`, with a dedicated CI job that installs
  the browser and runs it.
- Stonetop character export to JSON and Obsidian-flavoured Markdown, from the
  sheet (screen-only buttons, hidden when printing). JSON wraps the character in
  an identifying, re-importable envelope; Markdown emits YAML frontmatter
  (name, playbook, stats, tags) plus sectioned body (stats, moves with text,
  background notes, possessions, introductions), rendering by name/text when the
  playbook is loaded and falling back to ids otherwise. Serializers are pure and
  unit-tested; PDF export stays deferred until the sheet design settles.
- Dashboard at `/dashboard` — the signed-in user's saved characters grouped by
  game, each row opening its saved sheet or offering duplicate, archive/
  unarchive, and delete. A "Characters" header link appears when signed in; an
  archived-toggle reveals archived entries; signed-out shows a sign-in prompt.
  Backed by new item endpoints (`PATCH`/`DELETE /api/entities/<id>` and
  `POST /api/entities/<id>/duplicate`) over the existing ownership-scoped
  service; the grouping/formatting helpers are unit-tested.
- Save and load characters to the database. A `userId`-scoped entity service
  (create/update/get/list/status/delete/duplicate — ownership enforced in every
  query) backs a REST endpoint: `GET/POST /api/entities` and
  `GET /api/entities/<id>`, both session-guarded. Finishing the builder while
  signed in persists the character and opens its saved sheet (`?id=`); the sheet
  loads a saved entity by id, else the local autosave. Drafts built while logged
  out migrate to the database on sign-in (best-effort, once per account). The
  shell never parses the blob — a new `GameModule.entityMeta` hook has the game
  supply name/entityType/schemaVersion. Service, client helpers, and migration
  logic are unit-tested; ownership isolation is covered explicitly.
- Authentication via Auth.js (`@auth/sveltekit` + Drizzle adapter). A zero-config
  **dev-login** provider is on by default so local work needs no OAuth setup;
  Google and Discord switch on automatically when their id/secret env vars are
  set (and `AUTH_DEV_LOGIN=false` retires dev-login for production). Credentials
  forces the JWT session strategy, so the user id is threaded token → session
  (`session.user.id` typed via augmentation); the adapter still persists
  users/accounts. Added the adapter tables (accounts/sessions/verification
  tokens, second migration), the server hooks handle, a root layout load
  exposing the session, and a header sign-in/out control. Provider gating and
  the id plumbing are unit-tested.
- Database schema for accounts and saved entities (phase 4). `users` carries the
  Auth.js Drizzle-adapter column shape so the coming auth wiring drops straight
  onto it. `entities` is the one universal persistence model: a saved
  character/steading is a single opaque JSON `data` blob per row, tagged with
  `gameId` / `entityType` / `schemaVersion` and a `draft`/`ready`/`archived`
  status, owned by a user (cascade delete), indexed for the dashboard's
  by-owner/by-game queries. The shell never parses `data`; the owning game
  module does. First generated migration under `drizzle/`; round-trip tests run
  it against in-memory SQLite (blob survives write/read, defaults populate, FK
  cascade and enforcement hold).

## [0.1.0] - 2026-07-10

Build any Stonetop character end to end and print it — the phase-3 milestone.

### Added

- Character sheet and print view: `/g/<game>/sheet` renders the finished
  character (chosen options only, laid out like the printed playbook — header,
  stats, moves with text, background notes, possessions, introductions) from the
  autosaved draft, via the game module's new `sheetComponent` slot (typed
  `SheetProps`; wired with the same contained cast as wizard steps). A toolbar
  offers Print and a link back to the builder; print CSS drops the app chrome so
  the sheet prints clean. The builder's Finish now opens the sheet.
- Introductions and review wizard steps. Introductions renders the playbook's
  numbered round-the-table ritual with optional free-text notes per step. Review
  summarizes every choice (name, playbook, background, instinct, origin,
  appearance, stats, moves, possessions) and runs the full validator, listing
  anything still missing so the player can jump back — or confirming the
  character is ready to finish.
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
