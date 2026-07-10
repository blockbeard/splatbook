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
   - **Shell** (`src/lib/` outside `games/`, `src/routes/` outside `/g/[game]/`) —
     auth, persistence, campaigns, pack loading + validation harness, document
     tree/search, wizard *shell*, dice infrastructure, theming, exports, deployment.
   - **Game UI** (`src/lib/games/<gameId>/` outside `engine/`) — wizard *steps*,
     sheet and tracker rendering, per-game routes under `/g/[game]/…`.

## The three rules

Enforced from commit 1. A change that needs to break one of these is a design
problem to solve, not an exception to grant.

1. **The shell touches game code only through the `GameModule` registry.** No
   `import … from '$lib/games/stonetop/…'` anywhere in shell code. The module
   interface (`{ id, name, packSchemas, engine, entityTypes }`) is the entire
   surface area. If the shell needs something new from a game, the interface
   grows — explicitly, in its own commit.

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
(`{ label, newDraft?, entityMeta?, wizardSteps?, sheetComponent?, playComponent? }`)
owns that type's create/edit/render slots; every slot is optional so a type is only
as large as it needs. A character is built through the wizard
(`wizardSteps` + `newDraft`), rendered read-only by `sheetComponent`, and edited in
`playComponent`; a steading skips the wizard entirely — it is an editable tracker
sheet from birth, so its editor lives in the `playComponent` slot and the shell's
create action routes straight there.

The shell **iterates the map**; it never hard-codes a type. Routes are
`/g/[game]/[type]/{build,play,sheet}`; the dashboard, save/load, and landing page
all read the type from the map key rather than branching on `character`. This
followed the discipline above: the map arrived only when steadings (phase 6) became
the second entity type — until then a single flat set of character slots was
enough. Note this is a second *entity type within one game*, not a second game; the
"no universal character model" ban still holds — the shapes inside each type stay
the game's own, opaque to the shell.

## Theming

The shell defines semantic design tokens as `--sb-*` CSS custom properties in
`src/app.css`, mapped into Tailwind utilities via `@theme inline`. A game module
themes itself by overriding the custom properties under a `[data-game="<gameId>"]`
scope; it never introduces raw colors in components. Light/dark is a class on
`<html>` (`dark`), set pre-paint by the inline script in `app.html`.

## Persistence

- Drizzle ORM. better-sqlite3 locally and on atlas; D1 when the Cloudflare
  deployment lands (phase 8). Schema in `src/lib/server/db/schema.ts`.
- Server-only code lives under `src/lib/server/` (SvelteKit enforces the
  client/server boundary on that path).
- Entities use the blob model above. Structured columns are reserved for things
  the *shell* queries: ids, names, game/entity type, timestamps, campaign links.

## Naming conventions

- **Game ids**: lowercase, hyphen-free, short — `stonetop`, `hmtw`, `daggerheart`.
  Used as folder names (`content/stonetop/`, `src/lib/games/stonetop/`), route
  segments (`/g/stonetop/…`), `gameId` values, and `data-game` scopes.
- **Deployment names** (e.g. **Ringwall** for the Stonetop deployment) are skins:
  they may appear in pack metadata and theming, never in code identifiers.
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

## What "done" looks like for the framework

When game #2 arrives, adding it must touch only `content/<gameId>/` (or
`static/content-packs/<gameId>/`) and `src/lib/games/<gameId>/`. If it needs shell
changes, that is the extraction moment: do the abstraction then, with two real
games in hand — not preemptively with one.
