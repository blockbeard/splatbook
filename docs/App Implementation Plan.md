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
- **Three rules, enforced from commit 1:** the shell only touches game code through a `GameModule` registry; game modules never import each other; every game-visible string lives in a content pack, never in app code. (*Clarified 2026-07-12:* "game-visible" means game **content** — rules text, move names, labels a player reads as part of the game. Shell chrome — nav, wizard scaffolding, auth buttons, dashboard copy — is app copy and exempt. Read literally the rule is unfollowable, and a rule nobody can follow protects nothing.)

Build Stonetop first and completely, inside that boundary. Don't abstract anything until the second game forces you to — but because the boundary exists from day one, adding HMtW or Daggerheart later is "write a module and a pack," not "refactor the app." The how-to-add-a-game documentation gets written *as you build Stonetop*, so it's grounded in a real implementation instead of imagination.

## Ground rules

- Every commit builds, type-checks (`npm run check`), and passes tests. No broken states in history.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); scopes: `shell`, `packs`, `reference`, `stonetop`, `wizard`, `play`, `steading`, `gm`, `db`, `auth` — grown since by use: `tools`, `campaigns`, `e2e`, `ci`, `cloudflare`, and `ops` (monitoring/backup). A `content:` type covers data reimports (commit 91).
- Saved blobs migrate on load. Each game module owns a `migrate*` function per entity type (`migrateCharacter`, `migrateSteading`, `migrateThreat`), called wherever a blob is read. Any commit that changes a blob's shape bumps that module's `SCHEMA_VERSION` and extends the migration **in the same commit**, with a test that loads a fixture of the old shape. A character saved at v0.1 opens in every later version; anything else is data loss on a timer.
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

## Phase 11 — Table-ready polish (v2.1, commits 70–88)

*Drafted 2026-07-11 from a round of play-testing feedback after v2.0. Everything below is UI/UX debt against a working engine — no new phases of the framework promise, just making Ringwall pleasant to sit down with at the table. Two design questions raised in the feedback are answered inline (commits 84 and 85); flag anything you'd re-scope before I start.*

**Theming & the front door.** The shell already reads the OS scheme on first paint and has a toggle, so the gap is narrower than it looks: once you flip the toggle it's stuck on that choice forever and can never follow the OS again, and there's no per-game skin yet (the `[data-game]` hook is documented in `app.css` but nothing sets the attribute or ships an override).

70. `feat(shell): tri-state theme — system / light / dark` — the control cycles system → light → dark instead of a sticky binary; "system" attaches a `matchMedia('(prefers-color-scheme: dark)')` listener so it tracks the OS live, and clears the stored override. Update the inline `app.html` script to honour a stored "system" value. Persist the three-way choice.
71. `feat(shell): real landing page` — retire the "under construction" notice. Home becomes a genuine front door: one line on what Splatbook is, a card/CTA into **Ringwall** (Stonetop) — build a character, open the reference — and a sign-in prompt. The framework blurb moves to small print.
72. `feat(stonetop): per-game theme` — ship `src/lib/games/stonetop/theme.css` overriding the `--sb-*` tokens under `[data-game="stonetop"]`, adapted from the vault snippet (`~/Documents/RPG Vaults/Stonetop/.obsidian/snippets/stonetop-theme.css`): EB Garamond body, paper backgrounds (`#faf9f7`), near-black ink, forest-green accent (`#2a4a2a`), plus a dark-mode variant. Set `data-game="stonetop"` on the `/g/[game]` layout so every Stonetop route inherits it; self-host or link the font. Keep the CC BY-SA attribution note.
73. `feat(stonetop): campaigns link on the game landing` — add a Campaigns CTA to `/g/[game]` alongside the builder/reference/GM links (signed-in → the campaigns list; signed-out → sign-in prompt). Right now campaigns are only reachable from the global nav.

**Character builder.** The wizard asks a question per screen with no memory of what came before, and the review screen lists problems but gives you no way back to fix them.

74. `feat(wizard): choices-so-far rail` — a generic, always-visible summary panel (collapsible drawer on mobile) that the shell renders next to each step, fed by a per-game `summary(draft)` hook on the game module. Updates live as choices are made.
75. `feat(stonetop): wizard summary provider` — Stonetop implements `summary()` — playbook, background, instinct, stats, chosen moves, possessions — with human labels for the rail in 74.
76. `feat(wizard): review jumps to its sections` — give each wizard step a stable id; make every review row and every validation error a link back to the step that owns it, so "Assign your stats" on the review screen takes you straight to the stats step.

**Character play sheet.** This is where most of the feedback lands.

77. `feat(stonetop): stat tap rolls; debilities get their own control` — clicking a stat currently toggles its debility; make a stat *tap roll +stat* instead, and move debilities to explicit per-stat toggles. Resolves the two conflicting asks (tap-to-roll, and buttons for debility rather than tapping the stat).
78. `feat(play): solo rolling + result surface` — rolls work off-campaign too: the result shows inline (small toast/line on the sheet), and still logs when a campaign is attached. Reuses the phase-10 dice engine.
79. `feat(campaigns): rolls fronted by character name` — the roll surface and the shared log lead with the **character** name, with the player's name in small subtext; persist the character label with the roll so the log reads right for everyone.
80. `feat(play): bank XP past the level threshold` — let XP mark beyond `xpForNextLevel` (you often earn the last point mid-session and keep going); boxes and the "x / y to level" line reflect banked XP, and Level Up stays available.
81. `feat(play): overload warning at load 10+` — when carried load hits its cap (10+), the inventory view shows an "overloaded — drop something" note; wire it to the existing load model in the inventory engine.
82. `feat(play): available moves on the sheet` — list the character's moves first (starting + playbook + advanced), then the general/basic moves, each rollable where it has a stat. If the basic moves aren't yet in the pack, add a `data/basic-moves.json` to the Stonetop pack (with schema + round-trip test) as part of this commit.
83. `feat(stonetop): character sheet PDF export` — a PDF of the printed sheet (server-rendered from the print view, or client print-to-PDF with a dedicated stylesheet), with a download button on the sheet and play views. Completes the export deferred back in commit 34.

**Steading.** *Design answers:* Yes — a steading rolls, but only for its own moves. At the change of seasons you roll **+Fortunes**, and other steading moves key off the steading stats; it never rolls STR/DEX/etc. So the steading needs roll buttons for its steading-appropriate rolls and nothing else. And a steading is currently a Stonetop-only entity type — the framework *could* let another game register a steading-like entity later, but none does today, and a Stonetop campaign is literally about the village of Stonetop, so pre-filling the name is right (kept editable, since a campaign might track a second steading).

84. `feat(stonetop): steading name defaults to "Stonetop"` — `createSteading()` seeds `name: 'Stonetop'` (still editable).
85. `feat(steading): steading play sheet with steading rolls` — a real interactive tracker view parallel to the character play mode (tap stats, toggle the three debilities, advance season) reachable directly rather than only via "Edit", with roll buttons for the steading moves — change-of-seasons **roll+Fortunes** first — and no character-stat rolls. Read-only print sheet stays as the printable version.

**End of session.** The one genuinely new workflow.

86. `feat(stonetop): end-of-session model` — engine for the end-of-session move (the three questions → XP awards) plus the season/Fortunes prompt for the campaign steading. Pure functions + tests.
87. `feat(play): end-of-session flow` — a guided "End session" panel: answer the end-of-session questions (award XP to each character), jot notable events, and optionally roll the steading's Fortunes / advance its season; writes through to the character and the campaign-owned steading.
88. `docs + chore: v2.1.0` — update `content-packs.md` (new `summary()` hook, per-game theme convention, any pack additions) and `architecture.md` where the boundary moved; changelog; tag.

**Milestone: Ringwall is pleasant to run a real session from — themed, self-explanatory front to back, with a character and a steading you can roll from and close a session on. `v2.1.0`.**

## Phase 12 — The cleaned rules, reimported and readable (v2.2, commits 89–95)

*Drafted 2026-07-12 from Chris's feature list for the next big release (phases 12–19, `v2.2.0`); reference navigation and the theme refresh added same day. Decisions settled up front: Book II opens to players via a remembered opt-in toggle (GM gate removed); a miss offers a "Mark XP" button on the roll result; the arcana insert ships as free-form cards now, data-driven after the Book II cleanup; PDF export is a real generated PDF, 1-up + booklet, 3-up as a follow-up. Three unnumbered infrastructure commits (the D1 request-scoped database, its runbook, privacy/terms) landed between 88 and here; plan numbering carries on regardless.*

The reimport is not the pure re-run we hoped. The Book I cleanup moved move headings into Obsidian callouts (`> [!move] ## **CLASH**`, 126 such headings, plus `[!box]`/`[!abstract]`/`[!arcanum]` asides), and the whole pipeline — `build_rules.py`'s verifier, `build_srd.py`'s section splitter, the reference renderer — only recognises headings at line start. Re-running today produces 1,803 "unresolved" links and would demote every move from its own searchable section to anonymous body text.

The reimport also explains the state of the rules browser. The committed trees predate the cleanup: Book I carries **107 level-1 sections for its 17 chapters** (every stray `#` in the OCR-era text became a "chapter" — A MIGHTY WILL, TULPA, "2 Special possessions"…), and the sidebar renders all 1,421 sections to h6. The cleaned vault has exactly one h1 per chapter file, so the reimport fixes the *data*; two commits below fix the *shape* (chapters as the spine, sidebar capped at h2) so the browser reads like the book's table of contents instead of a heap.

Tool-format changes land before the regen so the content is rebuilt exactly once.

89. `feat(tools): callout-aware rules pipeline` — teach `build_rules.py` (anchor maps + verifier) and `build_srd.py` (section splitter) that `> [!type] ## Heading` is a heading: it opens a section, its title is linkable, and the callout type travels on the section (`kind: "move"`) for styling and future filtering. Same-note links (`[[#CLASH|…]]`) verify too. Run against the cleaned vault until the verifier is green.
90. `feat(packs): chapters in the document tree` — the source file becomes a first-class chapter node: `build_srd.py` emits per-file chapter metadata (number and title from the filename, e.g. `03 - Playing the Game`), sections carry their chapter, and the document-tree schema grows the field (with tests). Today file identity is smeared into section-id prefixes and lost to the UI.
91. `content(stonetop): reimport Book I & II` — run `build_rules.py` + `build_srd.py` against the cleaned vault; page anchors are gone (the vault now links headings directly, so the `^pNNN` remap is a no-op and the format's `pages` field empties); rebuild the search index; refresh affected snapshots. Book II re-lands as-is — its cleanup finishes later and re-runs this command, nothing else.
92. `feat(reference): chapters are the spine` — the reference landing page becomes the two books' numbered chapter lists in reading order (a card per chapter, like the book's contents page); the sidebar shows chapters as collapsible entries opening to **h2 only**, with the current chapter expanded. Deeper headings stay reachable on the section pages themselves (in-page anchors and the existing child-section links), not in the sidebar — a nav that lists every h5 is a list, not a map.
93. `feat(reference): callout rendering` — render Obsidian callouts as styled asides instead of blockquotes with literal `[!move]` text: a marked preprocessing pass in `render.ts`, generic shell CSS with `--sb-*` hooks so the game theme can skin them. Headings inside callouts anchor and deep-link like any section heading.
94. `feat(stonetop): book theme refresh` — replace the EB Garamond skin with the vault's new book theme: **Avara** for H1–H4 (the book's actual display face, 900-weight chapter titles), **Libre Caslon Text** for body (the Adobe Caslon stand-in), **IM Fell English** for small-caps accents — all SIL OFL. Extract the woff2s from the snippet's base64 into `static/fonts/` (a small decode script or one-off), `font-display: swap`. Adopt the rest of the book look where the app renders prose: the heading scale, H5/H6 as Caslon small-caps, the ornamental `hr`, book-ruled tables, the PDF-sidebar callout style (skins commit 93's hooks — `[!move]` gets the book's move-box look), and the snippet's dark palette for the dark variant. Source: `~/Documents/RPG Vaults/Stonetop/.obsidian/snippets/stonetop-theme.css`. Keep the OFL/CC attribution notes current. The official *trade dress* is also available: Jeremy Strandberg has confirmed (see the Hearthfire project's README for the Discord citation) that playbook icons, Seasons Change icons, and monster/artifact icons are free for fan projects released CC BY-SA 4.0 with attribution — so the theme (and later the PDF) can wear the real icons. Lucie Arnoux's illustrations and maps remain copyrighted and excluded, as the pipeline already enforces.
95. `feat(shell): games at the root — /stonetop, Ringwall retired` — the game routes move from `/g/[game]` to `/[game=game]`: a `src/params/game.ts` matcher accepts only registered game ids, so static routes (`/campaigns`, `/dashboard`, `/privacy`…) can never be shadowed — SvelteKit already gives static segments priority, the matcher just makes the contract explicit. Every `resolve('/g/[game]…')` call updates (mechanical, type-checked); the old `/g/` paths 301 to the new ones so shared links survive. The Ringwall name goes with it (decided 2026-07-12): a codename nobody searches for was an indirection tax, and the disclaimer does the legal work. The presentation is *descriptive* — "a Stonetop companion" at `/stonetop` — never "Stonetop" as the product's own brand, because CC BY-SA licenses the text, not the name. Re-verify Lampblack & Brimstone's fan-content position (the commit-53 check) before publicising — partially answered already: Strandberg's confirmed trade-dress permission for CC BY-SA fan projects (commit 94) is strong evidence the posture is friendly. Ringwall remains the fallback identity if that ever goes badly.

## Phase 13 — Book II is the players' to open (commits 96–97)

*The book itself says players may read it ("It's okay for players to read this book if they want to… if you're the kind of player who prefers to discover the world through play, don't"). So the GM gate — "you may see Book II if you run a table" — was the wrong shape. The reader decides, not the GM.*

96. `feat(db): user preferences` — a small generic key/value prefs table (userId, key, value), read into `locals`; signed-out readers get the same preference in localStorage. First consumer: `reference.showSetting`.
97. `feat(reference): spoiler opt-in replaces the GM gate` — one search box, defaulting to Book I; a "Include Book II — setting spoilers" checkbox beside it, persisted via commit 96 so it's a decision made once. The TOC lists Book II behind the same preference; first opening shows the book's own "Should the players read this?" passage as the interstitial, with the opt-in button under it. The `visibility: 'gm'` flag stays in the document-tree format (another game may want true GM-only text) but Stonetop's presentation renames the badge to "Setting". `isGmOfAnyCampaign` and the GM index-gating in the search page go; e2e covers toggle → search → Book II hit.

## Phase 14 — Inserts: the sheet becomes a binder (commits 98–106)

*On paper the inserts are separate sheets you tuck into your playbook. On screen the honest equivalent is tabs: the play view gets a tab bar — **Sheet · Moves · Inventory · [one per attached insert] · +** — because tabs keep every insert one tap away with its name visible (a dropdown hides them; an accordion makes an already-long page longer), and they scroll horizontally on mobile, which is the settled pattern. Inventory graduates from a section at the bottom of the sheet to its own tab — right for a game where the Outfit is chosen per-expedition, not fixed at creation. Class inserts attach themselves: Invocations to the Lightbearer, Initiates of Danu to the Blessed with the Initiate background, Animal Companion to the Ranger, Crew to the Marshal. The rest — Followers, Ghost, Revenant, Thrall, Arcana — any character adds via the **+** tab when play makes them relevant. This phase reworks both the wizard and the play sheet, so the net goes up before the acrobatics: the per-playbook e2e matrix lands first, and the blob-shape change goes through the migrate-on-load path (ground rules) rather than around it.*

98. `test(e2e): per-playbook golden paths` — one data-driven Playwright spec that builds a golden-path character for **all nine playbooks** through the wizard and asserts the sheet shows each one's signature pieces (the Blessed's sacred pouch, the Marshal's crew, the Lightbearer's invocations, the Would-be Hero's asterisk…). The loop is the pack's playbook list, so a tenth playbook would be covered for free. Cheap to write once, and every later commit in this phase — and every future pack edit — is caught by it.
99. `feat(stonetop): insert attachment model` — engine: `character.inserts` (attached insert ids + per-insert state), auto-attach rules driven by playbook/background/move, player add/remove for the `appliesTo: "all"` inserts; tests for every auto-attach trigger. Bumps `SCHEMA_VERSION` to 3 and extends `migrateCharacter` so existing saves gain `inserts` — including the auto-attaches they already qualify for (a saved Lightbearer wakes up with Invocations attached) — with a fixture test loading a v2 blob.
100. `feat(stonetop): typed insert schemas` — firm the loose `insertSchema` into per-insert Zod shapes (followers block, invocations, initiates, animal companion, crew, ghost/revenant/thrall — the interiors already sit in the pack JSONs); round-trip tests, ids snapshotted like the playbooks. While here, check our move-constraint vocabulary against Hearthfire's (`requires`, `requiresLevel`, `excludes`, mark/consequence gates) — we have `requires`/`replaces`/`maxTakes`; anything the book actually uses that we lack gets added now, not mid-UI.
101. `feat(play): tabbed play sheet` — restructure PlayMode into the tab bar above; `?tab=` in the URL so a tab is shareable and survives reload; attention badges where a tab wants eyes (overloaded Inventory, an unspent follower move). Sheet keeps vitals/stats/XP/trackers/advancement; Moves and Inventory move whole into their tabs.
102. `feat(stonetop): followers insert` — a roster: each follower a card (name, tags, instinct, cost, HP/damage, moves, loyalty boxes) from the pack's follower block; add/dismiss followers in play.
103. `feat(stonetop): class inserts` — Invocations (start-knowing picks, learn-at-level unlocks, per-invocation detail), Initiates of Danu (the pick lists and rules text), Animal Companion (type, instinct, cost, the beast-of-legend track), Crew (tags, instinct, cost, individuals with their own mini-inventory).
104. `feat(stonetop): the undead inserts` — Ghost, Revenant, Thrall: gained-when text, instincts, moves, terrible purpose / marks, consequences — mostly rendered text plus a few trackers, one commit for all three. Model consequences as Hearthfire does: displayed state is always the pack seed plus the effects of the currently-marked boxes (a pure projection), so unmarking anything is reversible with no undo trail.
105. `feat(stonetop): arcana insert — free-form cards` — matches the paper ritual where the GM hands you a card: write-in name and notes, a configurable row of mark boxes/circles, as many cards as you hold arcana. A card's mysteries are *sections*, each with an unlocked mark; the GM can author and reveal them on a campaign character through the same GM write path end-of-session already uses. A campaign setting (GM toggle, default hidden) decides whether players see locked sections — some tables like the temptation, some don't. The gate is display-level, by design: the text lives in the player's own character blob, and a player determined enough to read their own API response could also just search Book II once they've opted into spoilers — the toggle is table etiquette, not cryptography. Structured arcana data no longer has to wait for the Book II cleanup: **Hearthfire** (github.com/gvorbeck/hearthfire, CC BY-SA 4.0 — same license as our pack) has fully transcribed and modelled the minor and major arcana, including requirement thresholds, marks tracks, mystery moves gated by marks/consequences, consequence effects, and the roll tables. Importing that transcription (converted to our pack format, cross-checked against the book and errata, attributed) can pre-fill cards and their mystery sections behind the same toggle — either in this commit if the conversion goes smoothly or as a fast follow — while free-form cards remain for GM-invented arcana. Adds the first per-campaign setting (a small `settings` JSON column on campaigns, GM-editable from the dashboard).
106. `feat(wizard): inserts land at creation` — the wizard's extras steps attach the class inserts through the commit-99 rules (they currently only mention them); the Seeker's arcana questions seed arcana cards. The commit-98 e2e matrix asserts the attached tabs, closing the loop.

## Phase 15 — Dice, damage, and the miss that pays (commits 107–109)

107. `feat(play): full dice panel + custom bonus` — presets for the whole set (d4 d6 d8 d10 d12 d20, 2d6) plus a small signed-number bonus box that applies to the next roll and reads in the log ("2d6+1 (bonus +2)"). The advantage/disadvantage switch already exists; it now sits over more dice.
108. `feat(stonetop): damage rolls` — the playbook's `base.damage` (the Heavy's d10) becomes a "Damage (d10)" button on the sheet header, and on each damage-dealing move's card — Clash, Let Fly and kin get a `rollsDamage` tag in the pack data (schema + data + test) so the button appears exactly where the text says you deal your damage. Riders like "+1d4" ride the custom bonus box for now.
109. `feat(play): a miss marks XP` — when a character's 2d6+stat move roll totals 6 or less, the roll-result surface grows a **Mark XP** button and waits to be dismissed instead of fading; one tap writes `markXp` and the surface confirms. Never appears on damage, steading, or bare-notation rolls — only the rolls that earn it.

## Phase 16 — The steading has editors (commit 110)

110. `feat(campaigns): steading editors` — every member already sees the campaign steading; the GM now delegates edit per member (a `steadingEditor` flag on `campaign_members`, toggles on the campaign dashboard next to each player). Enforced server-side on the steading write path — the UI grant is honest — and the shared tracker becomes live, not read-only, for delegates.

## Phase 17 — The session ledger (commits 111–112)

*End of session already runs GM-side and marks everyone's XP; what it doesn't do is remember. Notes live in the GM's browser and the awards evaporate into the sheets.*

111. `feat(db): campaign sessions` — a sessions table (campaignId, number, date, the checked triggers, per-character XP awarded, notes); the end-of-session flow writes one record per run, and the notes textarea seeds once from the old localStorage key so nothing already jotted is lost.
112. `feat(campaigns): session log` — the campaign dashboard grows the history: session N, date, XP handed out, notes, editable by the GM after the fact. The e2e end-of-session test asserts the record too.

## Phase 18 — Moves & gear, handed out (commit 113)

113. `feat(stonetop): moves & gear page` — the app's equivalent of the Moves & Gear handout, for players at the table without a character open: the basic moves, the special moves (extend `tools/build_moves.ts` to emit `special-moves.json` — Advantage/Disadvantage, Burn Brightly, End of Session, Death's Door), and the gear/small-items/prosperity lists already in the inventory insert. Linked from the game landing and the play view.

## Phase 19 — Sanded corners, watched and backed up (commits 114–118)

*Added 2026-07-12 after a "what else would you change" review. Offline/PWA and the account-export half of the data-safety story stay deferred to open v2.3 — but the operator half moved the other way (decided 2026-07-12): monitoring and the D1 backup land here, because the site is already public and the database already holds characters people would miss.*

114. `feat(play): undo` — every play-mode edit autosaves, so every mistap persists. The engine is pure functions over blobs, which makes undo nearly free: PlayMode keeps a short stack of prior blobs and a toast after each change offers Undo for a few seconds — HP, XP, trackers, inventory, even a fat-fingered level-up, all restored by writing the previous blob back.
115. `feat(stonetop): moves link to their rules` — every move card on the play sheet deep-links to the move's full rules text. Possible because the reimport made each move its own section (commit 89's `kind: "move"`); `tools/build_moves.ts` records the section id alongside each extracted move so the link is data, not string-matching.
116. `feat(shell): feedback link + cookieless analytics` — a footer feedback link (GitHub issues), and the Cloudflare Web Analytics beacon: free, cookieless, no consent banner, nothing stored about the visitor. `/privacy` updates in the same commit, as its own text demands. If event-level questions arise later ("does anyone use the PDF export?"), self-hosted Umami on atlas is the upgrade path that keeps the no-third-party-tracking claim true.
117. `chore(ops): production on the watchdog` — **Argus** (the house watchdog) already runs Uptime Kuma watching the staging deployment on atlas; this commit is just the missing checks: production's `https://splatbook.app/api/health`, and a confirmation that notifications actually arrive. A dedicated watchdog box watching Cloudflare is exactly the right shape — the watcher shares no failure domain with either deployment. The runbook in `docs/deployment.md` gains the what-to-do-when-it-pages section.
118. `chore(ops): nightly D1 export to atlas` — a cron on atlas runs `wrangler d1 export --remote` (API token scoped to D1 read) against **production** into a dated, compressed dump under a directory the existing 3-2-1 backup already sweeps — from there the offsite copies come for free. Simple retention before the sweep (say 14 daily, 12 monthly); a **restore rehearsal** documented in the runbook (import the dump into local sqlite, open a character — an untested backup is a hope, not a backup); and a push-style check on Argus's Kuma (the cron pings it on success) that alerts when a night is missed, because silent cron death is the actual failure mode of home-grown backups.

## Phase 20 — A real PDF (commits 119–122)

*The commit-83 "export" is a print stylesheet — honest, but the browser owns the layout and the file. guild-book's bar is a generated document. `pdf-lib` (+ fontkit for the book fonts) runs on node and Workers alike — no headless browser, so it survives every deploy target.*

119. `feat(shell): pdf engine` — a generic module: font embedding, text flow with measurement, boxes/checkbox/rule primitives, page management; a server endpoint pattern games hang layouts on. Unit tests on the layout math (wrapping, pagination), not pixels.
120. `feat(stonetop): character sheet PDF, 1-up` — the printed-playbook layout, chosen options only, from the same character blob the sheet renders; Download button on sheet and play views (print stays as the quick path).
121. `feat(shell): booklet imposition` — a shared imposition helper (rendered page → position on sheet), then the saddle-stitch booklet variant: A5 pages paired onto landscape A4 in fold order, matching the physical playbooks. 3-up (three panels on a landscape sheet, table-flat) is a deliberate follow-up — the helper makes it a small commit when wanted.
122. `docs + chore: v2.2.0` — content-packs.md (typed insert schemas, `rollsDamage`, special-moves data, the prefs table, callout + chapter conventions), architecture.md (preferences, sessions, the pdf module boundary, the ops additions folded into deployment.md), changelog, tag.

**Milestone: the binder release — every insert playable, Book II open to the curious, dice for everything the game rolls, a session that remembers itself, and a PDF worth printing. `v2.2.0`.**

*Toward v2.3: offline/PWA first (precache the static reference + a web manifest, then a write queue for sheets), and the user-facing half of the data-safety story (a "download my data" JSON export on the dashboard — the operator half, the scheduled D1 export, was pulled forward into phase 19). Both were reviewed 2026-07-12 and deferred, not rejected. Also parked from the Hearthfire review: lines-and-veils safety tools (excluded / veiled / special handling) and shared "Threats" / "I wonder…" boards on the campaign dashboard — cheap, very Stonetop, and worth doing once the session ledger exists to hold them.*

## Sequencing notes

- Phases 0–4 are ordered dependencies. After that, 5/6/7 can be reshuffled by enthusiasm — steading before play mode is fine.
- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- The reference/search phase lands early on purpose: it's the piece with a second proven implementation (your HMtW tool) and immediate table value, and it stress-tests the pack pipeline before the wizard depends on it.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
