# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The Cloudflare/D1 deployment path.** The database is now resolved **per
  request** (`event.locals.db`) — D1 through `platform.env.DB` on Cloudflare, the
  SQLite file on node/atlas — because the Workers runtime has no long-lived
  process to hold a connection and cannot bundle `better-sqlite3` at all. Auth.js
  is likewise built per request, since its Drizzle adapter needs a database that
  doesn't exist until a request arrives. No module imports a `db` singleton any
  more. Verified end to end against a real Workers runtime with local D1.

## [2.1.0] - 2026-07-11

Table-ready polish, drafted from a round of play-testing after v2.0. No new
phases of the framework promise — this is Ringwall becoming pleasant to actually
sit down and run: themed, self-explanatory front to back, with a character and a
steading you can roll from and a session you can close.

### Added

- **Tri-state theme (commit 70).** The theme control cycles system → light →
  dark instead of a sticky binary. "System" is the default and stays live,
  tracking the OS through a `matchMedia` listener; the pre-paint script honours
  the same stored value.
- **A real landing page (commit 71).** Home is a front door rather than an
  "under construction" notice: what Splatbook is, a card per registered game
  (build / reference / run) generated from the registry, and a sign-in prompt
  that says what an account buys you.
- **Stonetop's own skin (commit 72).** EB Garamond (self-hosted, OFL),
  uncoated-paper backgrounds, near-black ink, a Great Wood green, and a dark
  variant for the table at night. The game themes itself under
  `html[data-game="stonetop"]`; the shell's only contribution is stamping the
  attribute (server-side, so it's right on the first paint).
- **Campaigns on the game landing (commit 73).**
- **The wizard's choices-so-far rail (commits 74–75).** A summary panel beside
  every step — sticky on desktop, a drawer on mobile — that updates as you
  choose and links each row back to the step that owns it. Fed by a generic
  `summary(draft)` hook on the entity type; Stonetop resolves ids to the names on
  the page by reading its pack.
- **Review jumps to its sections (commit 76).** Every row and every validation
  error on the review screen is a link back to the step that fixes it.
- **Stat taps roll; debilities get their own control (commit 77).** Tapping a
  stat rolls +that stat — the thing you do a hundred times a session — and the
  debility moves to its own toggle, labelled with its name from the pack.
- **Solo rolling and a result surface (commit 78).** Rolling no longer depends on
  being in a campaign, and the result floats over the sheet instead of hiding in
  a panel you've scrolled past. Fronted by the character's name.
- **Rolls fronted by the character (commit 79).** The roll surface and the shared
  log lead with the character; the account name is small print. Stored with the
  roll, so the log still reads right after a rename.
- **XP banks past the level threshold (commit 80).** You earn the point that
  levels you mid-session and keep playing; there is now somewhere to put it, and
  the surplus carries over the level-up.
- **Overload warning at load 10+ (commit 81).** Past the heaviest band the sheet
  says so, instead of showing a dash.
- **Moves on the sheet (commit 82).** Your moves first, then the basic ones, each
  rollable where its text says what it rolls. Adds `data/basic-moves.json` to the
  pack, lifted out of the rules prose by `tools/build_moves.ts`.
- **Character sheet PDF export (commit 83).** Completes the export deferred in
  commit 34: a print stylesheet that _is_ the PDF's design, with a button on the
  sheet and play views. No headless browser, so it works on every deploy target.
- **The steading is named Stonetop (commit 84),** and is still editable.
- **A steading play sheet with steading rolls (commit 85).** Tap its stats, turn
  the season, mark its debilities, and roll its own moves — the change of seasons
  (+Fortunes) first. Adds `data/steading-moves.json`.
- **End of session (commits 86–87).** The GM runs the move: the table answers the
  two personal prompts per character and the four group questions, and the XP is
  marked on every sheet at once. Notable events are kept, and if the season
  turned, the steading rolls its Fortunes and advances. Engine is pure and
  tested; an e2e test drives the whole loop and asserts the XP that lands on the
  sheet.

### Changed

- **Dice moved from the game to the entity type.** A roll belongs to the thing
  being played: a character rolls its stats, a steading rolls its own moves and
  no longer offers "Roll +STR".
- **`registerGame` replaces a repeat id rather than throwing,** the same contract
  `registerPackSchemas` already had — the dev server re-evaluates SSR modules and
  must survive it. Two different games claiming one id is still a bug, now caught
  where it can originate (`BUILT_IN_GAMES`, asserted unique).
- The campaign's steading link says "Open tracker", not "Edit steading".

### Fixed

- **The dev server served every page as a client-side 500.** Game modules call
  `registerPackSchemas` on import, which dragged the node-only pack `fs-loader`
  into the client bundle, where Vite externalises `node:fs/promises` and
  hydration died. Production builds tree-shook it away, which is why only `npm
run dev` showed it. The loader is now imported lazily, inside the one function
  that needs it and never runs in a browser.
- **"Roll +DEX" rolled a flat `2d6`,** silently throwing the stat away: the
  modifier lives inside the character, which the shell holds opaquely and could
  not read. The dice module gained a `resolve` hook; Stonetop resolves against
  `effectiveStat`, so a marked debility is priced in and the dice can't disagree
  with the sheet.
- **Printing hid the character's name.** The print rule hid `header` by element,
  which matched the _sheet's_ header too.
- Session notes said "yours to keep" and kept nothing.

## [2.0.0] - 2026-07-11

Shared play — **campaigns and dice**. A GM starts a campaign and invites players
by link; characters attach to it, the party sees each other at a glance, and a
GM-owned steading and the reference GM gate come with the seat. On top of that, a
generic dice engine with per-game presets, a roller on the play sheet, and a live
shared roll log the whole table watches.

### Added

- **Campaigns — tables & membership (phase 9, commit 58).** Two new shell tables,
  generic like `entities`: `campaigns` (a game-tagged table a group gathers
  around, with an `ownerId` and a rotatable, unguessable `inviteToken`) and
  `campaign_members` (one seat per (campaign, user) with a `gm`/`player` role,
  enforced by a composite primary key). Both foreign keys cascade on account
  deletion. Migration `0002` and round-trip schema tests included.
- **Campaign create + invite (phase 9, commit 59).** A `/campaigns` area: list
  the campaigns you're seated in (with your GM/player role) and start a new one
  (which seats you as GM). Each campaign page carries a copyable invite link
  built from an unguessable token; the GM can rotate the token to revoke
  outstanding invites. Campaign access is membership-gated in the service layer —
  a non-member gets a 404, not a peek. New `campaigns` service (create, lookups,
  per-user listing, token rotation) with unit tests, plus a Campaigns nav link.
- **Join flow + attach characters (phase 9, commit 60).** Opening an invite link
  (`/campaigns/join/<token>`) shows a join confirmation and seats you as a
  player; it's idempotent (the GM opening their own link isn't demoted) and
  prompts sign-in first when needed, returning to the same link. Entities gained
  an optional `campaign_id` (migration `0003`, `set null` on campaign delete), so
  a character belongs to at most one campaign by construction — the campaign page
  lists your characters for that game with attach / move-here / remove controls.
  New service functions (`joinCampaign`, `setEntityCampaign`, `listCampaignEntities`)
  with unit tests.
- **Campaign dashboard (phase 9, commit 61).** The campaign page now leads with
  party-at-a-glance: every member (GM-first) with the characters they've attached
  to the campaign, plus a campaign-steading slot. Your own characters link to
  their sheets; teammates' show as read-only names (sheets stay owner-scoped).
  New `listCampaignMembers` roster query with a test.
- **Reference GM gate (phase 9, commit 62).** The phase-2 hardcoded
  `GM_CONTENT_VISIBLE = false` is now a real permission: GM-only rules (Book II)
  appear in the table of contents, section pages, and search **only** for a
  viewer who GMs a campaign in that game (`isGmOfAnyCampaign`, computed
  server-side and threaded to the reference loads as `gmContentVisible`). Search
  gained a separate GM-only index (`search-index-gm.json`), built alongside the
  player index and loaded only when the gate is open; GM hits are tagged in
  results. `isVisible` now fails closed (hidden unless explicitly granted).
- **Campaign-owned steading (phase 9, commit 63).** A GM can create a steading
  the whole party shares; it's an ordinary steading entity attached to the
  campaign, so it also appears on the GM's dashboard. Every member sees it at
  `/campaigns/<id>/steading` — read-only, rendered by the game's own steading
  sheet — while the owner gets an Edit link to the normal editor. The shell
  creates it game-agnostically via the module's `newDraft`/`entityMeta`.
- **Invite/join e2e + polish (phase 9, commit 64).** A Playwright spec drives the
  whole loop across two accounts: a GM creates a campaign, a second person opens
  the invite link, signs in, joins as a player, and then appears in the GM's
  party roster — plus a check that running a campaign opens the reference GM gate.
- **Dice engine (phase 10, commit 65).** A generic, game-agnostic dice core in
  the shell (`$lib/dice`): a notation parser for `XdY±mod` (multiple dice terms,
  signed flat modifiers, whitespace/case tolerant, malformed input rejected) and a
  `roll` function with an injectable rng — so every result is deterministically
  testable — that also does advantage/disadvantage the way that generalises the
  d20 rule: roll one extra die per term and drop the lowest (advantage) or highest
  (disadvantage), keeping dropped dice in the result for display. No game
  vocabulary lives in the core. Games contribute only **presets** through a new
  optional `GameModule.dice` slot — named, ready-to-roll expressions
  (`{ id, label, notation, mode?, meta? }`) the shell can list and roll without
  learning the game's rules; the game-specific bits (which stat a roll adds) ride
  in an opaque `meta` bag. Stonetop registers its PbtA move rolls — a plain `2d6`
  and one `Roll +STAT` per stat, the stats drawn from the engine's `STAT_KEYS` so
  they can't drift. Pure and unit-tested; the per-campaign roll log and the sheet's
  roll UI (commits 66–68) build on this core. `docs/architecture.md` and
  `docs/content-packs.md` document the slot.
- **Roll log (phase 10, commit 66).** A new shell table, `rolls`, records every
  dice roll made in a campaign as shared history: keyed by campaign (not by
  roller), with the roller (`actorId`), the game-supplied `label` (e.g.
  `Roll +DEX`), and the dice engine's `RollResult` stored whole — a shape the
  shell owns and reads back, unlike a game's opaque entity `data`. Both foreign
  keys cascade (a roll dies with its campaign or its roller's account). The new
  `rolls` service appends (member-guarded — you can only add to a table you sit
  at) and lists a campaign's log newest-first with each roller's name, breaking
  same-millisecond ties on the monotonic rowid so insertion order is preserved.
  Migration `0004`, with service and cascade tests. The roll UI (commit 67) and
  the live polling view (commit 68) build on this.
- **Dice UI on the sheet (phase 10, commit 67).** Play mode now carries a dice
  roller: a generic shell component (`DiceRoller`) driven by the game's `dice`
  presets — so it holds no game vocabulary, the labels and notation come from the
  module. It rolls with the shell engine, has a normal / advantage / disadvantage
  switch, and shows recent results inline (dropped dice struck through). Rolling
  always shows a local result; when the character is attached to a campaign the
  roll is also POSTed to the shared log (`/api/campaigns/[id]/rolls`, session- and
  membership-guarded, with the browser-supplied `RollResult` validated by
  `rollResultSchema` before storage), while a character in no campaign just rolls
  locally. No `PlayProps` change — the roller is shell furniture beside the game's
  play component. The live shared-log view lands in commit 68.
- **Live roll log (phase 10, commit 68).** The campaign page now shows the shared
  roll log — every member's rolls, newest first, with the roller, the label, the
  dice (dropped ones struck through) and total, and a relative timestamp. It's
  seeded server-side from the page load and kept live by a small `RollLog`
  component that polls a session- and membership-guarded `GET` endpoint
  (`/api/campaigns/[id]/rolls`) every few seconds; polling pauses while the tab is
  hidden and never overlaps a slow response. A short poll is deliberate — plenty
  for a table, with SSE/Durable Objects reserved for if it ever feels laggy. The
  wire shape (`RollLogEntry`) is shared by the endpoint and the page load.

## [1.0.0] - 2026-07-11

Public **v1.0.0** — the Stonetop companion, complete: build a character through
the wizard and print the sheet; play, mark trackers, and level up with the rules
enforced; run a steading across the seasons; read and roll the GM guide and track
threats; sign in to save everything. Plus a searchable rules reference, a
credits/licensing page, and a deployment that runs on atlas (adapter-node) today
and Cloudflare Pages + D1 when it goes public. Built inside the framework boundary
from day one, so game #2 is "write a module and a pack," not a refactor.

### Added

- **Credits & licensing page (phase 8, commit 53).** A public `/credits` page,
  linked from the footer (alongside a Support link). Three parts: the
  application's own licence (GPL-3.0-or-later) with a link to the source and
  credits to the prior art it's modelled on (guild-book, the Registrar); each
  game's _text_ licence and attribution, pulled live from the pack manifests
  (`license` / `attribution`), so a new game appears automatically with its
  CC BY-SA share-alike notice and "independent production" disclaimer; and this
  deployment's support links — a Ko-fi tip jar and a DriveThruRPG affiliate link
  with a plain-spoken disclosure (costs the buyer nothing extra, creators are
  paid in full). The SPDX→label/link/share-alike mapping is a small unit-tested
  helper (`$lib/credits`); operator links live in `$lib/support`.
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
- **Threat worksheets (phase 7, commit 52).** Stonetop's _third_ entity type — a
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
