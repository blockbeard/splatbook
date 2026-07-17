# Architecture

*The constitution. Written before any game code exists (phase 0, commit 6) so it
constrains rather than describes. Change it deliberately, in its own commit, with a
reason — not as a side effect of shipping a feature.*

## The three layers

Splatbook is a game-agnostic shell that runs game modules fed by content packs.
Every piece of code and data belongs to exactly one layer:

1. **Content packs** (`content/`, later served from `static/content-packs/<gameId>/`)
   — all game text and structured game data: playbooks, moves, rules text, tables,
   names, flavor. JSON and markdown, validated by schemas. A pack carries its own
   license and attribution. Packs contain **no code**.

2. **Engine** (`src/lib/games/<gameId>/engine/`) — pure TypeScript implementing a
   game's rules: character models, validators, level-up legality, tracker logic.
   Pure functions over plain data. **No UI imports, no DB imports, no SvelteKit
   imports.** This is what makes rules unit-testable and what keeps a game module
   portable.

3. **App** — everything else:
   - **Shell** (`src/lib/` outside `games/`, `src/routes/` outside `/[game=game]/`) —
     auth, persistence, campaigns, pack loading + validation harness, document
     tree/search, wizard *shell*, dice infrastructure, theming, exports, deployment.
   - **Game UI** (`src/lib/games/<gameId>/` outside `engine/`) — wizard *steps*,
     sheet and tracker rendering, per-game routes under `/[game=game]/…`.

## The three rules

Enforced from commit 1. A change that needs to break one of these is a design
problem to solve, not an exception to grant.

1. **The shell touches game code only through the `GameModule` registry.** No
   `import … from '$lib/games/stonetop/…'` anywhere in shell code. The module
   interface (`{ id, name, packSchemas, engine, entityTypes, gmGuide?,
   sessionComponent? }`) is the entire surface area. If the shell needs something
   new from a game, the interface grows — explicitly, in its own commit (as
   `entityTypes` did in phase 6, `gmGuide` in phase 7, `dice` in phase 10, and
   `sessionComponent` in phase 11).

2. **Game modules never import each other.** Stonetop code may not know HMtW
   exists. Shared needs get promoted to the shell (via rule 1), never traded
   sideways.

3. **Every game-visible string lives in a content pack, never in app code.** Move
   names, playbook text, rules jargon, table labels — if a player would recognise
   it as *the game's words*, it comes from the pack. UI chrome ("Save", "Next
   step", error messages) is app code and stays out of packs. This is also the
   licensing boundary: GPL code on one side, CC BY-SA game text on the other.

## No universal character model

The one classic failure mode, named and banned: do **not** design a data structure
intended to cover d100 skill allocation, PbtA playbooks, and games not yet met.
There is exactly one universal persistence shape — the entity row:

```
{ id, userId, gameId, entityType, name, data (JSON blob), schemaVersion, createdAt, updatedAt }
```

What lives inside `data` is the game module's business, versioned by
`schemaVersion` and migrated by the module's own code. Abstract a concept into the
shell only when a **second real game** forces it — with two implementations in
hand, not one and an imagination.

## Entity types

A game contributes one or more **entity types** through
`GameModule.entityTypes` — a map keyed by the persisted `entityType`
(`character`, `steading`, …). Each entry
(`{ label, newDraft?, entityMeta?, wizardSteps?, summary?, dice?, sheetComponent?,
playComponent? }`)
owns that type's create/edit/render slots; every slot is optional so a type is only
as large as it needs. A character is built through the wizard
(`wizardSteps` + `newDraft`), rendered read-only by `sheetComponent`, and edited in
`playComponent`; a steading skips the wizard entirely — it is an editable tracker
sheet from birth, so its editor lives in the `playComponent` slot and the shell's
create action routes straight there.

The shell **iterates the map**; it never hard-codes a type. Routes are
`/[game=game]/[type]/{build,play,sheet}`; the dashboard, save/load, and landing page
all read the type from the map key rather than branching on `character`. This
followed the discipline above: the map arrived only when steadings (phase 6) became
the second entity type — until then a single flat set of character slots was
enough. Threats (phase 7) then slotted in as a *third* type with no shell change,
which is the map earning its keep. Note these are extra *entity types within one
game*, not extra games; the "no universal character model" ban still holds — the
shapes inside each type stay the game's own, opaque to the shell.

## The GM guide slot

The other way the `GameModule` interface has grown is the optional `gmGuide` slot
(phase 7): a game's GM-facing *reference* — agenda, moves, procedures, interactive
tables, flow diagrams. It is deliberately **not** an entity type, because nothing is
saved; it sits outside `entityTypes`. It declares a pack file, an ordered list of nav
`sections`, and a `component` that renders one section; the shell serves and routes it
at `/[game=game]/gm` without inspecting the pack shape. Same discipline as everything
else: a new registry slot, added explicitly, that a game opts into or omits.

## The dice slot

Dice hang off the **entity type**, not the game (`EntityTypeModule.dice`, moved
there in phase 11). A roll belongs to the thing being played: a Stonetop
character rolls its stats; a steading rolls its own moves and has no business
offering "Roll +STR". A type with no `dice` gets no dice panel.

The shell owns the **generic dice core** — `$lib/dice`: parsing `XdY±mod`
notation, rolling with an injectable rng, and advantage/disadvantage (roll an
extra die per term, keep the best/worst) — all pure and game-agnostic, no game
vocabulary in it. A game contributes **presets**: named, ready-to-roll
expressions, each an id, a game-visible `label`, a base `notation`, and an opaque
`meta` bag the shell never reads.

A preset's *dynamic* part — the stat in "Roll +DEX" — cannot be resolved by the
shell, because the number lives inside the game's own character shape, which the
shell holds opaquely. So the module also offers `resolve(preset, entity)`: the
shell hands both back and rolls whatever the game returns. Stonetop resolves
against `effectiveStat`, so a marked debility is already priced in and the dice
can never disagree with the sheet. (Before phase 11 there was no such hook, and
"Roll +DEX" quietly rolled a flat `2d6`.)

A game's sheet can also roll *directly*, through `PlayProps.roll(label,
notation)` — how tapping a stat or a move rolls it. The game supplies the words
and the dice; the shell owns the randomness, the result surface and the log. This
keeps rule 3 intact — the labels are the game's words — while the shell never
learns what a "stat" is.

The **roll UI** is a shell component (`DiceRoller`) that takes an entity type's
presets and asks the host to roll them — it does not roll itself, so a preset
button and a tapped stat land in the same result surface and the same log. The
result appears in a floating `RollSurface`, fronted by the *character's* name
(the shell gets that from the entity's name column, never by reading the blob).
Rolls always show locally, campaign or no campaign; when the played character is attached to a campaign the roll
is also persisted to that campaign's log via `/api/campaigns/[id]/rolls` (the
browser-computed `RollResult` is re-validated server-side by `rollResultSchema`
before it's stored). A loose character just rolls locally. The campaign page
then shows the **live roll log** (commit 68) — the whole table's shared history,
seeded server-side and kept fresh by a small component that polls `GET
/api/campaigns/[id]/rolls` every few seconds (pausing while the tab is hidden).
Polling is a deliberate choice for a self-hosted tabletop tool; SSE or Durable
Objects would be the upgrade only if it ever feels laggy.

## Theming

The shell defines semantic `--sb-*` tokens (`app.css`) and maps them to Tailwind
utilities; components use `bg-bg`, `text-text`, `border-border`… and never a raw
colour. A game themes itself by overriding those tokens under
`html[data-game="<gameId>"]` **in its own CSS**, imported from its own module —
the shell's only contribution is stamping `data-game` on `<html>` (server-side in
`hooks.server.ts`, so the theme is right on the first paint, and in the
`/[game=game]` layout so it survives client-side navigation). A game that ships no
theme gets the shell's defaults. The selectors are `html[data-game=…]` rather than
bare attribute selectors because the shell's tokens sit on `:root`, which has
identical specificity — bare selectors would win or lose on bundle order alone.

Theme *preference* is three-way (system / light / dark). "System" is the default
and stays live, tracking the OS through a `matchMedia` listener. Printing drops
the dark class for the duration, so a sheet prints as paper and ink whatever the
screen is doing.

## Persistence

- Drizzle ORM. better-sqlite3 locally and on atlas; D1 for the Cloudflare
  deployment, selected by the `ADAPTER` env var (phase 8). Schema in
  `src/lib/server/db/schema.ts`; deployment in `docs/deployment.md`.
- Server-only code lives under `src/lib/server/` (SvelteKit enforces the
  client/server boundary on that path).
- Entities use the blob model above. Structured columns are reserved for things
  the *shell* queries: ids, names, game/entity type, timestamps, campaign links.
- **Preferences** (phase 13): one flat `key -> value` namespace per user, a
  plain upsert on a composite primary key. A preference's *meaning* belongs to
  whichever feature reads it, not the table. Signed-out readers get the same
  shape in `localStorage` (`$lib/preferences/client`); nothing migrates on
  sign-in — a preference set while signed out is a browser default, not a
  server intent.
- **The session ledger** (phase 17): `campaign_sessions`, one row per
  end-of-session run — the campaign's own session `number` (assigned by the
  service), date, the checked `triggers` (the game's answer shape, stored
  opaquely, same discipline as `entities.data`), per-character `awards`
  (`{ entityId, name, xp }`, denormalised like `rolls.characterName` so
  history survives renames and deletions — deliberately no FK), and the GM's
  `notes` (the one field that takes edits after the fact; the rest is what
  happened). Recording and editing are GM-gated in the service; the dashboard
  renders the history for every member.

## Campaigns and the spoiler gate

- Campaigns are shell furniture (like entities): a game-tagged table with
  members (`gm`/`player`) and an invite token. An entity carries an optional
  `campaignId`, so a character belongs to at most one campaign by construction.
- **The roll log** (phase 10) is the campaign's shared dice history: a `rolls`
  table keyed by campaign, each row carrying the roller, a game-supplied label,
  and the dice engine's `RollResult`. Unlike a game's opaque entity `data`, the
  shell owns the `RollResult` shape (it produced it) and reads it back to render
  the log. Writes are member-guarded in the service; the live view polls (phase
  10, commit 68).
- **The reference spoiler gate** (commit 97, replacing phase 9's GM gate): "may
  I see Book II?" is the *reader's* decision, not the GM's — the book itself
  says players may read it. A per-user preference (`reference.showSetting`,
  the prefs table when signed in, localStorage when not) drives a "Include
  Book II — setting spoilers" opt-in on the search page, the TOC, and an
  interstitial on gated sections. The `visibility: 'gm'` flag stays in the
  document-tree format (another game may want true GM-only text); Stonetop
  presents the badge as "Setting". This remains a *display* gate — document
  trees and the gated search index are served statically and filtered in the
  browser. Withholding text at the network layer would require server-rendered
  reference pages: a hardening step for a game that truly needs it, which
  Stonetop does not.

## Naming conventions

- **Game ids**: lowercase, hyphen-free, short — `stonetop`, `hmtw`, `daggerheart`.
  Used as folder names (`content/stonetop/`, `src/lib/games/stonetop/`), route
  segments (`/stonetop/…`, matched by `src/params/game.ts`), `gameId` values,
  and `data-game` scopes.
- **No deployment codenames** (commit 95 retired "Ringwall," the Stonetop
  deployment's former name): a game is presented descriptively — "a Stonetop
  companion" — never under a separate brand a codename would need to search-
  engine-optimise for.
- **Commits**: conventional messages; scopes `shell`, `packs`, `reference`,
  `stonetop`, `wizard`, `play`, `steading`, `gm`, `db`, `auth`.
- **Files**: Svelte components `PascalCase.svelte`; everything else lowercase.
  Tests sit next to the code they test as `*.test.ts`.

## Quality bar

- Every commit builds, type-checks (`npm run check`), lints (`npm run lint`), and
  passes tests (`npm test`). No broken states in history.
- Engine code is test-first where rules are subtle (level-up legality, prerequisite
  chains, replaces/maxTakes).
- `CHANGELOG.md` (Keep a Changelog) and `docs/content-packs.md` (once it exists)
  are updated in the same commit as the change they describe. A stale boundary doc
  is a bug.

## The wizard summary hook

The wizard shell renders a **choices-so-far rail** beside every step (phase 11).
It is fed by `EntityTypeModule.summary(draft)`, which returns already-human
label/value rows, each tagged with the step id that owns it. The shell lays them
out and links each row back to its step; it never inspects the draft to build
them — resolving an id like `the-blessed` to "The Blessed" means reading the
content pack, which is the game's job. The hook may be async for exactly that
reason. Steps also receive `goTo(stepId)`, which is what lets the review screen
turn every row and every validation error into a way back to the step that fixes
it.

## The pdf module

`$lib/pdf` (phase 20) is the generic document engine games hang layouts on —
pdf-lib (+ fontkit for the book fonts), no headless browser, so the same code
runs on node and Workers. Its boundary, in the usual shape:

- **The shell owns the mechanics**: `PdfBuilder` (font embedding, wrapped text
  with measurement, box/checkbox/rule primitives, top-down page management —
  the bottom-left conversion happens in exactly one place), the pure layout
  math in `layout.ts` (word-wrap, block flow — unit-tested against a fake
  measurer), the imposition helper in `imposition.ts` (fold-order arithmetic +
  saddle-stitch two-up; `?booklet=1` on the endpoint), and the generic
  endpoint `/[game]/[type]/pdf?id=` (auth + owner-scoped entity load,
  `pdfResponse` headers).
- **The game owns the layout**: `EntityTypeModule.pdf(entity, fetch)` returns
  bytes + filename from the opaque blob. Pack data and fonts arrive through
  the event's `fetch` (the same way sheets load packs in the browser), and the
  implementation loads via **dynamic import** so pdf-lib never rides into the
  client bundle. The shell reads neither the blob nor the bytes.

## The end-of-session slot

`GameModule.sessionComponent` (phase 11) is the game's end-of-session ritual,
surfaced by the shell at `/campaigns/[id]/session`. The division is the usual
one: the shell brings the table (the campaign's characters and steading, held
opaquely), a write-through, and the dice; the game brings the questions and what
they are worth. The shell computes no awards — it persists exactly the blob the
game's engine handed it.

That write-through is the one place someone writes an entity they do not own, and
the guard is correspondingly narrow (`updateCampaignEntityData`): the entity must
be attached to a campaign where the caller is seated **as GM**. A player cannot
write another player's character even at the same table; an unattached character
cannot be touched; a GM of another campaign gets nothing. It exists because at the
end of a session the GM marks XP on the whole party, and the party's characters
belong to their players.

## What "done" looks like for the framework

When game #2 arrives, adding it must touch only `content/<gameId>/` (or
`static/content-packs/<gameId>/`) and `src/lib/games/<gameId>/`. If it needs shell
changes, that is the extraction moment: do the abstraction then, with two real
games in hand — not preemptively with one. The step-by-step is
`docs/adding-a-game.md`, written against the real Stonetop module.
