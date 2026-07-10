# Companion App — Implementation Plan (commit by commit)

*Drafted 2026-07-10. Supersedes the chunk-level outline in [[App Plan]]. Fresh repo, clean folder.*

*Names (settled 2026-07-10): the framework is **Splatbook** (splatbook.app — owned); the Stonetop deployment is **Ringwall**, served at `splatbook.app/ringwall` (subdomain possible later). "Splat" = the old typesetter's asterisk in "the \* book" — the framework is literally named after a wildcard, which is the point.*

## The framework question

You asked whether to fork guild-book and strip it back to a game-agnostic framework, with Stonetop as the first implementation rather than the baked-in purpose. Short answer: **yes to the goal, no to the fork, and with one discipline check.**

**Why the goal is right.** Arrowed has effectively built this framework twice already — the Registrar and guild-book are the same shell (SvelteKit, content packs, wizard, auth, Drizzle, exports) re-skinned for CoC and HMtW. A third hand-built copy for Stonetop would triple the duplication. And you're the ideal user for a multi-game core: you already have a local HMtW rules tool you like, an active Daggerheart campaign, and a library of a hundred systems. The odds that Stonetop is the last game you want supported are roughly nil.

**Why not the fork.** Stripping someone else's young codebase (22 commits) back to a framework is archaeology — you inherit HMtW-shaped assumptions (tarot resolution, its pack format, its wizard flow) and spend your time deleting rather than designing. The genuinely generic parts of guild-book (SvelteKit scaffold, Auth.js, Drizzle, pack loading, Docker/CF configs) are well-trodden patterns that are faster to lay down fresh than to excavate. Start a new repo, license it **GPL-3.0-or-later** (same as Arrowed's), credit both his projects in the README, and freely crib specific solutions from them — the licences are compatible and the history stays clean.

**The discipline check.** The classic failure mode here is the *universal character model* — trying to design one data structure that covers d100 skill allocation, PbtA playbooks, and games you haven't met yet. Don't. The framework is the **shell**; games are **modules**. Concretely:

- **Generic (the shell):** auth, users, saved-entity persistence, campaigns, the pack loader + validation harness, the document-tree/search/reference system, the wizard *shell* (steps, progress, autosave), dice infrastructure, theming, exports, deployment.
- **Per-game (a module):** the pack schemas beyond a small common envelope, the rules engine, the wizard *steps*, sheet and tracker rendering, dice presets.
- **Three rules, enforced from commit 1:** the shell only touches game code through a `GameModule` registry; game modules never import each other; every game-visible string lives in a content pack, never in app code.

Build Stonetop first and completely, inside that boundary. Don't abstract anything until the second game forces you to — but because the boundary exists from day one, adding HMtW or Daggerheart later is "write a module and a pack," not "refactor the app." The how-to-add-a-game documentation gets written *as you build Stonetop*, so it's grounded in a real implementation instead of imagination.

## Ground rules

- Every commit builds, type-checks (`npm run check`), and passes tests. No broken states in history.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); scopes: `shell`, `packs`, `reference`, `stonetop`, `wizard`, `play`, `steading`, `gm`, `db`, `auth`.
- Keep a `CHANGELOG.md` from the start (Keep a Changelog format, like the Registrar).
- Stack: SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, Drizzle + SQLite (local) / D1 (prod), Auth.js, Zod, Vitest + Playwright. Same as Arrowed's — deliberate, so his code remains a reference and future collaboration stays easy.
- Characters/steadings stored as one JSON blob per row with `schemaVersion`, `gameId`, `entityType` — the one genuinely universal persistence model.

## Phase 0 — Bootstrap (commits 1–6)

1. `chore(shell): scaffold SvelteKit 2 + TypeScript strict + Vitest` — create-svelte, .gitignore, README stub, GPL-3.0-or-later LICENSE, credits section naming guild-book and the Registrar as inspiration.
2. `chore(shell): Tailwind v4, app layout, theme tokens` — header/nav/footer shell, light/dark, CSS custom properties for future per-game theming.
3. `chore(shell): ESLint + Prettier + CI` — GitHub Actions running check/test/build on push.
4. `chore(db): Drizzle + local SQLite + /api/health` — empty schema, `db:push`/`db:generate` scripts.
5. `chore(shell): Dockerfile (multi-stage) + docker-compose with sqlite volume` — the empty shell runs on atlas from day one; deployment never becomes a big bang.
6. `docs: architecture.md` — the constitution: three layers, the GameModule boundary, the three rules above, naming conventions. Written before any game code exists so it constrains rather than describes.

**Milestone: an empty, deployable, documented shell.**

## Phase 1 — Content-pack infrastructure (commits 7–12)

7. `feat(packs): pack manifest + loader` — `static/content-packs/<gameId>/manifest.json` (id, name, version, license, attribution, file list); typed loader.
8. `feat(packs): Zod validation harness + npm run validate:packs` — generic envelope schemas only (manifest, document tree); per-game schemas register through the harness.
9. `feat(shell): GameModule interface + registry` — `{ id, name, packSchemas, engine, wizardSteps, sheetComponent }`; routes under `/g/[game]/…`; game picker hidden while only one game is registered.
10. `feat(stonetop): stonetop pack — playbooks, inserts, steading, gm` — copy the 21 vault JSONs (9 playbooks, 9 inserts, steading, GM, schema doc); write the Stonetop Zod schemas from `SCHEMA.md`; `validate:packs` green. Add the pack's own LICENSE note (CC BY-SA 4.0 text, attribution to Jeremy Strandberg / Lampblack & Brimstone).
11. `test(stonetop): schema round-trip tests` — every pack file parses into typed structures; snapshot the ids so accidental renames fail CI.
12. `docs: content-packs.md` — pack format reference + the first draft of "adding a new game." This file gets updated in every later phase that touches the boundary; treat stale docs here as a bug.

**Milestone: Stonetop data validated inside the framework. No UI yet.**

## Phase 2 — Reference & search (commits 13–18)

*Early because it exercises the pack pipeline end-to-end, needs no auth, and is immediately useful at your table.*

13. `feat(packs): document-tree format` — sections: id, title, heading path, body markdown, print-page anchors, visibility flag. Generic — any game's SRD fits.
14. `feat(tools): srd build script` — vault markdown → document tree JSON; config file maps source folders; run against Book I. (Regenerating after future errata = one command.)
15. `feat(reference): section browser` — TOC tree, section pages, breadcrumbs, deep links to section ids.
16. `feat(reference): search index` — MiniSearch built at build time from the document tree; client-side, zero server cost, works offline.
17. `feat(reference): expandable snippets` — result shows a snippet; expands in place to subsection, then full section. **Connect the HMtW vault to a session here** so I can lift what made your local tool work well before this UI settles.
18. `feat(reference): gm-only visibility flag` — Book II ingested but flagged; hidden until campaigns exist (phase 9 turns this into a real gate).

**Milestone: searchable Stonetop rules reference — your table can use it even while the builder is unfinished.**

## Phase 3 — Character wizard (commits 19–29)

19. `feat(stonetop): engine skeleton` — character model (choices, moves, trackers, schemaVersion), empty validators, first unit tests. Pure functions, no UI/DB imports.
20. `feat(wizard): generic wizard shell` — step registry from the game module, progress bar, back/forward, localStorage autosave. The shell knows nothing about playbooks.
21. `feat(stonetop): playbook-select step` — the 9 playbooks with flavor text.
22. `feat(stonetop): background step` — nested choices, grants (moves/notes/trackers), Destined's pick-3-4 descriptors, Seeker arcana, etc.
23. `feat(stonetop): instinct, appearance, origin/name steps` — including write-ins.
24. `feat(stonetop): stats step` — assign the array, live validation.
25. `feat(stonetop): starting-moves step` — fixed + background-granted + choose-N; `requires`, `childOf`, pickOne groups enforced by the engine (tests first).
26. `feat(stonetop): possessions step` — pick-N, sub-choices (Heavy weapons, personal tokens), write-ins.
27. `feat(stonetop): extras steps` — data-driven per playbook: sacred pouch, war stories, tall tales, collection, fear & anger, crew/companion/initiates inserts attached by playbook or move.
28. `feat(stonetop): introductions step + review` — the numbered table ritual, review screen.
29. `feat(stonetop): character sheet + print CSS` — chosen options only, structured like the printed playbook. The "pretty sheet without a lot of unchosen options" that started this whole idea.

**Milestone: build any Stonetop character end-to-end and print it. Worth a `v0.1` tag.**

## Phase 4 — Accounts & persistence (commits 30–35)

30. `feat(db): users + entities tables` — the generic blob model (`gameId`, `entityType`, `name`, `data`, `schemaVersion`, timestamps).
31. `feat(auth): Auth.js` — dev-login provider default (zero-click local), Google/Discord via env when you want them.
32. `feat(shell): save/load` — drafts and finished characters persist; localStorage draft migrates to DB on sign-in.
33. `feat(shell): dashboard` — list, open, duplicate, archive, delete.
34. `feat(stonetop): export JSON + markdown` — markdown Obsidian-flavoured (the Registrar's trick); PDF export deferred until the sheet design stabilises.
35. `test(e2e): Playwright smoke` — create → save → reload → print view.

## Phase 5 — Play mode & advancement (commits 36–42)

36. `feat(stonetop): tracker state model` — HP, XP, debilities, move trackers (Resolve, Omens, Boon…), inventory marks; engine + tests.
37. `feat(play): play-mode UI` — tap-to-mark trackers, autosaved.
38. `feat(stonetop): level-up legality in engine` — level gates (2+/6+), prerequisite moves, `maxTakes`, `replaces` retiring the old move. Test-heavy commit; this is the rules-lawyer core.
39. `feat(play): level-up flow UI` — spend XP, legal choices only, confirmation.
40. `feat(stonetop): special cases` — Would-be Hero's asterisk rule, Potential for Greatness marks (+ Superior Stat gate), Improved Stat caps. Tests for each.
41. `feat(play): advancement log` — sheet shows when each move/stat was gained.
42. `feat(play): inventory/Outfit view` — driven by `insert-inventory.json`; load tracking, undefined slots, Have-What-You-Need transfers.

**Milestone: a character survives a whole campaign arc in the app. `v0.2`.**

## Phase 6 — Steading builder (commits 43–48)

43. `feat(stonetop): steading engine model` — stats with ranges, debilities, season state.
44. `feat(steading): tracker UI` — Fortunes/Surplus/Size/Population/Prosperity/Defenses, debility toggles.
45. `feat(steading): improvements` — requirement checklists (all / either / pick-N / multi-box Pull Together), completion applies effects and annotates resources/fortifications.
46. `feat(steading): lists` — resources, fortifications, assets, silver/gold, write-ins throughout.
47. `feat(steading): residents & neighbors` — NPC tables with name-list and trait pickers from the pack.
48. `feat(steading): print view + dashboard integration` — saved as an entity like characters.

## Phase 7 — GM tools (commits 49–52)

49. `feat(gm): GM reference pages` — rendered from `the-gm.json`: agenda, principles, GM moves, core loop, procedures (threats, sites, monsters, followers, NPCs, expeditions).
50. `feat(gm): interactive tables` — Die of Fate and weather tables rollable; threat-type move lists; travel times.
51. `feat(gm): flow diagrams` — core loop and flow-of-play rendered from the nodes/edges data.
52. `feat(gm): threat tracker worksheets` — homefront/nearby/distant threats saved as entities. (Nice-to-have; let it slip to v2 if momentum matters more.)

## Phase 8 — Public v1 (commits 53–57)

53. `feat(shell): credits & licensing page` — CC BY-SA attribution and share-alike notice for Stonetop text, GPL source link, "independent production, not affiliated with Lampblack & Brimstone" disclaimer. Check their fan-content position before flipping public.
54. `chore(shell): Cloudflare adapter + D1 config` — `ADAPTER` env switch (node for atlas, cloudflare for Pages), D1 migrations.
55. `chore: production deployment` — path per the hosting section of [[App Plan]]: atlas + Docker for the table first, CF Pages + D1 free tier when public.
56. `docs: adding-a-game.md walkthrough + reconcile architecture/content-pack docs` — the framework promise, kept: written against the now-real Stonetop module.
57. `chore: v1.0.0` — changelog, tag.

## Phase 9 — Campaigns (v2, commits 58–64)

58. `feat(db): campaigns + membership tables` — roles: gm, player.
59. `feat(campaigns): create + invite via tokenised link`.
60. `feat(campaigns): join flow, attach characters` — a character belongs to at most one campaign.
61. `feat(campaigns): dashboard` — party at a glance, campaign steading.
62. `feat(reference): GM gate` — gm-only documents (Book II) searchable only by campaign GMs; the phase-2 flag becomes a real permission.
63. `feat(steading): campaign-owned steading` — shared view for players, edit for GM (or whoever they delegate).
64. `test + polish` — e2e for the invite/join loop.

## Phase 10 — Shared dice (v2, commits 65–69)

65. `feat(shell): dice engine` — generic core (`XdY+mod`, advantage/disadvantage) with per-game presets from the module; unit tests.
66. `feat(campaigns): roll log` — rolls stored per campaign with actor + label.
67. `feat(play): dice UI` — roll from a move on the sheet; move-aware labels ("Defy Danger +DEX").
68. `feat(campaigns): live log via polling` — 2–5s poll is fine for a table; upgrade to SSE/Durable Objects only if it feels laggy.
69. `chore: v2.0.0`.

## Sequencing notes

- Phases 0–4 are ordered dependencies. After that, 5/6/7 can be reshuffled by enthusiasm — steading before play mode is fine.
- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- The reference/search phase lands early on purpose: it's the piece with a second proven implementation (your HMtW tool) and immediate table value, and it stress-tests the pack pipeline before the wizard depends on it.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
