# Companion App — Implementation History (phases 0–15, commits 1–109)

*The completed half of the commit-by-commit plan, split out 2026-07-16 so [[App Implementation Plan]] holds only unbuilt work. **Append-only**: when a phase in the plan completes, its section moves here verbatim, decisions and all — the rationale in these entries gets cited constantly (commit 95's naming argument, commit 97's gate reversal), which is why this is a file and not a `git log`. Original plan drafted 2026-07-10, superseding the chunk-level outline in [[App Plan]].*

*Names (settled 2026-07-10): the framework is **Splatbook** (splatbook.app — owned); the Stonetop deployment was **Ringwall**, to be served at `splatbook.app/ringwall`. Commit 95 retired the codename — the game routes live at `/stonetop` and the presentation is descriptive ("a Stonetop companion"), with Ringwall kept as the fallback identity. "Splat" = the old typesetter's asterisk in "the \* book" — the framework is literally named after a wildcard, which is the point.*

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

The ground rules are operative, not historical — they live in [[App Implementation Plan]] and apply to every commit, past and future.

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
94. `feat(stonetop): book theme refresh` — replace the EB Garamond skin with the vault's new book theme: **Avara** for H1–H4 (the book's actual display face, 900-weight chapter titles), **Libre Caslon Text** for body (the Adobe Caslon stand-in), **IM Fell English** for small-caps accents — all SIL OFL. Extract the woff2s from the snippet's base64 into `static/fonts/` (a small decode script or one-off), `font-display: swap`. Adopt the rest of the book look where the app renders prose: the heading scale, H5/H6 as Caslon small-caps, the ornamental `hr`, book-ruled tables, the PDF-sidebar callout style (skins commit 93's hooks — `[!move]` gets the book's move-box look, `[!monster]` gets a lucide swords icon and its own box style — the vault theme punted on this, disabling callout icons wholesale, so it lands here instead), and the snippet's dark palette for the dark variant. Source: `~/Documents/RPG Vaults/Stonetop/.obsidian/snippets/stonetop-theme.css`. Keep the OFL/CC attribution notes current. The official *trade dress* is also available: Jeremy Strandberg has confirmed (see the Hearthfire project's README for the Discord citation) that playbook icons, Seasons Change icons, and monster/artifact icons are free for fan projects released CC BY-SA 4.0 with attribution — so the theme (and later the PDF) can wear the real icons. Lucie Arnoux's illustrations and maps remain copyrighted and excluded, as the pipeline already enforces.
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

114. `feat(play): undo` — every play-mode edit autosaves, so every mistap persists. The engine is pure functions over blobs, which makes undo nearly free: PlayMode keeps a short stack of prior blobs and a toast after each change offers Undo for a few seconds — HP, XP, trackers, inventory, even a fat-fingered level-up, all restored by writing the previous blob back. *Fold in a nit from the 2026-07-16 e2e triage while in this file: the play page's autosave-adopt-id `replaceState` passes `{}` for state and rebuilds the query as bare `?id=`, dropping both `page.state.tab` and `?tab=` — so an unsaved-draft session snaps back to the Sheet tab on its first autosave. Carry the existing query params and `page.state` through instead.*
115. `feat(stonetop): moves link to their rules` — every move card on the play sheet deep-links to the move's full rules text. Possible because the reimport made each move its own section (commit 89's `kind: "move"`); `tools/build_moves.ts` records the section id alongside each extracted move so the link is data, not string-matching.
116. `feat(shell): feedback link + cookieless analytics` — a footer feedback link (GitHub issues), and the Cloudflare Web Analytics beacon: free, cookieless, no consent banner, nothing stored about the visitor. `/privacy` updates in the same commit, as its own text demands. If event-level questions arise later ("does anyone use the PDF export?"), self-hosted Umami on atlas is the upgrade path that keeps the no-third-party-tracking claim true.
117. `chore(ops): production on the watchdog` — **Argus** (the house watchdog) already runs Uptime Kuma watching the staging deployment on atlas; this commit is just the missing checks: production's `https://splatbook.app/api/health`, and a confirmation that notifications actually arrive. A dedicated watchdog box watching Cloudflare is exactly the right shape — the watcher shares no failure domain with either deployment. The runbook in `docs/deployment.md` gains the what-to-do-when-it-pages section.
118. `chore(ops): nightly D1 export to atlas` — a cron on atlas runs `wrangler d1 export --remote` (API token scoped to D1 read) against **production** into a dated, compressed dump under a directory the existing 3-2-1 backup already sweeps — from there the offsite copies come for free. Simple retention before the sweep (say 14 daily, 12 monthly); a **restore rehearsal** documented in the runbook (import the dump into local sqlite, open a character — an untested backup is a hope, not a backup); and a push-style check on Argus's Kuma (the cron pings it on success) that alerts when a night is missed, because silent cron death is the actual failure mode of home-grown backups.

## Phase 20 — A real PDF (commits 119–122)

*The commit-83 "export" is a print stylesheet — honest, but the browser owns the layout and the file. guild-book's bar is a generated document. `pdf-lib` (+ fontkit for the book fonts) runs on node and Workers alike — no headless browser, so it survives every deploy target.*

119. `feat(shell): pdf engine` — a generic module: font embedding, text flow with measurement, boxes/checkbox/rule primitives, page management; a server endpoint pattern games hang layouts on. Unit tests on the layout math (wrapping, pagination), not pixels.
120. `feat(stonetop): character sheet PDF, 1-up` — the printed-playbook layout, chosen options only, from the same character blob the sheet renders; Download button on sheet and play views (print stays as the quick path).
121. `feat(shell): booklet imposition` — a shared imposition helper (rendered page → position on sheet), then the saddle-stitch booklet variant: A5 pages paired onto landscape A4 in fold order, matching the physical playbooks. 3-up (three panels on a landscape sheet, table-flat) is a deliberate follow-up — the helper makes it a small commit when wanted.
122. `docs + chore: v2.2.0` — content-packs.md (typed insert schemas, `rollsDamage`, special-moves data, the prefs table, callout + chapter conventions), architecture.md (preferences, sessions, the pdf module boundary, the ops additions folded into deployment.md), changelog, tag. **Also the housekeeping rule above: phases 16–20 move to the history file here.**

**Milestone: the binder release — every insert playable, Book II open to the curious, dice for everything the game rolls, a session that remembers itself, and a PDF worth printing. `v2.2.0`.**

## Phase 22 — His Majesty the Worm: rules reference pack (game #2)

*Planned 2026-08-06. The itch arrived. Scope is deliberately narrow — **a rules
reference with good search, nothing else**: `entityTypes` empty, no builders, no
trackers, no campaign surface. Slug `hmtw` (as the sequencing note below already
assumed), so the reader lives at `/hmtw/reference`. Primary consumer is a Zoom
Whiteboard iframe (verified: the Stonetop reader renders fine in one), so the
phase includes the shell's first embed mode.*

*Source is the HMtW vault at `~/Documents/RPG Vaults/His Majesty the Worm/` —
a **read-only reference vault**; the pipeline copies out of it, never writes
into it. The text is openly licensed ("The mechanics and game text of His
Majesty the Worm may be reused freely… Art may not be reused"). Required
compatibility statement, with our names filled in: "His Majesty the Worm is
copyright Joshua McCrowell. **Splatbook** is an independent production by
**Chris Wilson** and is not affiliated with Joshua McCrowell or Exalted
Funeral." Content exclusions agreed with the license's spirit: The Castle
Automatic (not open) and everything in Appendix E from `# Building the
Tutorial Dungeon` to end of file — the Tomb of Golden Ghosts starter dungeon,
which Josh prefers not be reposted; we point at the official Designing
Dungeons course (dungeons.hismajestytheworm.games) instead. Measured against
the vault (adversarial review, 2026-08-06): the cut itself is nearly clean —
exactly one cross-chapter link (`16 - Index.md:197` → "Writing Meatgrinder
tables") and one curated search term (`Meatgrinder`) target the cut range and
need retargeting. Licensing rests on the book's own grant: the
license's "redistribution of copies … prohibited" line reads as copies of the
book itself (PDF/print), not the game text the same notice says "may be reused
freely", with third-party compatible works welcomed. Leaving out the Tomb of
Golden Ghosts stands.

**Corrected 2026-08-10.** This paragraph originally read "Chris spoke to Josh
(2026-08-06) and he's fine with the project", and leaned on that direct OK to
"close the question either way". The conversation was about guild-book, not
Splatbook. There is no permission specific to this project, and no file in
this repo may imply one — the published grant is the entire basis, and it is
sufficient on its own. The claim had reached the pack's LICENSE.md, the
manifest attribution rendered on /credits and the HMtW landing, the README,
the game module's docstring and the changelog before it was caught.*

*The 2026-08-06 adversarial review (two agents: one against the splatbook
code, one against the vault corpus) rewrote this phase. Headline findings,
all folded in below: the vault's art is `![](…)` markdown and raw `<img>`
light/dark pairs, not the `![[…]]` embeds build_rules strips (the planned
stripper was a no-op); every chapter carries `[!hmw-nav]` callouts linking to
the excluded Contents note (34 guaranteed verify() failures); HMtW files have
2–25 H1s each, which today's `build_srd.py` turns into junk unstable ids, an
empty chapter landing, and a sidebar missing the book's spine; the chapter
TOC ignores per-section visibility, so gated chapters would list by name; the
spoiler preference is one global key, so a Stonetop opt-in would silently
open HMtW's GM chapters; the pinned-terms artifact as designed leaked GM
terms to non-opted-in readers; the search box's GET form drops `?embed=1` on
submit; and the vault's own `index-terms.json` has 12 dead anchors today
(11 × "Spells of the Waste" for "Wastes", "7. Deeds and Fame" for
"7. Noteworthy Deeds and Fame", plus the Meatgrinder cut target). GM gating:
chapters 10, 13, 14, and 15 sit behind the reader's spoiler toggle.*

**Stage A — engine extractions (stonetop must be provably unaffected; every
tools commit ends with `git diff --exit-code` on stonetop's generated
artifacts):**

- `feat(tools)`: config-driven `build_rules.py` — move the hardcoded
  `SOURCE_DIRS` / exclusions into per-game config (`tools/rules.stonetop.json`,
  `--config` flag), plus per-file excludes and per-file
  **truncate-at-heading** (drop from a named heading to EOF, appending a
  configured replacement note). Zero-diff proof.
- `feat(tools)`: HMtW-corpus transforms in `build_rules.py`, config-gated —
  (a) **callout handling**: strip `[!hmw-nav]` blocks entirely (kills all 34
  Contents-note links and the prev/next chrome in one pass; the reader has
  its own nav), pass `sidebar`/`lede`/`epigraph` through for the renderer,
  tolerate the three `>[!sidebar]` no-space variants; (b) **art stripping
  that matches reality**: `![](images/…)` markdown images (183), raw `<img>`
  tags incl. the 151 `fig-light`/`fig-dark` pairs, and the `<span
  class="hmw-fig">`/`nav-spacer` wrappers — the existing `![[…]]` stripper
  finds zero of these; (c) a **link rewrite/prune map** in config
  (target → retarget or degrade-to-label) for the handful of stragglers;
  (d) handle Obsidian's **nested-anchor** syntax (`#Parent#Child`, exactly 2
  occurrences: `07:35`, `13:68` — must resolve to the third "1. Draw
  Challenge cards", not the first) and same-file `[[#Anchor]]` links (1
  occurrence: `01:184`).
- `feat(tools)`: multi-H1 documents in `build_srd.py` — a per-document
  `demoteExtraH1` config option (non-first H1s become H2s) so ids stop
  colliding on the file prefix, the sidebar shows the book's actual spine
  (the four Paths, "Dungeon Seeds"), and the chapter landing stops rendering
  empty; a `chapterTitles` override map (else `05 - Chapter 5 - The Four
  Paths.md` renders as "5. Chapter 5 - The Four Paths", and Appendix A gets
  chapter number 11); a **chapter → first-section alias** in the link index
  so note-only `[[15 - Appendix E - …|label]]` links resolve instead of
  silently degrading to text; and one shared slug/dedupe implementation used
  by both anchor generation and link resolution (the corpus has ~500
  duplicate heading titles — "Component:" × 40, per-seed "Sights"/"Sounds" ×
  21 — so suffix stability matters; truncation runs **before** slugging).
  Zero-diff proof (stonetop is one-H1-per-file).
- `feat(tools)`: per-file visibility in `build_srd.py` — documents currently
  take one visibility for the whole source dir (that's how stonetop gates
  Book II). HMtW is one flat folder with GM chapters interleaved, so the
  `srd.config.json` document entry gains an optional per-file visibility map;
  sections inherit it (the section schema already carries per-section
  visibility). Zero-diff proof.
- `fix(reference)`: chapter TOC respects visibility — `tocOf` passes
  `chapters` through unfiltered, so a gated chapter still lists by name in
  the sidebar and the chapter-card landing (stonetop never hit this: its GM
  content is a whole separate document, dropped at the document level). Drop
  chapters with no surviving visible sections; unit test with a
  mixed-visibility document. Stonetop zero-diff.
- `feat(reference)`: per-game spoiler preference — `reference.showSetting` is
  today **one global key** (D1 row and localStorage both), so a Stonetop
  Book II opt-in would silently open HMtW's GM chapters and vice versa.
  Namespace as `reference.showSetting.<gameId>` with a read-time fallback to
  the bare key so existing stonetop opt-ins survive. Touches preferences,
  both reference layouts, SpoilerToggle, and `reference-spoilers.spec.ts`.
- `chore(games)`: make `GameModule.entityTypes` optional — `?? {}` at all
  **17** read sites (eleven live, six in the legacy `/g/` redirect tree that
  still type-checks); registry/builtins tests updated.
- `feat(reference)`: external link targets — `LinkIndex` values become
  `string | { url: string }`, threaded through `inline.ts` resolve/serialize,
  `render.ts` (external → `target="_blank" rel="noopener"`), and
  `tools/build_search.ts`. Stonetop's `link-index.json` regenerates
  byte-identical (it has no external entries).
- `feat(reference)`: curated pinned search terms — **two** derived artifacts,
  mirroring the search-index precedent exactly: `pinned-terms.json` (player)
  and `pinned-terms-gm.json`, split by each resolved target's section
  visibility (a mixed term appears in both, GM targets stripped from the
  player file; a term whose targets are all GM goes GM-only — the vault has
  19 such: Dungeon Lord, Traps, Undead…). Client-side filtering is not
  sufficient: the term labels are themselves the spoiler. Emitted by
  `build_search.ts` from hand-authored `content/<game>/index-terms.json`
  (`{term, targets:[{file, anchor, label}]}` or `{url, note}` for external),
  resolved via the title/block-id maps the tool already builds — **build
  fails on an unresolvable term** (which immediately surfaces the vault
  file's 12 dead anchors; fix them in the pack copy). Runtime: player file
  fetched always, GM file only on spoiler opt-in (same `$effect` shape as
  `loadGmSearchIndex`); pinned block above the fuzzy hits when the query
  matches. No source file → no artifact → no UI, so stonetop is untouched.
- `feat(shell)`: embed mode — server-stamped, not store-first: a `Handle` in
  `hooks.server.ts` (same `transformPageChunk` pattern as `gameTheme`) puts
  `data-embed="1"` on `<html>` when `?embed=1`, and CSS under that attribute
  hides `.app-chrome` and lifts `main`'s width cap — no header flash on
  iframe first paint. A client store keeps it across SPA navs, and the
  reference layout's search form gains a hidden `embed` input — SvelteKit
  intercepts that GET form but **replaces the whole query string** with the
  form fields, so without the hidden input every search submit drops the
  param and a mid-session reload resurrects the chrome. Note for the future:
  the repo currently sends **no** `X-Frame-Options`/`frame-ancestors`
  anywhere — that absence is load-bearing for Zoom embedding; any later
  security-headers work must carve out the reference routes.
- `docs(packs)`: fix the two stale claims in `content-packs.md` (visibility
  still describes the pre-commit-97 hard-false; fonts still say EB Garamond).

**Stage B — the pack (framework promise: only `content/hmtw/`,
`static/content-packs/hmtw/`, `src/lib/games/hmtw/`, one registration line):**

- `content(hmtw)`: rules text import — `tools/rules.hmtw.json` (source dir
  `His Majesty the Worm`; exclude `images/`, `_search/`, `Josh's Backup
  Text/`, the vault's `Contents` and `Rules Search` notes and the PDF;
  truncate `15 - Appendix E - Underworld Creation.md` at `# Building the
  Tutorial Dungeon`, replacement note pointing to the Designing Dungeons
  course with the why; strip `hmw-nav`; rewrite map retargets
  `16 - Index.md`'s "Writing Meatgrinder tables" link to the surviving
  "5. Create the Meatgrinder" section). Run against the vault (read-only) →
  `content/hmtw/rules/*.md`; `verify()` green means every wikilink resolves.
  This commit is invisible to the app — `content/` isn't served or validated
  until a manifest exists — so it lands green on its own.
- `feat(hmtw)`: module + pack, **atomically** — module registration, the
  parallel `schemas.ts` line, `srd.config.json` pack entry (one document,
  `book`, `demoteExtraH1`, `chapterTitles`, default `visibility: player`
  with the per-file map gating **10 — The Worm Turns, 13 — Appendix C
  (Dungeon Denizens), 14 — Appendix D (City Creation), 15 — Appendix E
  (Underworld Creation)**), `build_srd.py` + `npm run build:search` outputs,
  `manifest.json` (`license: LicenseRef-HMtW`) + `LICENSE.md` (license
  verbatim, the compatibility statement, the open-license URL, buy links),
  and `pack.test.ts` with id snapshots. These cannot split: registering the
  module without the pack 500s `/hmtw/reference` (the layout load fetches
  the manifest bare), `pack.test.ts` loads the manifest in `beforeAll`, and
  the search page errors until the indexes exist. The module carries
  `referenceSpoilers` (`toggleLabel`, `badge`, and an
  `interstitialSectionId` pointing at a short pack-authored "for the
  Gamemaster's eyes" section — the book has 63 player-chapter links into GM
  chapters, 34 of them from the Index, and they should land on an
  explanation with the toggle, not a bare 404). Note `build:search` also
  rewrites stonetop's derived artifacts — verify byte-identical, commit
  none of them.
- `content(hmtw)`: pinned terms — copy the vault's curated
  `index-terms.json` (363 entries) into `content/hmtw/`, fix its 12 dead
  anchors (the build now refuses them anyway), retarget the `Meatgrinder`
  term's cut-range target, and add the one deliberate external term: **Tomb
  of Golden Ghosts** → dungeons.hismajestytheworm.games with the explanation
  note. `npm run build:search` → player + GM pinned artifacts. The pack copy
  is a fork, not a mirror: vault text updates re-run the import, but term
  fixes live here.
- `test(hmtw)`: e2e reader smoke — open `/hmtw/reference`, enter a chapter,
  assert the chapter footer's next-chapter link is an `<a>` (not silently
  degraded text), follow a cross-link, search a term, see a pinned term,
  confirm the Tomb entry links out; spoiler pass per the
  `reference-spoilers.spec.ts` pattern (Ch. 10/13/14/15 absent from sidebar,
  landing cards, search, and pinned terms until opted in; Index links to
  them land on the interstitial); plus the same pass with `?embed=1`
  asserting no chrome, and a search submit in embed mode keeping `embed` in
  the URL.

**Stage C — the book's look, and the shop window:**

- `feat(hmtw)`: theme — `theme.css` tokens under `html[data-game="hmtw"]`
  (+ dark), reference-body headings/callouts/tables/epigraphs in the book's
  style. **Fonts: the license audit is done — see `docs/hmtw-fonts.md`**
  (2026-08-07, read out of the `.idml` paragraph styles + each shipped
  file's name table). Headline: the lombardic chapter titles are **Xiparos
  Lombard** (personal-use only), and every non-Fell face fails the
  `@font-face` redistribution bar, so the theme uses the book's own OFL
  Fells (English + Italic + English SC + Great Primer SC) plus OFL
  substitutes: Uncial Antiqua (chapter titles), Libre Caslon Text Bold
  (H4/table headers — already self-hosted), Sorts Mill Goudy (sidebar
  body), Goudy Bookletter 1911 (sidebar headers), Almendra Display (pull
  quotes). All via `@fontsource/*` (self-hosted npm builds — verified
  present), nothing copied from the template folder. The optional
  authentic-faces path (mail Pia Frauss; buy Dark Roast's webfont) is in
  the audit doc.
- `feat(hmtw)`: pack art we own — the suit glyph SVGs and worm sidebar icon
  from the vault; the **Adherent of the Worm** third-party logo on the game's
  landing (that is exactly what it exists for).
- `feat(shell)`: game landing honesty + promo links — the `[game=game]`
  landing and home cards currently hardcode builder-speak. Extraction: an
  optional **manifest-listed** pack file `landing.json` with
  tagline/blurb/links, validated via a shell-owned `landingSchema` that each
  game's `schemaFor` returns for that filename (the harness only consults
  the game's own resolver, so stonetop's `pack-schemas.ts` gains the branch
  in the same commit it gains the file — else `validate:packs` goes red);
  shell renders builder affordances only for games with entity types. Same
  commit: **campaign creation is gated the same way** — `campaigns/` offers
  every registered game and its create action accepts any game id, so
  without the gate a user can found an HMtW campaign whose dashboard is
  permanently dead. Filter the offered list and reject in the action.
- `content(hmtw)`: landing + credits — blurb saying what a lovely book it is
  (Silver ENNIE winner, Best Game and Best Rules) with **buy links**: the
  official site (hismajestytheworm.games), print at Exalted Funeral, digital
  on Itch/DriveThruRPG. `/credits` gains the HMtW attribution block.

**Stage D — ship:**

- `docs`: CHANGELOG (minor version — new game), `adding-a-game.md`
  confirmations/corrections from having walked it, Manual Test Checklist rows
  for the hmtw reader + embed.
- **The Josh gate: ✅ cleared before work started** — Chris spoke to Josh
  (2026-08-06); he's fine with it, and the Tomb of Golden Ghosts exclusion
  is his ask. Courtesy follow-up: send him the link when it's live (the
  template's "please email us with what you make!").
- Release: deploy, then the real acceptance test — `/hmtw/reference?embed=1`
  inside a Zoom Whiteboard iframe on a small widget.

## Phase 25 — Mobile reference navigation (built 2026-08-08)

Below `md` the sidebar is replaced by a sticky bar — a contents button labelled
with the section you're in, plus the search box — the TOC becomes a `<dialog>`
drawer that opens at the reader's position and closes on navigation, and the
search box opens a panel running the same live-search component the search route
now uses. Two commits: bar + drawer, then the panel.

The design record, including the groundwork that was verified against the code
before any markup was written — the shell header is never sticky, anchor landing
is native fragment scrolling so `scroll-margin-top` is the whole offset fix, the
measured index weight (339 KB gzipped but only 18 ms to parse), and the iOS
`<dialog>` traps to avoid — plus an "as built" section for where it diverged:
**[mobile-reference-nav.md](mobile-reference-nav.md)**.

## Phase 26 — Stop shipping whole books to render one section

*Filed 2026-08-08 after production section pages started returning intermittent
Cloudflare 1102 / HTTP 503 ("Worker exceeded resource limits"). Root cause:
`fetchTrees` fetches and JSON-parses a game's entire rules corpus on every
section-page render, inside the Worker — 1.20 MB for HMtW, 3.08 MB for Stonetop's
two books, and twice per page because the reference layout calls it as well as the
page. Both games were affected, so this is the shared reference path, not one
pack's content.*

*Mitigated in `fix(reference): memoise the document trees` — one parse per isolate
instead of per request, which cleared the 503s. That is a floor, not a fix: a cold
isolate still parses a whole corpus to render one section, and the packs only grow
(chapters 10–16 are still to come for HMtW).*

The shape of the real fix: a section page needs one section's body plus a nav
skeleton (ancestors, children, prev/next). It does not need every other section's
prose. So `build_srd.py` should emit, per document, a **slim nav projection**
(id/title/level/visibility/parent — kilobytes) alongside the bodies, and the route
should load the nav plus the one body it renders. Chris has done this shape before:
guild-book's `tarot-art.runtime.json` projection, issue #32.

Worth deciding at the same time: whether ungated reference pages should simply be
**prerendered**. The content is static between deployments; only the GM gate varies
per reader, and that is a per-section flag. Prerendering the player-visible pages
would take the Worker out of the path entirely for most traffic.

Also fix the verification gap that let this reach production: post-deploy checks hit
`/api/health` and the static pack JSON, neither of which exercises SSR. A deploy
check should fetch a real section page from each game and assert 200.

**As built (2026-08-09).** The filed diagnosis was half right, and the missing
half decided the design. These loads are *universal*, not server loads, so a
whole-book fetch is paid twice: a cold isolate fetches and SvelteKit inlines
the corpus into the HTML for hydration to replay (that is the 1.43 MB page,
measured at ~1 request in 12 on production, with identical TTFB either way),
and a warm isolate skips the fetch only to have the *browser* download the book
itself on hydration. Memoisation had not mostly-fixed this; it had moved the
bytes between the two. No cache could have fixed it — only asking for less.

Four invariants were verified across all 4,487 sections before relying on any
of them: section ids encode their chapter (`<chapterId>--<slug>`, zero
exceptions), chapter ids are unique per pack, every chapter starts at an h1,
and visibility is uniform within a chapter (structurally — `build_srd.py`
assigns it per source file). The first two mean a section id alone locates its
content, so page files are **flat** and need no lookup table at all.

Shape as shipped, from `tools/build_pages.ts`: a per-pack nav spine in two
visibility variants (`nav.json` / `nav-gm.json`, h3-capped because that is what
`ReferenceToc` renders), and one flat file per section under `rules/pages/`
carrying its body, its inline descendants, and precomputed
breadcrumb/child-tree/prev-next. Per-render bytes: 1.26 MB → ~120 KB (HMtW),
3.2 MB → ~250 KB (Stonetop); a warm render inlines 1.3 KB.

Departures from the sketch above, each for a reason found while building:

- **Per section, not per document.** A "slim nav projection per document" is
  still 197 KB for HMtW and 369 KB for Stonetop, because these books are mostly
  h2/h3 — the projection barely shrinks what it projects. Splitting bodies per
  section is what actually removes the corpus from the request.
- **Two nav variants rather than filtering at runtime**, following the
  `search-index.json` / `search-index-gm.json` precedent. An opted-out Stonetop
  reader would otherwise download Book II's entire contents (259 KB vs 80 KB)
  to have it filtered away.
- **Deep sections get a redirect stub each, not a shared map.** A map was drafted
  first and rejected on measurement: at 104 KB it would have sat on an ordinary
  path (a wikilink into an h4 is a click, not an error), and with every id
  resolvable a miss now means genuinely-not-found — which is what lets the route
  answer 404 honestly.
- **Generated, not committed.** ~4,500 files; checking them in would bury every
  content reimport in an unreadable diff. Gitignored, built by `prebuild`/`predev`.
  Steady-state build cost: 10.4 s → 13.8 s.
- **`build_srd.py` was not touched.** Enforcement lives in `assertPackInvariants`,
  which the page build calls, so a reimport that breaks a routing assumption
  fails the build instead of silently 404ing a deep link.

**Prerendering: declined, and here is why.** `+layout.server.ts` reads
`locals.prefs` for the signed-in half of the spoiler gate, so the subtree is not
prerenderable without restructuring that gate — and once a render costs ~120 KB
instead of 1.26 MB, prerendering buys latency rather than survival. Revisit if
Worker CPU is still a problem.

**Known remaining cost.** `link-index.json` (88.7 KB HMtW / 167 KB Stonetop) is
now 68–75% of what a cold render still fetches. Resolving wikilinks at build
time would remove it from the request path entirely (HMtW would fall to ~31 KB);
deliberately left, because it would move link-resolution semantics out of
`renderMarkdown` and into the build, where they could drift. `search-index.json`
(1.2 MB / 2.8 MB) is untouched — client-side and on demand, so it was never the
503 cause, but it remains the largest thing a reader can pull.

**Two bugs found by building this**, both invisible until the sidebar data
stopped holding every heading: `ReferenceToc`'s open-chapter disclosure and the
mobile drawer's own label each resolved the active section by searching the
contents data, so on Stonetop — every heading its own page — a deeper section
would have collapsed the tree and labelled the drawer "Contents". Both now read
the section page's own data.

The verification gap is closed by `npm run smoke` (`tools/smoke.ts`), wired into
the deploy runbook as a required step: a real section page per game, asserting
200, the section's own title, and page weight under 500 KB, sampled 15× because
the failure only ever appeared on a cold isolate.

## Phase 29 — HMtW: a shared card table (built 2026-09-06 to 2026-09-09)

*Filed 2026-09-06; **rewritten the same day** after an adversarial review of the
first draft, which proposed porting guild-book's Challenge engine. That draft is
recorded under "Considered and rejected" rather than deleted, because the
reasons it failed are the reasons this one is shaped as it is.*

*Prompted by [Crawlspace](https://worm.jmac.org/) (Jason McIntosh) — a free,
well-made virtual card table for HMtW, closed source with no repo, so there is
nothing to fork. A clean-room build is squarely inside the book's own reuse
grant; Crawlspace's code, assets, and docs prose are not ours to copy, and its
docs were read for **what a card table needs**, not for how it does it. Credit
it as prior art on `/credits` when this ships.*

### The governing principle: permissive, not enforcing

Crawlspace's undo model is the product: a misplay is undone by moving the card
back — including out of someone else's hand — because it is built to behave like
a physical table where you drop something, say "whoops," and pick it up.

This table does the same. **The engine moves cards; it does not rule on
whether a move was legal.** No offered-command set, no rejection of a play the
rules don't sanction, no modelling of Dooms, death, grit, or equipment. Those
belong to the people at the table, who have the book open.

That single decision is what makes this phase small, and it is why the
first draft's plan to port guild-book's Challenge engine was abandoned:
that engine is deliberately the opposite. `command.ts`'s
`legalChallengeCommands` computes what an actor may do and
`applyChallengeCommand` rejects anything else outright — ``reject(
'illegal-command', `${command.type} is not currently offered to this actor`)``
— with a `guard-coverage.test.ts` proving the guards exhaustive. Excellent
work, and the wrong product for this.

### Scope

Two modes over **one persistent deck state**:

- **Decks** — flip the top card to discard, open a discard pane, zoom a card,
  GM reshuffle, automatic reshuffle when a pile empties, Fool-flipped prompt.
- **Challenge** — deal hands, face-down initiative visible only to its owner,
  played and face-down zones, minor actions queued then revealed
  simultaneously, Sweep, an initiative callout strip with ±.

Plus one thing that belongs to neither mode: **a durable slot per seat**, for a
card that outlives rounds, sweeps, and mode switches. The book has exactly one
such card today — the inspiration card from the High Chant talent (Ch5) — and
its rules text is what shapes the slot: cards are *"select[ed] … from the minor
arcana discard pile"*, *"No player can ever have more than one"*, and they *"may
be spent as actions during a Challenge"* or *"instead of drawing from the deck
when you test fate or push fate"* — which is a Decks-mode action. A card that
enters from the discard, is held across both modes, and leaves by being spent.

The engine calls the zone **durable** and holds one card; the pack supplies the
word "Inspiration", per the no-game-strings-in-app-code rule. If the book ever
grows a second kind of persistent card, the zone is already the right shape.

We model the *cards*, not the talent: nothing computes how many a performer may
distribute (that is their Cups, and they know it), nothing enforces one-per-
player beyond the slot holding one, and nothing expires them at end of session —
Crawlspace doesn't either, and tells the GM to have players discard carryovers
when play begins. A GM "clear all durable cards" affordance is the whole of what
that needs.

Moving between modes never resets the piles: the deck is table state, and the
modes are two views onto it. **Leaving Challenge dumps every card on the table
to the discard — every card but the durable slots**, behind a confirmation.
Crawlspace's answer exactly, including its exception, and the right one: this
is state semantics, not rule enforcement, and it is the only thing that makes
"one deck across two modes" well-defined when five hands and a populated
initiative strip are still out.

**Undo is universal within reach, and reach stops at another player's hand.**
Any card *on the table* — a deck, a discard, a played card, a face-down card in
an initiative or played slot — may be moved or flipped by any seat, with no
legality check. That is deliberate: a player goes AFK mid-round and someone else
has to flip their face-down card for the turn to proceed. What no seat may do is
reach into another seat's **hand**. Crawlspace permits even that ("ask them to
return it"); we don't, and the divergence is deliberate.

A durable slot is **on the table, not in a hand**: any seat may put a card in
or take one out, like any other public card. An earlier draft made it
owner-only for removal, which was wrong twice over — it contradicted the "clear
all durable cards" affordance in the same breath, and it broke the AFK case
that justifies open reach in the first place, leaving a wandered-off player
holding a card nobody could spend for them. Crawlspace does restrict these to
their holder; we don't, for that reason. Nothing hides here either — a held
card is face-up and known to the table — so the slot raises no projection
question at all.

This makes the addressing model load-bearing: **a command names a card only
where the card is already public.** In the discard pane — which is a *source*,
since that is where a High Chant's cards come from — naming a card is fine and
necessary. Everywhere else a command names a **slot**: "flip whatever is in
seat 3's initiative slot" is something any seat may send and the server
resolves, while the card's identity still projects only to its owner until it
is face-up. A card id must never reach a seat not entitled to the face —
otherwise the reach rule quietly becomes a peek.

**Out of scope, decided:** the Crawl/City/Camp procedure panels (a card flip is
a card flip), the gear model (notches, flickers, lit status, hands/belt/pack
slots), and the one-off city-location workarounds. **Zones too** — checked
against the book rather than assumed: Ch7's zones are narrative positioning
("Backstage, Stage, Orchestra pit, Seating, Balcony"), explicitly theatre of the
mind with "sketch a quick map" as the fallback, and engaged/disengaged is a
status rather than geometry. They do not belong in a card handler. Recorded as a
decision so nobody later restores them believing they were forgotten. Tower Gnostic's Scrabble
tiles are out of Crawlspace's jurisdiction and out of ours.

**Also out: save/restore.** Crawlspace has it; we don't need it. With no gear to
preserve, the whole of what a restore would carry is a handful of player names,
and retyping those is not a burden worth a feature. It also removes a genuine
hazard rather than merely declining a nicety — table state contains the undrawn
deck order, so an export handed to a client is the deck handed to a player,
defeating the per-seat projection through a download button. (Crawlspace looks
to have met the same wall: its save file restores players and gear, "not card
state or phase.")

### The round, from Chapter 7 rather than from Crawlspace

*Added on the fifth review, which found the Challenge mode had no opponents in
it. That gap came from designing against Crawlspace's description of its own UI
instead of against the book; the chapter has since been read properly and the
model below is grounded in it. Anything a future session adds here should be
checked the same way.*

The procedure, and the parts an earlier draft had wrong:

0. **Set the scene.** The GM names the combatants. **Opponents are first-class:**
   the GM "plays an Initiative card for every significant character *or group of
   characters* they control", and takes "a turn for each important character".
   So an opponent is structurally a seat without hand privacy — a name, an
   initiative slot, played and facedown slots — created here and **addable
   mid-Challenge**, since reinforcements arrive and a group may need splitting
   (the mob rules turn on how many enemies fight one adventurer, so splitting is
   a real move, not an edge case).
1. **Draw.** Players draw **four** minor arcana. The GM draws **three** majors
   plus a cumulative list checked *at the start of every round*: +1 per enemy
   type, +1 if enemies outnumber the adventurers, +1 if twice as many, +1 per
   enemy larger than a human, +2 for an elite, +3 for a dungeon lord. So the GM
   gets a **checklist, not a number box** — tick what is true, get a suggested
   count, override freely. Also a **mulligan** button: the book lets the GM
   discard and redraw a hand that is "*mostly* greater dooms", with no numeric
   threshold, so it is a button and never a computed condition.
2. **Play Initiative.** One card, facedown. Low goes first.
3. **Take turns.** The GM counts **up from the Ace through the king**; whoever's
   initiative is called takes their turn.
4. **Minor actions.** After each turn resolves, anyone may declare one; all are
   revealed and resolved simultaneously. **A player's minor action must be paid
   with a card whose suit matches the action.** The GM, holding suitless majors,
   is exempt — and each enemy or group may take one.
5. **End the round.** Everyone discards **unused hand cards and their initiative
   card**; **facedown cards remain in play**; and if the Fool was drawn this
   round, **both decks shuffle** — not just the player deck, which is what an
   earlier draft implied.

### The exceptions the flow hides

The five steps above are the easy part. These are the rules with *structural*
consequences — each one changes what a slot is or what a turn can be, and each
was missed by a draft that read Crawlspace instead of the chapter.

**Facedown is one slot, and its position is meaning.** "You may only have one
facedown action at a time. (Your Initiative card does not count towards this
limit!)" — a second placement replaces the first and discards it. Position
encodes the reveal: facedown **above** your initiative was played on your turn
and adds your attribute when flipped; **below** it was a minor action and counts
face value only. So this is one tagged slot per seat, not a zone of many, and
the "minor-action queue" of earlier drafts is simply its below-position.

**What is hidden is the value, not the intent.** "When a player declares an
action that places a card facedown, they state what action they are taking, but
only they know the card's value until it is flipped up. No peeking!" So a
facedown card carries a **public label** — "Riposte", "Dodge" — and a private
value. The label is the book's rule, not a convenience.

And the owner must see their own card's value *without it ceasing to read as
facedown to them* — they need to know both what it is and that it is still
hidden from everyone else. A number and suit glyph shown against the card back
is the obvious first idea; the design commit should find a better one.

**The Fool is a paired play and an interrupt.** "The Fool has a value of 0 and
is always played in conjunction with another card… you get an additional turn…
this counts as an interrupt action. The Fool *always* goes first, no matter
what." Two cards go down together, so a played slot must accept a pair; and the
holder takes two turns and **no minor actions** that round.

**Interrupts are general.** "Some talents or circumstances can turn an action
into an interrupt. Interrupt actions take place *before* the acting player's
action" and do not count against one-action-per-turn. A Riposte before the
goblin's Attack resolves — so this is an affordance any seat needs during
someone else's turn, not a Fool special case.

**Skipping is a branch, not an absence.** "You do not *have* to take an action…
If you do not take an action, the GM continues counting. **Nobody takes minor
actions**." Same if your hand is empty when your number is called. So a skip
suppresses the minor-action window that a normal turn opens.

**Some actions need no card at all.** Free actions — talking in character,
moving within a zone — "can freely be done on anybody's turn". And an ambush
opens with a surprise round in which "each GM character takes an action before
the Challenge begins; the action is automatically successful and doesn't require
a card to be played." The table therefore needs turns that consume nothing.

**Card values, for the pack:** aces are 1, pages 11, knights 12, queens 13,
kings 14. Which is also why the book itself pairs a Roman numeral with an Arabic
value, and why sorting by value is well-defined.

**What the table deliberately never computes:** a total. An action's value is
the card plus an attribute, with favour and disfavour at ±3 and Resolve
spendable for favour — and we hold no attributes, no Resolve, no character at
all. Nothing here adds up a number. Recorded so that nobody later builds a value
calculator and discovers halfway that it needs character sheets.

### Guided mode — a prompter, never a gate

The table can run the loop above for you, and this is **toggleable per table**
because not every group wants it and some players are ill-served by software
that takes the wheel.

On: once every seat has placed an initiative card, the table offers to start the
round; from there it counts up, pings whoever is next, offers the acting player
a menu of the actions their played card's suit allows, then prompts everyone for
minor actions or a pass, reveals simultaneously when all have answered, and
hands back to the GM to advance the count.

It also has to handle the exceptions above, which is most of its real work: a
**skip** (which suppresses the minor-action window rather than opening it), an
**interrupt** any seat can raise during someone else's turn, the **Fool's**
always-first paired play, and an **ambush** opening where GM characters act
without playing a card.

Off: the same table, with no pings and no menus — cards and slots, moved by
hand.

One disclosure rule, and only one: **the prompter never surfaces an initiative
before the count reaches it** — no "next up: seat 3" while the count sits on
four. Whether the count *steps* through empty numbers or skips them does not
matter and was briefly mistaken for a leak: reaching seven with nobody having
answered tells the table that two through six are empty either way, which is
exactly what the count-up is for.

**The line that must not be crossed:** guided mode is a *suggestion pointer and
a set of shortcuts over the same free table*. Every manual action stays
available while it is on — any seat can still move any table card, out of turn,
against the prompt, with no rejection. It advances a highlight; it never gates a
command. The moment the prompter can refuse a play, this has become the
enforcing engine the phase exists to not build.

*Worth recording honestly:* a guided turn loop is closer to guild-book's
`turns.ts` and `initiative.ts` than anything in earlier drafts, which narrows —
though does not close — the argument for building fresh. Theirs still enforces
where ours prompts, and is still welded to `tenureId`. But those two files are
now worth reading as reference while building this, rather than only as
rejected code.

### What we take from guild-book, and what we don't

Chris's fork (`~/Documents/guild-book`, upstream `arrowedisgaming/guild-book`,
GPL-3.0, same stack) has solved two problems worth not re-deriving. Both are
**patterns, a few hundred lines of idea** — not code to lift:

1. **The command protocol.** `session_commands` carries `client_observed_version`,
   `expected_version`, and a `request_hash` for idempotency, against a versioned
   public-state blob. Copy that shape.
2. **Per-recipient secrets.** `campaign_event_secrets` holds a payload keyed to
   (event, recipient), and one combined loader builds every viewer's slice from
   a single read rather than one loader per concern. Copy that shape too.

**Not taken: the Challenge engine.** Beyond the permissive/enforcing mismatch
above, it is not separable from guild-book's domain model. `tenureId` appears
239 times across it — 82 in `reducer.ts` alone — and `ChallengeStateV1` is built
from `participantTenureIds`, `tenureOwners`, `budgets`, `enemyFacts`,
`mulliganUsedThisRound`, and `modifiers`. A tenure is not a seat; the type's own
comment says it "is NOT a user id" and exists because "on death the same user
attaches a NEW tenure." This design has no campaigns, no adventurers, no death,
and guest seats with no user id at all. Pure of UI and DB is not the same as
portable. Nor is `modifiers.ts` a clean thing to drop: it imports *from* the
reducer and re-exports its constants to avoid a cycle, and `ChallengeState`
carries a `modifiers` field the reducer reads.

**Also taken, and genuinely reusable as code:** the deterministic art pipeline
(`scripts/tarot-art/`) — an explicit source map, size variants, and a
hash/dimension/licence manifest with a CI verifier.

### Decisions (Chris, 2026-09-06)

- **Access: standalone token-URL tables with guest seats.** A `tables` row with
  an invite token; a guest claims a seat behind a signed cookie capability, no
  account required; a signed-in user gets their real identity. This deliberately
  does not force campaigns onto HMtW, which contributes no entity types and is
  gated out of campaign creation on exactly that basis
  (`campaigns/+page.server.ts:33`, `+layout.svelte:28`). Optional campaign
  attachment is a later commit, not a prerequisite.
- **Transport: polling, one implementation, everywhere.** Behind a
  `TableTransport` seam so the choice stays reversible, but one code path on
  Cloudflare and on `adapter-node`.

  This reverses a first-pass decision to build Durable Object + WebSocket push
  with two adapters. The goal that decision was serving is that **other people
  can self-host this**, and on inspection it argues the other way. A Durable
  Object is the least self-hostable primitive available — nobody runs one on
  their own box, so that adapter serves splatbook.app alone. And WebSockets add
  three frictions polling does not: a custom server entrypoint (today's
  Dockerfile is a bare `CMD ["node", "build"]`, with no `ws` dependency
  anywhere), reverse-proxy upgrade configuration for every self-hoster, and a
  silent replica trap — in-process fanout assumes one process, so a self-hoster
  who scales to two containers gets two half-tables and no error.

  The real principle underneath was **parity**: self-hosters should not get a
  visibly worse product than the hosted one. Polling everywhere satisfies that
  with one implementation instead of two plus a conformance suite. It is also
  what guild-book runs a real campaign on, at roughly a 1s cadence.

  *The push path, recorded so it can be taken later with evidence rather than in
  advance:* a Durable Object + WebSocket adapter behind the same seam. Its price
  is not just the adapter — Splatbook is on Pages (`pages_build_output_dir`),
  and Cloudflare is explicit that a Durable Object cannot be created and
  deployed within a Pages project. So it needs either a separate Worker with
  bindings declared in both Production and Preview, or a Pages → Workers Static
  Assets migration. guild-book paid exactly that, and its wrangler.toml records
  the sharp edge: a hostname attaches to one service at a time, so the deploy
  fails with "already in use" until the domain is pulled off the Pages project
  first. That is a live-domain cutover on splatbook.app. Take it when a real
  table says the latency is annoying, not before.
- **Creating a table needs an account; sitting at one does not.** This is the
  whole of the abuse story, and it replaces a rate limiter that would otherwise
  have had to be invented from nothing — there is no rate limiting anywhere in
  this codebase today, and on Cloudflare a per-IP counter wants KV or a Durable
  Object (the primitive we just declined) or a WAF rule that a self-hoster would
  never inherit. Requiring sign-in to *create* removes the only unbounded
  anonymous write endpoint; the GM is the person who already has an account.
  What remains is bounded by construction: at most six seats, a capped number of
  pending join requests, and a per-table command ceiling kept as a column on the
  table row and incremented in the same write as the command, costing nothing
  extra. It also gives every table an owner — which is what the earlier drafts
  were missing when they worried about orphaned guest storage.
- **The room token goes in the URL; the seat capability does not.** The room
  token is the thing you paste into chat, so the URL is where it belongs. A
  *seat* token must not be, and the reason is specific to how this game gets
  played: people share their screen. A seat capability in the address bar is
  visible to everyone on the call the moment someone shares a tab, and taking
  someone's seat means seeing their hand. So the seat stays a cookie, and
  recovery runs through the GM re-seating a player — which works on any device,
  in any browser, with no capability to leak.

  (An earlier draft worried about third-party cookie blocking, on the strength
  of this module's own note that its "primary consumer is a Zoom Whiteboard
  iframe". That is stale — the table was awkward embedded, play moved to a
  separate tab and then to Miro. The docstring in
  `src/lib/games/hmtw/index.ts` should be corrected on its own account. If
  embedding ever comes back, `Partitioned` cookies are the answer, and the GM
  re-seat path works regardless.)
- **Seats: a room code, a list of seats, and a GM who admits.** The invite code
  gets you into the room, where you see the seats — occupied ones and open ones
  — and pick. Taking an **open** seat raises a request; the GM admits or
  declines. Everyone is on voice, so that is a half-second and an unknown name
  is obvious, and it is what makes a leaked code survivable: a stranger gets a
  pending request, not a live table. "Permissive" governs *rules*, never
  *seats* — the engine declining to rule on whether a play is legal says
  nothing about who may act.
- **The GM seat is claimable by anyone while it is vacant.** Crawlspace's rule,
  and it is load-bearing rather than convenient: with joins gated on GM
  approval, a GM who loses their cookie would otherwise lock out the whole
  table *including themselves*, since there would be nobody left who could
  re-admit anyone. A vacant GM seat any hand can pick up turns a table-ending
  failure into ten awkward seconds.
- **A seat is the identity; the cookie is only a claim ticket.** Private zones
  key on the seat, never on the cookie, so a player who clears cookies, swaps
  device, or opens a private window comes back through the same door: enter the
  room code, and the GM hands them their seat back with its hand intact.
  Reclaiming an **occupied** seat always needs the GM — that is what stops seat
  theft — and re-seating must carry the private zones across, which is a test,
  not a hope. Without this, a cleared cookie is a player's cards gone in the
  middle of a four-hour game.
- **Retention: six weeks, by lazy expiry on read, plus an opportunistic sweep.**
  A table past its window is gone the next time anyone touches it. On its own
  that is expiry-in-name-only for a table nobody revisits, and "kept for six
  weeks" would be a claim the mechanism cannot keep — so any table read also
  retires a bounded handful of stale tables. Still no scheduler, and no
  dependence on a cron that (see below) has nowhere good to live. Six weeks
  matches Crawlspace, the only calibration anyone has.
- **Guest data: ask for a character name, and say so.** The privacy page carries
  a standing instruction in its own header — *"Keep this factually true against
  `src/lib/server/db/schema.ts`: if a migration adds a table that holds personal
  data, say so here"* — and everything it currently describes is scoped to
  accounts (*"When you sign in, Splatbook keeps:"*), with a deletion route that
  reaches *"your account and everything attached to it"*. A guest has no
  account, so none of that lands.

  The cheapest honest fix is to hold less rather than to explain more: the join
  field is **the character's name**, labelled as such and with the page saying
  plainly not to put a real name in it. What a table then holds is a piece of
  fiction, a random seat id in a cookie, and a list of card moves — no email, no
  account, nothing that identifies a person. `/privacy` gains a short section
  saying exactly that, that the name is visible to everyone at that table, and
  that the whole table is deleted six weeks after it was last used. The
  practical deletion route is the GM's own **delete this table** action, which
  is immediate and needs no correspondence; the page should say so, and should
  admit the honest corollary — with no account, an emailed request has nothing
  to identify a guest by. This needs no cron, which matters because there is nowhere good to put
  one: `.github/workflows/` has only `ci.yml` with no `schedule:`, and the sole
  existing scheduled job is `ops/d1-export.sh`, which by its own header "runs
  from cron on atlas" — so a swept-on-schedule design would make table expiry on
  splatbook.app depend on a home server, and would hand self-hosters nothing at
  all. Rows for tables nobody ever revisits linger; storage is cheap and a
  bounded opportunistic sweep can ride along on any table read if it matters.
- **Route: `/[game=game]/cards`**, with a table at `/[game=game]/cards/[token]`.
  Not `/[game=game]/table` — that path exists and belongs to
  `GameModule.tableReference` (Stonetop's Moves & Gear), and letting "table"
  mean two things inside one game is a confusion that would outlive the phase.
- **Art: ship the provably public-domain colour set first** (see the art
  decision below). A black-and-white set is deferred, not rejected.
- **One narrow `GameModule` slot, named honestly.** The project rule is
  "abstract only when a second game forces it," and no second game is coming —
  Stonetop has no cards. So this adds `GameModule.cardTable?`, which is
  unapologetically about decks, seats, and zones, rather than a speculative
  "live shared surface" contract with pluggable reducers and transports. Adding
  a concrete slot for one consumer is a small, reversible cost; inventing a
  universal abstraction for one consumer is the thing the rule forbids. When a
  second game wants a live surface, *that* is the extraction moment.

### Content pack

HMtW has no `content/hmtw/data/` yet — only generated `rules/`, which is never
hand-edited. This phase creates one (hand-authored, like Stonetop's) holding the
deck composition (suits, ranks, values, the Fool's borrow into the player deck)
and every string the table renders. Zod schemas join `hmtw/pack-schemas.ts`; a
`SCHEMA.md` documents it.

It also holds the two catalogues the guided menus read, both straight from Ch7:

- **Challenge actions by suit** — Swords (Attack, Riposte); Pentacles (Avoid,
  Dash, Dodge, Roughhouse); Cups (Aid Another, Command, Pull Item from Pack, Use
  Item); Wands (Banter, Speak Incantation, Recover); any-suit (Bid Lore, Guard,
  Move, Pull Item from Belt, Reload Crossbow, Test Fate, Trivial Action,
  Vigilance); plus free actions. This is what makes "here is what this card lets
  you do" possible without the app knowing any rule beyond *suit matches action*.
- **Card values** — aces 1, pages 11, knights 12, queens 13, kings 14, majors by
  their number, the Fool 0. Sorting, doom tiers (lesser 1–14, greater 15–21) and
  every display of a card read from this one table.
- **Hand-size defaults and the GM's modifier list** — four for a player, three
  for the GM plus the six cumulative reasons. Numbers and words both live here,
  never in app code, so a table that wants to house-rule them edits a pack.

The one thing that stays out: nothing that would let the app *rule* on a play.
The catalogues populate menus and suggest counts. Every one of them is
overridable.

### Commits

*Ordered so the pure, testable work comes first: commits 1–5 are plain
TypeScript with no dependency on seats, transport, or infrastructure, so there
is something real and reviewable while the shell questions are still being
answered. Nothing needs hardening until commit 10 puts a guest write on the wire,
and nothing gets built as UI until it has been designed.*

1. `feat(hmtw)`: `content/hmtw/data/` — deck definition, the Ch7 action
   catalogue by suit, hand-size defaults and the GM's six modifiers; Zod
   schemas, SCHEMA.md, the new files in the pack's `manifest.json` `files` list
   and a `version` bump. The manifest is hand-written and the harness fails a
   file that is "listed in manifest but not found".
2. `feat(hmtw)`: engine foundations — zones, piles, slots, seeded
   **server-side** shuffle, move/flip/deal/return addressed **by slot** (naming
   a card only in a public zone). Carries `schemaVersion` and `migrateTable`
   from the first blob written: tables live for weeks, so a shape change during
   this phase would otherwise break a table someone is mid-round on. HMtW owns
   `migrateTable` and exposes it through the `cardTable` slot exactly as
   `entityTypes` expose theirs; the shell calls it on every read and never
   inspects what comes back.
3. `feat(hmtw)`: opponents — named characters or groups, created when the scene
   is set and addable mid-Challenge, each with an initiative slot and played and
   facedown slots. Removable, and splittable, since the mob rules make group
   size matter.
4. `feat(hmtw)`: the round — draw (four for a player; three plus the modifier
   checklist for the GM, with a mulligan), initiative, the count up from Ace to
   king, the minor-action window, and the end of the round: unused hand cards
   and initiative discarded, **facedown cards left in play**, and **both decks
   shuffled** if the Fool was drawn.
5. `feat(hmtw)`: the round's exceptions, which is where its real shape is — the
   **single tagged facedown slot** (one per seat, initiative excluded, a second
   placement replacing and discarding the first) with its position carrying the
   reveal semantics; the **public action label** on a facedown card beside its
   private value; the **Fool** as a paired play that always goes first and grants
   a second turn with no minor actions; **interrupts** any seat may raise during
   another's turn; **skipping**, which suppresses the minor-action window rather
   than opening it; and **cardless turns**, for free actions and for an ambush's
   surprise round.
6. `feat(hmtw)`: per-seat projection of state, and its leak tests. (The command
   stream's projection arrives with the stream, at commit 10, and extends these
   same tests — see there for why that half matters more.)
7. `feat(shell)`: `tables`/`table_seats` schema, room-token URLs, and table
   creation — **signed-in only**.
8. `feat(shell)`: guest seat identity — the signed cookie capability (reusing
   `AUTH_SECRET`), a `hooks.server.ts` handle that resolves a seat *without*
   calling `locals.auth()`, the seat list, the GM's admit/decline, the
   claimable-while-vacant GM seat, and GM re-seating with private zones carried
   across (a test, not a hope). This app has never set a cookie outside Auth.js;
   budget accordingly.
9. `feat(shell)`: the bounded limits — per-table command ceiling as a column
   increment, seat cap, pending-join cap, and the read budget. On the last: D1
   bills per query, not per byte, so "just read the version column" is still one
   read per client per second and barely moves the number. The levers that work
   are **frequency and count** — adaptive cadence (quicker in Challenge, slower
   at rest), a pause on hidden tabs as `RollLog.svelte` already does, idle-table
   backoff, and returning only commands after the client's cursor.
10. `feat(shell)`: `table_commands`/`table_secrets`, the versioned command
   service (observed/expected version, request-hash idempotency), and the poll
   endpoint plus client sync loop behind the `TableTransport` seam.

   **The command stream is projected per seat, exactly as state is.** A poll
   returns *commands since your cursor*, so the sync channel is a second way out
   of the building, and a projection that only guards state guards the front door
   alone. A shuffle carrying a seed is the deck order in plaintext; a deal naming
   cards is every hand at once. So a shuffle reduces to a version bump with no
   payload, a deal emits one public fact ("seat 3 drew four") plus per-recipient
   rows in `table_secrets`, and every command type declares what each seat may
   see of it. Commit 6's leak tests extend to cover the wire, not just the store.
11. `feat(shell)`: the `GameModule.cardTable` slot, the mounted route at
    `/[game=game]/cards`, and the seat rail — showing each seat's durable card
    face-up, since the table is entitled to know who holds what.
    `docs/architecture.md` and `docs/adding-a-game.md` change **in this commit**:
    the ground rules require boundary docs to move with the boundary.
12. `design`: the design pass, **before any of the UI below is built** — the
    table surface, the card, the hand, the seat rail, the discard pane, the
    guided prompts. Run the `frontend-design` skill here, named so it happens:
    one considered design per surface rather than a component library's
    defaults, because the standing note is that defaults read as templated.

    The **facedown card** is the hardest surface here and the one to solve
    first: its owner must read both the value *and* that it is still hidden from
    everyone else, while every other seat sees only a card back and the public
    action label ("Riposte") the book requires. A number and suit glyph against
    the back is the obvious first idea and probably not the best one.

    Lands the **shared input primitive** in the same commit, since it governs
    every surface below and retrofitting it later would rewrite them: **both
    drag and click-to-select-then-place**, either one sufficient for every
    action. Click-to-place is what makes touch and keyboard work; drag is what
    makes it feel like a card table. Real touch targets. **No action reachable
    only by right-click**, and where a context menu exists, `ctrl`-click on
    macOS must register as one.
13. `feat(hmtw)`: Decks mode — flip, zoom, reshuffle, Fool prompt, and the
    discard pane as a *source*: a card moves from it into any seat's durable
    slot, which is how a High Chant reaches the table. Spending is the reverse
    trip, back to the discard.

    **Milestone — ship this.** A shared deck two people can flip for Tests of
    Fate is most of what a Crawl session needs, and it is independently useful
    without a single Challenge feature. The sequencing rule asks for a
    phase-boundary every 5–10 commits; this is the natural one, and it puts the
    thing in front of a real table halfway through rather than at the end.
14. `feat(hmtw)`: Challenge mode, free play — hands **sorted by value**, the
    GM's **grouped by doom tier** (lesser dooms are majors 1–14, greater 15–21),
    which is a value threshold and also makes the mulligan judgement — "mostly
    greater dooms" — readable at a glance. Initiative placement, played and
    facedown slots, the GM's hand-size checklist and mulligan, Sweep, callout strip, the
    Fool-was-dealt reshuffle before the next deal, and the confirmed
    dump-to-discard on leaving, sparing the durable slots.
15. `feat(hmtw)`: guided mode, **toggleable per table** — start-of-round
    confirmation once every initiative is placed, the count-up, the ping for
    whoever is next, the minor-action prompt with a pass, and the simultaneous
    reveal. A pointer and a set of shortcuts over the same free table: it
    advances a highlight and never gates a command.
16. `feat(hmtw)`: action menus, **bidirectional and non-binding**. Pick a card
    and the actions it pays for are highlighted; pick an action and the cards
    that pay for it are highlighted. Highlighted, *not* filtered — everything
    stays selectable, because a menu that only lists legal choices is
    enforcement wearing a quieter coat, and the GM rules on things the book
    never anticipated. So there is always a **"something else"** entry with a
    free-text line for whatever was just ruled at the table.

    What highlights depends on who is playing. A player's minor action must be
    paid with a **matching suit** (Ch7), and their main action likewise reads
    from the suit. The GM reads from **doom tier** instead: a lesser doom pays
    for any Challenge Action; a greater doom pays for greater doom abilities,
    for any miscellaneous action except Vigilance, or can be discarded for
    favour. The suit exemption applies to the GM's *minor* actions specifically,
    because majors have no suits — it is not a blanket exemption, which an
    earlier draft implied.
17. `feat(hmtw)`: undo and free handling — any card on the table moved or
    flipped by any seat, no legality check; hands stay owner-only. Includes the
    one rejection this design has: `expected_version` means whoever loses a
    simultaneous grab is refused, and open reach makes that *likely*, since "two
    people flip the AFK player's card" is both the motivating case and the
    collision case. It must read as "someone got there first" and re-sync
    silently, never as an error.
18. `feat(shell)`: lazy expiry on read, plus the bounded opportunistic sweep.
19. `test(e2e)`: Playwright multi-context — two seats through a full round, with
    hidden information asserted hidden at every step. `e2e/campaigns.spec.ts`
    already has the multi-context pattern to follow.
20. `design`: the coherence and accessibility pass — the whole table seen at
    once, after the scope creep that will certainly have happened by here, plus
    a WCAG 2.1 AA audit via the `design:accessibility-review` skill. Live
    updates, hidden information, and card manipulation together are a hard
    accessibility surface; guild-book had to make its cards announce themselves
    to screen readers, and it will not be free here either.
21. `design(hmtw)`: **fold the GM's round setup behind a disclosure.** The
    checklist, the two hand-size fields, Deal and Mulligan are a once-a-round
    decision occupying the permanent first screen; on a phone a GM scrolls some
    1,700px of it before one card is visible, every round, forever. They collapse
    into a single control that reads as the action it leads to — "Deal the
    round…" — which opens the checklist, carries the suggested number, and
    closes on dealing.

    **The Mulligan does not go in.** It is judged *after* the deal — "discard the
    hand and draw again when it is mostly greater dooms" is a decision you can
    only make holding the hand — so a disclosure that closes on dealing would
    hide it at exactly the moment it is wanted. It belongs beside the GM's hand,
    where the greater-doom grouping that answers the question already is.

    Two constraints. The disclosure's **open state is local**, never a table
    command: it is one GM's view of their own controls, and putting it in the
    shared blob would open a panel on every screen at the table. And it **opens
    by itself when `round.number === 0`** and at no other time, because a
    collapsed control on a table that has never dealt is a dead end — the first
    thing a new GM must do would be behind a triangle. Deliberately not "when
    the GM's hand is empty", which was the first draft of this rule and is a bug:
    a GM who has played their last card mid-round would have the panel spring
    open over the table. Once dealt, opening it again is the GM's business.

    That rule also keeps both e2e specs working unchanged — a fresh table is at
    round 0, so "Deal the round" is present without anyone opening anything —
    which is a good sign the rule is the right one rather than a convenience.

    "Add an enemy" leaves the deal block in the same commit. It reads as a pair
    with Deal only because they were put side by side; it belongs with the
    combatants, which is where enemies are.

22. `design(hmtw)`: **the round state gets a type step, and the controls around
    it lose one.** `Round 1  Initiative —` is currently set in the smallest type
    on the page, and it is the single most-consulted fact in a Challenge — it is
    how a player knows their turn has come. It becomes the loudest thing in the
    strip; Guide, minor actions, Sweep and End quieten to match their frequency,
    and the `−`/`+` stepper binds to the count as one unit instead of floating
    among wordy buttons.

    This needs a **third type step**, which the table does not have: it has two
    sizes and boxes things when it wants emphasis, which is why every attempt at
    emphasis so far has been a border. Adding the step is the substance of the
    commit. It lands in `table.css` because that is where the other two live —
    not because a second consumer has been found for it, which it has not.

23. `design(hmtw)`: **three button tiers, and one destructive style.** Every
    button on the table is the same border, size and weight, so primary,
    secondary and destructive are indistinguishable — "Reset the table" reads
    exactly like "Deal the round", and on a phone it wraps onto its own row and
    becomes the *most* prominent control on screen. Monochrome has no accent to
    reach for, so the tiers are weight, fill and rule: a filled mark for the
    action a screen exists for, the present outline for ordinary controls, and
    rule-only for the quiet ones. Destructive takes the quiet tier, and takes
    its safety from **distance and confirmation** rather than from being hard to
    find: it stays at the far end of the bar, away from the control a thumb is
    aiming for, and it already asks before it acts. Stating that as "make it the
    quietest" would be the wrong lesson — a destructive control nobody can find
    is its own failure, and one that merely looks like every other quiet control
    is the misclick this is meant to prevent.

    Scope note: this touches every `<button>` on the table, so it is a commit on
    its own rather than a rider. The classes live in `table.css`; the components
    only choose a tier.

24. `design(hmtw)`: **one seat *identity*, in both modes — not one layout.**
    Decks mode has a left seat rail; the Challenge turns the same people into
    horizontal sections, and the reader pays for the switch every time the mode
    changes.

    The obvious fix — adopt the rail everywhere — was checked against the
    measurements and does not survive them. The rail is `min-inline-size: 12rem`
    (192px) and a card is `--ct-card-w: 4.25rem` (68px), so a rail holds about
    two cards abreast. A Challenge seat carries an initiative card, a facedown
    slot and a played row that grows without limit; four played cards do not fit
    and never will. The layouts differ because the *content* differs, and that
    is legitimate: one mode is a lobby, the other is a fight.

    So what unifies is the **seat block** — name, GM tag, "you", hand count,
    inspiration — which currently exists twice, drawn differently, from two sets
    of rules. It becomes one component used by both, and the seats then read as
    the same people whichever mode the table is in, while the space around them
    is free to be what each mode needs. Smaller than the commit this replaces,
    and it fixes the thing the critique actually noticed.

    Deliberately after 21–23: the type scale from 22 is what sizes the block.

25. `design(hmtw)`: **the room reaches the edges, and the dead track closes.**
    The table is a grey rectangle with white margins inside the app shell, and
    scrolling detaches the room from the header — it reads as an embedded
    widget rather than a place. The ground runs to the viewport instead. In the
    same pass the combatants grid loses the ~180px of empty track under two
    seats: the fixed tracks were the right instinct against layout jumping and
    too generous in execution, and the fix is to size the track to a seat's
    contents rather than to its worst case.

    Two smaller findings ride here, both from the same critique and both too
    small to carry a commit: the Actions catalogue drops a weight, so a
    twenty-one-item reference stops competing with the cards it is a reference
    *for*; and the number and name fields get one scale between them, instead of
    "Imps" being twice the width of "4" for no reason but the text inside it.

    Ordered last because it is the only one of these that is purely
    presentational, and because the four before it all change how tall the page
    is. Decks mode's unused width is **not** in scope: it is two decks and two
    discards, and spreading four piles across a widescreen to fill it would be
    decoration. It is left as it is, on purpose.

26. `docs`: `/privacy` gains its guest-data section (the page's own header
    demands it whenever a migration stores personal data — so this rides with
    commit 7's schema if it can, and no later than here); CREDITS (Crawlspace as
    prior art, guild-book for the two patterns); CHANGELOG; pack docs; and the
    art basis in LICENSE.md.
27. `docs`: close phase 29 — move this section to [[App Implementation History]]
    verbatim, per the housekeeping rule, in the commit that closes it.

**Guards that apply to all of 21–25.** Every one of them is a change to the same
surface the accessibility spec covers, so `card-table-a11y.spec.ts` is the floor:
eleven states, two rooms, no new violations. Contrast is *computed* rather than
eyeballed, because a monochrome palette is always one measurement from failing
1.4.3 and the failure is invisible to whoever made it. New controls keep the
44px target and the accessible names the audit relies on — the count stepper's
"Back one" / "On one" are load-bearing, since the e2e finds that button by name.
And `card-table.spec.ts` must keep passing without its locators being loosened
to accommodate a redesign: if a selector has to change, the change is described
in the commit message, because a test quietly bent to fit is how a regression
ships.

What none of that guards is the thing this batch is actually for. There is no
test for "the loudest element is the right one", and there will not be; the
hierarchy was inverted for twenty commits with every check passing. The guard
against it happening again is that somebody looks at the finished screens, at
the widths people really use, which is what produced this list. Say so rather
than implying the specs cover it.

Twenty-six commits, with a shippable milestone at 12. Up from fifteen, and this
time **scope genuinely was added**:
opponents and the round procedure were missing rather than deferred, guided mode
is new, and design, input, and accessibility went from absent to three commits —
and then to eight, when a critique of the finished surface found the hierarchy
inverted: setup loud, state quiet, and every button the same weight. That the
five design commits were added *after* the thing worked is the shape of the
lesson, not a failure of the estimate.
Treat it as a floor. For calibration, Origins 5.5e was 6 commits and 10,091
lines *with no shell change*; this has a shell slot, a new identity mechanism in
a codebase that has never set a cookie of its own, and a game procedure to model.

### Art — decided, then decided again

**Shipped: the 1911 black-and-white plates.** Pamela Colman Smith's
seventy-eight designs as printed in Part II of A. E. Waite's _The Pictorial Key
to the Tarot_ (William Rider & Son, 1911), which Wikimedia Commons holds as
individual files, complete, every one tagged public domain. Published 1911, so
PD in both jurisdictions this project cares about on publication date alone.
`tools/build_card_art.py` fetches them, re-checks every tag and fails if one is
not free, crops each plate at its own printed rule, and writes
`art/art-manifest.json` — the per-plate basis the pack's LICENSE.md points at.

**This replaces the earlier decision, which was the colour set** (Commons'
1909 Roses & Lilies edition, PD-old-80-expired plus PD-US). That decision was
made on licensing grounds alone, before there was a table to put the cards on,
and it does not survive contact with the one that got built:

- **The surface is monochrome on purpose.** The book is black ink on white
  paper and the table's dark mode is a straight inversion, the cards keeping
  their ink while the room flips. Twenty-two colour rectangles would be the only
  colour on it — and would spend the one signal it reserves, the book's red for
  greater dooms, on decoration.
- **Line art survives the size; a scan does not.** A card is 68px wide. Flat ink
  loses detail and keeps silhouette; a photographic colour scan loses the colour
  it was chosen for first.
- **The licensing is cleaner, not merely equal.** One 1911 book, one date, and
  no need for the Bridgeman/THJ reasoning the Illustrator traces would have
  needed.

*Still deferred, and now the other way round: a colour option.* The collection
stays swappable — the pack declares where its plates live (`deck.json`'s `art`
block) and the app composes no paths of its own, so a second set is a directory
and a line of JSON.

*Not used, and why:* the steve-p.org scans (permission was confirmed on
2026-07-15, but to guild-book, and it does not travel); Chris's Illustrator SVG
traces (`~/Desktop/Tarot/Rider SVG SouthForkSVG` — almost certainly fine, since
faithful reproductions of public-domain works carry no new copyright per
Bridgeman v. Corel and THJ v Sheridan [2023] EWCA Civ 1354, but a colour-to-ink
trace is a step further from a scan than either case addresses, and "almost
certainly" is a worse footing than a Commons PD tag when the alternative is
free); and the archive.org "Pictorial Key" PDFs, which turned out to be modern
colour reissues rather than the 1911 plates — checked, not assumed.

**The card that came out of it.** The plate fills the card above a band
carrying the **value and the suit** — the two things ch.7 actually asks of a
card, one for the total and one for which action it pays. Not the rank: on a
minor the rank is the value in Roman, and on a court card the picture says
"knight" better than the word does. No doom mark: the book has no symbol for
one, and inventing a glyph that only its author can read is worse than the red
numeral already there. The card grew from 68×114 to 68×124 — 1:1.82, near a
real tarot's 1:1.75 — because a picture plus a legible band lands near 1:1.9 at
any width, and showing the top 92% of the illustration buys the difference back
out of the blank margin inside the plate's rule.

### Why build it, given guild-book has one

*The last open question, settled 2026-09-06.*

Because **nothing playable is actually available**. Crawlspace is live and
good, but it is closed source and there is no way to self-host it. guild-book's
table is open source and excellent, but it has never gone live, may never, and
is welded to campaigns, characters, and tenures — a Splatbook player cannot use
it. So "two tables, one maintainer" overstates the duplication: there is one
deployed table in the world, and running your own is not among the options it
offers.

That is also the reason the transport decision came out where it did. An open,
self-hostable card table for this game does not exist; the point of building one
is that other people can run it. A design that needed a Cloudflare-only
primitive would have thrown away the only justification the phase has.

And because it is a nice thing to build, which is a sufficient reason for a
project like this one and does not need dressing up as strategy.

**The legal footing, stated once so nothing drifts onto shakier ground.** This
is a clean-room build from the book's own text, under the book's own reuse
grant. That is the entire basis, it is enough on its own, and it holds
regardless of anything true or untrue about any other implementation's
copyright. No argument about the status of anyone else's code belongs in this
plan or in the work.

### Considered and rejected

- **Cloning Crawlspace.** No repo, no licence. Clean-room from the book only.
- **Porting guild-book's Challenge engine** — the first draft's whole premise.
  Rejected on review: it is an enforcing engine for a permissive product; it is
  welded to `tenureId` (239 references) and a campaign/adventurer/death model
  this design does not have; `modifiers.ts` cannot be cleanly dropped because the
  reducer and state shape reach into it; and a meaningful share of what would be
  ported (Dooms, death, equipment) is explicitly out of scope. The two patterns
  worth having survive as patterns.
- **Extending guild-book instead of building here.** Still a real option — see
  open question 2.
- **Durable Object + WebSocket push, with a second in-process adapter for
  `adapter-node`.** Chosen on the first pass, then reversed: the goal was
  self-hostability, and a Durable Object is the one primitive a self-hoster
  cannot run, while WebSockets add entrypoint, proxy, and single-process
  frictions that polling does not have. Recorded as an upgrade path with its
  Pages-migration cost priced, above.
- **Campaign-attached tables.** Would reuse invite tokens, roles, and the roll
  log almost for free, but forces campaigns onto a game that has none and puts
  an account between a player and their seat.
- **A generic "live shared surface" `GameModule` contract.** One consumer, no
  second in prospect. A concrete `cardTable` slot instead.
- **Full Crawlspace parity.** The gear model alone is a phase; the city/camp
  panels add UI for something a card flip already covers.
- **Save/restore to a file.** Nothing worth preserving once gear is out, and a
  client-side export of table state would leak the undrawn deck order.
- **Letting a seat take a card from another seat's hand.** Crawlspace allows it
  and asks the holder to hand it back. Rejected: the table needs the AFK case
  (flip the card of a player who has wandered off), and that is satisfied by
  reach over the *table* alone.
- **A scheduled retention sweep.** No good home for a cron, and it would make
  hosted expiry depend on atlas while giving self-hosters nothing.

## Phase 31 — HMtW card table: zones, creatures, and the rules at hand (built 2026-11-24)

*Filed 2026-11-24, from the Castle Automatic "State of the game" review
(`GM Notes/State of the Game — 2026-11-24.md` in the campaign vault) and the
Discord post that came out of it. The post made the group a promise, in Chris's
words: a card tool "more integrated than playingcards.io: it'll show the zones,
have a simple rules reference built in and keep track of whose turn it is", so
that a Challenge runs on Zoom plus the card tool, with Miro used less or not at
all. Whose turn it is was already done in phase 29. This phase is the other
two, and the reason it exists is that one tool replaces three.*

*It sits first in this file because it is the next work, ahead of the older
phases 21–27; the number follows filing order. It does not wait on phase 30,
which is the list of things a real game will settle. An adversarial review on
the day it was filed changed the design in several places. Those changes are
folded in below, and the decisions it raised are in "Decided".*

### What is wrong with the current tool stack

These are from the session notes (Sessions 10–13), not guesses. The phase-29
table already fixes most of the playingcards.io complaints: the Deal button is
shown only to the GM (the server does not enforce it), there are no ads, there
are no blank or duplicate cards, hands sort, values show as numbers and "Look
closer" zooms. What is left is everything they open
Miro for:

- **Where everybody is.** The battle maps and their zones (the chapel's Door,
  Nave, Niches and Altar; the Arena and the King's Pillar) live on Miro, which
  people lose track of and have to drag back into view.
- **How hurt the enemies are.** The King's Health and Defence were tallied on
  Miro, and in Session 12 the table's tally (8) disagreed with Chris's count
  (Health 2/4, Defence 5/10).
- **What an action does.** "Am I completely confused?" Rule recall is the
  second complaint in the review, and the summary sheet is on Miro too.
- **The end-of-round check**, which the book has and the table skipped, and
  which fights that drag for three sessions most need.

### Decided (Chris, 2026-11-24)

- **Build first, then play.** The review proposed running the group's next
  fight on the phase-29 table as it is, to test the deal, the count and the
  hands with real people before building on them. Chris chose to build first,
  so the group's first fight on the table has the zones and creatures. Live
  testing is therefore the two-browser fight after Milestone A (see "Guards").
  Edmund's Session 13 warning is the reason it is not optional: this is
  "really hard to do without live humans testing it".
- **Build it regardless of Guildbook.** Edmund is building a card table in
  Guildbook and Chris offered to help test it. This goes ahead anyway, and the
  group can try both.
- **Zones are a drop-down, not a map.** Every adventurer and every creature has
  a drop-down saying which zone it is in. The GM names the zones for the scene.
  The table shows who is where, as a short summary that is also the book's "as
  the new round begins, restate where every character is" (ch.7 step 5).
- **The picture is an upload.** The GM can upload one picture for the scene:
  a Miro drawing screenshotted, or one of the eight "Challenge Zone" images that
  come with the Castle Automatic digital art. That art cannot ship in Splatbook,
  because the book's art is not covered by its reuse grant, so the table holds
  only what a GM uploads to it.
- **No drawing tool.** See "Considered and rejected".
- **A group is one initiative.** A group of creatures plays one initiative card
  and acts together, as the mob rule says. Creatures in a group can stand in
  different zones without being split, because the zone belongs to the
  creature, not the group. Splitting is for when some of them start acting on
  their own, like the zombie the King raised in Session 13, which drew its own
  initiative.
- **Every creature tracks its own Health and Defence**, and has a letter:
  adding three zombies gives Zombie A, B and C, and adding more later carries on
  at D.
- **Players run only their own hands.** Nothing here lets one person play two
  seats. When Elric took over Eldritch in Session 11, he took over the *seat*.
  (Phase 30 already covers seats changing hands.)
- **Hovering over an action shows a summary of its rule**, with a link to the
  rule itself.

### The design, in the table's own terms

**Words.** The engine already uses `Zone` for a pile of cards, so the book's
zones need another name in code. Use **scene** and **`SceneZone`**, after the
book's own heading ("0. Set the scene … demarcates the scene's zones"). The
screen says "zone", because that is the word on the table. Nothing in code
calls a scene zone a `Zone`.

**The scene** is new table state:
`scene: { zones: SceneZone[]; at: Record<string, string | null> }`, with
`picture` added in its own schema bump when the picture arrives (commit 10).
`at` maps a seat id or creature id to a scene-zone id, or to nothing, which
means "not placed". Removing a seat, a group or a creature removes its `at`
entry in the same engine call, so the summary never lists someone who has gone.
The GM seat is not an adventurer and gets no drop-down. Removing a zone that
somebody is standing in asks first, because it unplaces them and re-adding the
zone does not put them back.

The scene survives leaving a Challenge, because the King fight ran for three
sessions with the guild going in and out of Challenge mode. It goes only when
the GM clears it ("New scene"), or on Reset table, which is already
the button for starting again.

**A creature** is a member of an opponent group:
`Creature { id; letter; down: boolean; pools: HdPool[] }`, where an `HdPool` is
`{ name?; health; healthMax; defence; defenceMax }`. Points about this shape:
- **Most creatures have one pool.** A dungeon lord has several, one per body
  part (Appendix C, on dungeon lords), so the shape allows that from the start.
  The interface to add a second pool can wait until a dungeon lord turns up.
- **The group's `count` is derived**: it is the creatures that are not down.
  The GM's draw checklist reads it ("+1 if the enemies outnumber the
  adventurers"). The draw is rechecked every round, so a count that falls as
  creatures go down is what the book asks for.
- **A creature that is down keeps its letter**, crossed out, so "Zombie B"
  never names two zombies in one fight. A split moves creatures *with* their
  letters, so Zombie C is still Zombie C in its new group.
- **A group of one shows no letter.** It is "the King", not "the King A".
- **Health and Defence are visible to the whole table and editable by anyone.**
  This follows the phase-29 principle that the table moves things and does not
  rule on them, and it lets a player catch a miscount, as the Session 12 tally
  would have.
- **An HD change says what it changes from.** "Zombie B, Health 3 → 2", not
  "−1". Two people applying the same hit at once is the commonest mistake an
  anyone-can-edit tracker invites, and a delta would apply it twice. Carrying
  the old value lets the second click fail as stale and go through the
  existing "somebody got there first" path, the same as two hands reaching for
  one card.
- **A group holds at most 52 creatures** (A to Z, then AA to ZZ). The command
  schema currently accepts a count up to 999, which as individual creatures
  would bloat every saved table and every poll. The migration caps an old
  group at 52 too. A larger swarm is a group whose HD is not tracked, with its
  number written in its name.
- **`update-opponent` loses its `count`.** The count is derived now, so
  creatures change through add, down and split, never by editing a number.
- **Split and merge are the GM's.** How the enemies divide is a GM decision,
  and the phase-29 undo only reverses card moves, so a split needs its own
  way back. `merge` puts a split-off group's creatures back into the group it
  came from, with their letters, and sends its initiative and played cards to
  the GM discard.
- **A group split off mid-round has no initiative card** until the GM plays
  one, as the raised zombie's came off the top of the deck in Session 13. The
  count passes over it until then. The guide says so, rather than leaving it
  silently skipped.

**The end-of-round check** goes in the guide: when the count has run out and
before the round ends, the table shows the book's own step 5 to everyone. Are
the enemies beaten enough to surrender? Is the guild in a bad position: does it
want to retreat? It links to "Retreating". It is a prompt to say aloud and
never a gate, like everything else the guide says.

**Action summaries** live in the content pack beside each action in
`challenge.json`: a `summary` of one or two sentences, and a `rule`, the
reference anchor of its heading in ch.7. The summaries are written by hand
against the book, not cut from its first paragraph. The book's reuse grant
covers its text, so quoting the key phrase is fine. Chris reads all
twenty-five before they ship, because they are game content. A pack test
checks two things for every action: that it has a summary, and that its
anchor resolves in the generated reference. Otherwise a reimport that renames a
heading would leave a dead link and nothing would notice.

The summary shows on hover and on keyboard focus. Tapping an action already
*chooses* it (`Actions.svelte` toggles `chosen` on click), so on a touch screen
a tap cannot also mean "explain". Instead, the menu has one fixed line beneath
it that shows the summary of whichever action is hovered, focused or chosen.
On an iPad, choosing an action is how you read its rule, and choosing it again
un-chooses it as it does now. It is wired with `aria-describedby`, so a screen
reader gets the same text. It must not cover the card being played.

Only the twenty-five core actions are covered. Talents and spells (Gramarye,
Chirurgeon) stay on the character sheet and on the cheat sheet Chris is making.

**The picture is stored in the database** (Chris, 2026-11-24): a
`card_table_pictures` table, one row per card table, with `ON DELETE CASCADE`
from `card_tables`.

*Changed in commit 10, after checking Cloudflare's own pages on 2026-11-24:*
D1's row limit is confirmed at 2,000,000 bytes, but D1 hands a BLOB back to a
Worker as an **array of numbers** (`Array.from` of the bytes), and the Workers
free plan allows **10 ms of CPU** a request. Turning a megabyte into a
million-element array and back could cost more than that. So the picture is
stored as a base64 `data:` URL in a **text** column instead. The browser does
the encoding; the server checks the shape, the size and the first twelve bytes,
and stores the string; serving it is passing the string through, and the
browser shows it as it is. The decoded cap is **1 MB** (about 1.37 MB as
text), and the browser steps the quality, then the size, down until a picture
fits.

- **Deletion comes free.** Every path that removes a table already removes its
  picture, which is the hardest part of the six-week promise.
- **It works the same everywhere.** The adapter-node SQLite that atlas staging
  runs behaves identically.
- **It needs nothing new from Cloudflare**: no new service, account change or
  payment method.
- **The cost**: pictures ride along in the scheduled D1 export. With pictures
  expiring after six weeks and a handful of tables, that is a few MB.

It sits behind one small store interface, with an in-memory version for tests,
so moving to R2 later stays possible (see "Considered and rejected").

The upload rules:
- **The GM seat uploads.** The GM seat may be a guest, so this is checked
  against the seat, not an account, just as `reset-table` checks it today.
- **Formats and size.** PNG, JPEG or WebP only, checked by magic bytes and not
  only by the declared type. The browser scales the image to at most 2,560
  pixels on the long edge and re-encodes it as WebP before upload. That keeps
  uploads small and strips camera metadata, which matters because a Worker
  cannot re-encode cheaply. Safari has not historically encoded WebP from a
  canvas, and asking for it quietly returns a PNG, so the client checks the
  blob type it actually got and falls back to JPEG at quality 0.85. The server
  refuses anything over 1 MB decoded (see above).
- **One picture per scene.** Replacing it deletes the old one. Fights are
  set up one at a time, and one picture keeps the storage story simple.
- **Who can see it: anyone holding the table's link**, the same as the table.
  It is served through `/api/card-tables/[token]/picture?id=…` as the text it
  was stored as, with `Cache-Control: no-store` and `nosniff`; the browser
  shows the `data:` URL directly.
  The table state holds a content hash, so clients fetch it again only when it
  changes and the polling loop stays cheap.
- **It goes with the table.** The six-week promise covers pictures, or it is
  not true. Table expiry and deletion are covered by the cascade, and Reset
  table and New scene delete the picture row themselves. A test for each path
  checks that the row is gone, including that the cascade really fires on D1
  as well as on local SQLite.

### Commits

1. `feat(hmtw)`: the scene in the engine, at schema v10: scene zones, `at`,
   `setSceneZones`, `place` and `clearScene`. Renaming a zone keeps its id, and
   removing one leaves whoever was in it unplaced. `removeSeat` and
   `removeOpponent` drop their `at` entries. Migration v9 → v10 with a fixture
   test. Reset table clears the scene.
2. `feat(hmtw)`: creatures, at schema v11: groups gain members with letters,
   pools and `down`, and `count` becomes derived. Migration v10 → v11 turns a
   group of *n* into creatures A to *n* (capped at 52) with no HD tracked (HD is
   optional, and a creature without it shows no tracker). Fixture tests for a
   v10 blob with a group of six and one with a group of 999.
3. `feat(hmtw)`: `addCreatures`, which carries on lettering after Z with AA,
   never reuses a letter and stops at 52; `setHd` for a pool, which takes the
   value it expects to replace and fails as stale when that has changed; and
   `setDown`. `splitOpponent` moves chosen creatures, not a count, into a new
   group with empty slots, and `mergeOpponent` reverses it. The engine's
   existing test keeps its unwolves.
4. `feat(hmtw)`: the commands for 1–3 in `card-table.ts`. `set-scene-zones`,
   `clear-scene`, `split` and `merge` are the GM's, refused with `gm-only` as
   `reset-table` is. Placing, HD and down are anyone's, like moving a card.
   `update-opponent` loses `count`. Events carry names and zones, never cards,
   under the public-log contract. The announcer says the ones worth hearing
   ("Tatyana moves to the Arena", "Zombie B is down") and folds a run of HD
   changes into one line instead of reading out every click.
5. `feat(hmtw)`: the scene panel. The GM types the zone names. Every
   adventurer's seat and every creature gets a drop-down. The who-is-where
   summary leads the panel.
6. `feat(hmtw)`: creatures on screen. "Add" takes a name, how many, and Health
   and Defence once for the type. Each group shows as one line (name, how many
   are up, where they are) and opens to edit. Eight skeletons with a
   drop-down and four steppers each would otherwise bury the round under
   bookkeeping, which is the inversion phase 29 spent a batch of design
   commits undoing. Inside, each creature gets steppers in the style of the
   count's ("Back one" / "On one" patterns, 44 px targets, names the audit can
   find), with "Down" and "Add more". The GM gets split and merge, picking
   creatures by letter.
7. `feat(hmtw)`: the end-of-round check in the guide, with its text and the
   "Retreating" link in the pack.
   **Milestone A: deploy.** Zones, creatures and the end-of-round check are
   the parts the next fight most needs, and none of them needs new
   infrastructure.
8. `content(hmtw)`: `summary` and `rule` for all twenty-five actions, with
   SCHEMA.md updated (this closes its "Not here yet: rule links"), and the pack
   test for both. Chris reads the summaries before this lands.
9. `feat(hmtw)`: the summary line under the action menus, filled on hover,
   focus or choosing an action, with "Read the rule" opening the reference at
   the heading in a new tab, so the table keeps its place.
   **Milestone B: deploy.**
10. `feat(shell)`: the `card_table_pictures` table and its Drizzle migration;
    the picture store (D1/SQLite, plus an in-memory one for tests); `picture`
    in the scene at schema v12 with its migration; the upload and serving
    endpoints with the checks above; and Reset table and New scene deleting
    the row. Tests cover each deletion path, because a missed one breaks the
    six-week promise without anyone noticing.
11. `feat(hmtw)`: the picture on the table: upload, replace and remove for the
    GM, and the picture above the zone summary with a "Look closer" view. The
    privacy policy (what is stored, who sees it, when it goes) and the terms
    (upload only what you have the right to show your table) change **in this
    commit**, not after it, because the feature is not allowed to be live ahead
    of the policy that describes it.
12. `docs(cloudflare)`: the deploy note for the new table: a production D1
    backup first (as `prod-pre-phase29` was), then `wrangler d1 migrations
    apply`, then the deploy.
    **Milestone C: deploy.**
13. `feat(hmtw)`: a creature's name links to its stat block in Appendix C when
    the name matches a denizen heading in the generated reference, and to
    nothing when it does not. There is no guessing, and stat blocks are not
    data: the GM still types Health and Defence. Lowest value in the phase:
    the reference carries only the core book, so the zombies and skeletons
    link, but the Castle Automatic's own enemies (the King of Swords and his
    court) never will. Drop it if the phase runs long.
14. `docs`: close phase 31: CHANGELOG, the a11y spec's new states, and this
    section moved to the history file verbatim.

**Guards for 5, 6, 9 and 11**, the same as phase 29's: `card-table-a11y.spec.ts`
stays the floor and grows a state for each new panel. Contrast is computed,
not judged by eye. `card-table.spec.ts` is not loosened to fit, and any
locator that has to change is explained in its commit message. After Milestone
A, Chris runs a fight with two browsers before the group meets it. The specs
do not test whether the zone summary is the thing you read first, and that is
what makes or breaks this phase.

### Considered and rejected

**A drawing tool.** The two obvious kits are Excalidraw and tldraw. Both are
React, inside a Svelte app. tldraw's licence for a live site would need
checking. Neither makes *shared* drawing possible on its own: strokes need a
way of reaching every browser live, and this table polls every few seconds,
which suits cards and does not suit a pen. Drawing on Miro, screenshotting and
uploading gets the same picture for none of that.

**Tokens dragged on the picture.** That is a virtual tabletop, and the
drop-down already holds the same fact, accessibly and in a form the announcer
can read out. The picture is for looking at, and the drop-downs are the record.

**Splitting a group to place it in two zones.** It would give each part its own
initiative slot and cost the GM a card per zone, which the mob rule does not
ask for. Position belongs to the creature, so splitting is only for creatures
that start acting apart.

**The mob count, shown beside each adventurer** (rejected by Chris,
2026-11-24). The idea was to count a group's creatures that are up and in an
adventurer's zone, and show what the mob rule would give ("zombies 4 here:
favour, Piercing"). The thresholds are 2+ favour, 4+ Piercing and 8+
Critical. But "in the zone" is not "fighting the same adventurer", and
engagement is not tracked, so the hint would sometimes say favour where the
book gives none. Counting across groups would be worse: it would give the King
and his one zombie favour. The GM knows the thresholds. A hint that is wrong
part of the time costs more than it saves.

**R2 for the picture** (rejected by Chris, 2026-11-24, in favour of the
database). It is the conventional home for files, but D1's cascade cannot reach
it. Expiry, the sweep and table deletion would each have to remember to delete
the object, and orphans from half-failed deletes would need a sweep of their
own. Cloudflare may also want a payment method on the account before R2 can be
switched on. Revisit only if pictures outgrow the database: several per table,
or much larger.

**A house-rule line for drawing one card fewer with three players** (from the
Discord post). The GM's draw already suggests a number that the GM can
overrule, and that overrule is the house rule.

### Not in this phase, for playing to decide

- **Engaged or disengaged.** Ch.7 tracks it, and moving while engaged costs a
  Wound per engaged opponent unless they let you pass. A tick beside the zone
  drop-down would be cheap. Add it if the group keeps losing track of it, not
  because the book has it.
- **Several pictures per table**, queued for a delve with several set-piece
  rooms. One at a time is enough until uploading mid-session proves slow.
- **The cheat sheet's content inside the table.** Wait for Chris's Challenge
  Phase cheat sheet to exist first, then see what in it the summaries do not
  already cover.

*Closed 2026-11-25 by phase 32's commit 1. Commits 1–12 shipped in three
releases and were deployed on 2026-11-24. Commit 13 (stat-block links) was not
built and moved to phase 32's "Not in this phase". Commit 14's a11y states are
the zone editor and the scene with creatures, in `card-table-a11y.spec.ts`. The
first live test with players followed on 2026-11-25; what it found is phase
32.*


## Phase 32 — HMtW card table: one turn at a time (built 2026-11-25)

*Filed 2026-11-25, from the first live test: Chris as GM and three players on
splatbook.app, worked down the checklist in
`GM Notes/Card Table Test — 2026-11-25.md` in the campaign vault, with his
notes under each step. Zones, the picture, creatures, Health, the action
summaries and the rule links all worked. What did not work is the round
itself: anybody could put any card anywhere, so nobody could tell what was
going on. In Chris's words: "I like the idea we could touch each others cards
but it makes it too hard to know what is going on."*

*An adversarial review on the day it was filed changed the design in several
places: conflicts, how an initiative card turns over, the Fool and readied
cards on other people's turns, who may run the round, and what hiding Health
really hides. Those changes are folded in below, and Chris's answers to the
questions it raised are in "Decided after the review".*

*It sits first because it is the next work. Phase 31 is complete apart from
its commit 13 (stat-block links, moved to "Not in this phase" below) and its
closing commit 14, which becomes this phase's commit 1.*

### What the test found

**Bugs:**
- **GM cards land in the Player discard.** Into the discard (Decks mode's
  turned-over cards) sends everything to the Player discard, even a GM card
  (`card-table.ts`, `clear-fate`). Sweep, End the round, leaving the Challenge
  and Reset all choose a discard by whose spot a card is in, not which deck it
  belongs to. `reshuffleDeck`'s stray rule then moves the cards to the right
  discard, which is why the shuffle looked like it fixed them.
- **Cards can vanish from the game** (found in review). `removeOpponent` and
  `removeSeat` delete zones that still hold cards (`table.ts`, and seats are
  removed through `syncSeats`).
- **"The Fool is out" shows to everyone.** `projectFor` made `round.foolDrawn`
  public so the table would know to reshuffle. `endRound` already reshuffles
  both decks by itself, so the notice only leaks that someone holds the Fool.
  Leaving the Challenge also clears `foolDrawn` without the reshuffle
  (`mode.ts`).
- **"…that is you" shows on every screen.** The guide's turn line is the same
  for everyone.
- **No prompt at End the round.** `roundIsDone` needs `round.settled` to equal
  the count, and `settled` is set only by **Close minor actions**. Any move of
  the count clears it. So pressing + past the last number never prompts, and
  neither does Sweep without closing minor actions first. Chris pressed Sweep
  and then End the round. An enemy initiative above 14 also holds the round
  open, and so did the stray card in round 2.
- **The discard piles can't be opened in the Challenge.** Decks mode has the
  pane (`openPileFrom`), the Challenge view does not.
- **Look closer is still small.**
- **Zombie B lost his letter under initiative** once he was split off.
- **The GM drew 7 where the book gives 6.** One type of zombie plus one other
  enemy is 2 types, not 3: 3 + 2 types + 1 for outnumbering three adventurers
  is 6. The "one card fewer with three players" Chris promised in the Discord
  post would make it 5, and it is nowhere in the tool (phase 31 rejected it as
  a line of its own, on the grounds that the GM would override; the test shows
  the override gets forgotten).
- **Players can shuffle a discard back in.** The button is the GM's, but the
  server does not check (`reshuffle` has no `gm-only`). Nor do the round and
  roster commands: deal, end the round, mulligan (a player can redraw the GM's
  hand), the count, minor actions, Sweep, and adding, renaming and removing
  enemies and creatures.

**Where the table was right and the notes are about clarity:**
- **"On your turn any card pays for any action"** is the book's rule (ch.7,
  Take turns: "On your turn, you can use *any* card to perform *any* action").
  Suits must match only for minor actions. The ask that stands is Chris's: the
  action list should be split by suit, with "any suit" as its own group, as
  well as lighting up the cards. The pack already holds that grouping
  (`bySuit`, `anySuit`, `free`, `gmOnly` in `challenge.json`);
  `Actions.svelte` flattens it.
- **Removing a zone warns on Save, not when you press Remove.** Chris asked
  "probably OK?" Yes: nothing changes until Save, and that is where the warning
  is. No change.

**The round doesn't read** (Chris's notes, in the order of the round):
- "In initiative phase you should click a card then click a button to confirm
  it as your initiative." In round 2 a card went into play instead.
- "Initiative should reveal on a player's turn. It also needs a reveal option to
  reveal it when you are attacked." (The book: flip it when the count reaches
  you, and "When other characters attempt to perform an action against you,
  flip your Initiative card face up".)
- "Counting to next initiative should be automatic unless there is some sort
  of issue."
- "You should only be able to place your own initiative and play a card in
  front of you."
- "Played cards should go to an area where we can see them properly like in the
  crawl phase", meaning Decks mode's turned-over cards, labelled with what they
  were for.
- "Minor actions could close automatically on everyone playing or passing", and
  "closing minor actions should reveal everyone's card and what they are
  doing". Today closing the window leaves every minor-action card face down
  and sideways.
- "I don't know why minor action cards are turned sideways, that should only be
  for cards you are keeping." The table conflates two things the book keeps
  apart. An ordinary minor action is put down, revealed with everyone else's,
  resolved and discarded (ch.7 step 4). A **facedown** action such as Dodge is
  set sideways and kept until it is used; the minor-action version of that sits
  below the initiative card (ch.7, Facedown cards).
- "Readying a facedown card for something like Dodge should prefill the
  description with what it is for."
- "Players should get their own messages."
- Moving other players' zones should be the GM's.

**Enemies:**
- Health is only visible inside each group's fold; it belongs in "Where
  everyone is".
- Chris is undecided whether players should see enemy Health at all, and
  suggested a switch: "Maybe if it's hidden only the GM can change health."
- "Splitting off enemies does work, but in the game they shouldn't get an
  initiative slot. All members of a group use the same initiative and when they
  play a card use the same card, even if they are in different zones." (The
  book: "Groups of the same enemy share an Initiative card.")

**Not tested:** the phone, deferred by Chris to this phase.

### Decided (Chris, 2026-11-25, in the test notes)

- **You touch your own cards; the GM runs the table.** Phase 29's "any card on
  the table may be moved by any seat" goes. This is about whose cards are
  whose, not about rules: the table still never checks a value or a suit.
- **The round runs as steps**: initiative confirmed with a button, the count
  moving itself, a labelled play area everyone can read, and minor actions
  that are declared or passed by everyone and then revealed together.
- **Sideways means kept.** Only readied facedown actions are set sideways.
- **A group of enemies is one initiative and one card**, wherever its
  creatures stand.
- **Messages are personal.** Only the acting player is told it's them.
- **The phone check** is part of this phase.

### Decided after the review (Chris, 2026-11-25)

- **The three-player house rule goes in the draw checklist**: "One fewer with
  three adventurers", ticked by itself at exactly three, labelled as a house
  rule. It was promised in the Discord post, and the test shows the override
  gets forgotten. This reverses phase 31's rejection.
- **Hands stayed private in the test.** "Each player sees only their own hand"
  was checked and fine, only left unticked.
- **Enemy Health: a GM switch, shown by default** (today's behaviour). When
  shown, anyone may change it, as now; when hidden, players see none of it and
  only the GM changes it. Down stays visible either way, because a creature
  that falls is something everyone sees.
- **Split is removed.** Each creature already has its own zone and Health, and
  a group shares one initiative. A creature that starts acting on its own, like
  Session 13's raised zombie, is added as a new enemy.

**Taken as recommended unless Chris says otherwise:**
- **Shuffling a discard back in is the GM's.** The usual argument against is a
  Test of Fate from an empty deck failing, which today it does (`moves.ts`,
  `empty`); commit 6 makes an empty deck reshuffle its discard by itself, as
  dealing already does, so that argument goes.
- **Ties.** The book's tied characters "act at the same time". Every tied
  character takes their turn, then minor actions open once for the number.
  Players at the same number choose who goes first; the GM decides between a
  GM character and an adventurer.

### The design, in the table's own terms

**Every card goes to its own deck's discard.** One engine helper,
`discardAll(table, fromZone)`, sends each card to `discardZone(deckOf[card])`.
Every sweep uses it: Sweep, End the round, leaving the Challenge, Reset,
Into the discard, clearing a facedown card, the mulligan, removing an enemy
group, removing a seat, and the new end-of-number tidy-up.
`reshuffleDeck`'s stray rule stays as the safety net for a card a person drops
on the wrong discard by hand. An invariants test runs every command against a
table with both decks in play and checks two things afterwards: every card
still exists exactly once, and no discard holds the other deck's card.

**Who may do what.** Every command is listed with who may send it; anything
not listed is refused as `not-yours` and not offered on screen. With nobody in
the GM seat, everyone may do what the GM may, the rule `reset-table` already
follows. **Hands stay owner-only for everyone, the GM included** (as
`canTakeFrom` and `undo.ts` already insist), because a hand is the one place
the table is secret from the GM too.

| Command or zone | Who |
|---|---|
| Your hand | you only |
| Your initiative, played, facedown and minor cards | you, and the GM |
| Giving a card into someone's inspiration slot | anyone (the High Chant: "Distribute the cards to other players"); taking one out is that seat's and the GM's |
| An enemy group's zones, its initiative and its cards | the GM |
| The table's `play` area | nobody directly: cards arrive and leave through the step commands; the GM can move them |
| Decks and discards: draw, turn over, pick from a discard | anyone (a Test of Fate is a player's; the High Chant picks from the discard) |
| Shuffle a discard back in, Reset, mode, guided | the GM |
| Deal, mulligan, end the round, the count, minor-action overrides, Sweep | the GM |
| Add, rename and remove enemies and creatures; split and merge while they last | the GM |
| Scene zones and picture | the GM (as now) |
| Where an adventurer stands | that adventurer, and the GM |
| Where a creature stands | the GM |
| Enemy Health | the GM; anyone too while Health is shown |
| Down / Back up | the GM; anyone too while Health is shown |

**The round as steps.** `round.step` is one of `deal`, `initiative`, `count`,
`turn`, `minor`, `resolve`, `over`. Step commands are refused as `wrong-step`
when they arrive in the wrong step, from a page a poll behind or straight at
the API. That is a check on the table's own state, not a rules check: the GM
can always move the step on. Free card moves stay, under the table above, for
the GM's fixes, Tests of Fate and discarding for a Favour.

**Automatic steps happen inside the command that completes them**: the last
initiative card starts the count, the last answer to minor actions turns the
cards over. There are no timers.

**Conflicts retry by themselves.** Today a refused command is dropped: the page
catches up and says "Someone got there first", and the person has to press
again (`cards/[token]/+page.svelte`, `run`). With four people pressing Play as
initiative or Pass at the same moment, most presses would bounce. Step
commands whose result doesn't depend on order (your initiative, your
minor-action answer, Show my initiative) re-send on a conflict with the fresh
version, up to three times, before saying anything. Card moves keep today's
behaviour, because two hands reaching for one card is a real conflict.

1. **Deal.** As now, with the draw checklist filling itself in (below).
2. **Initiative.** You pick a card and press **Play as initiative**. A card can
   no longer be dropped onto the slot. The GM gets one button per enemy group
   ("Initiative for the Zombies"). A group with every creature down needs none.
   When every adventurer holding cards and every group with a creature up has
   one, the count starts. The GM can **Start the count** without waiting, for a
   player who has gone quiet.
3. **Count.** The count jumps to the lowest initiative held by anyone who has
   **not yet acted this round** (`round.acted` is per round, not per number,
   so Guard's new initiative can't give anyone a second turn). The server knows
   the values, and a GM counting aloud tells the table the same thing, that
   nobody is at 4, 5 or 6. Initiative cards at that number turn face up for
   everyone, which is the book's "flip your Initiative card face up to declare
   that you are the acting player".
   - **How a card turns face up.** Visibility belongs to a zone and the count
     reads initiative from the slot, so the card can't move out. Instead
     `round.shown` lists the holders whose initiative is face up;
     `projectZone` shows those slots to everyone; End the round clears it.
   - **A tie** lists everyone at the number with the book's tie rule. Each of
     them takes their turn, then minor actions open once.
   - **No cards in hand** at your number: your turn is skipped by itself, and
     nobody takes minor actions (ch.7, Skipping your turn).
4. **Turn.** Only the acting player (or the GM, for a group) gets the turn
   panel. Everyone else sees whose turn it is. The panel has:
   - the actions grouped by suit, with Miscellaneous ("any suit") and free
     actions as their own groups and the line "On your turn any card pays for
     any action";
   - who it is aimed at, optional. Naming someone turns their initiative card
     face up, since an action against them is when the book flips it.
     **Show my initiative** is there for everyone at any time, for when a
     target was not named;
   - **Play it**: the card goes face up into the play area. Guard puts it on
     your initiative instead, face down, and discards the old one;
   - **Add a card**, for plays of more than one card: the GM's greater doom
     with the lesser doom it rides on, a greater doom discarded for favour;
   - **Ready it**, for actions the book plays facedown (Riposte, Dodge, Aid
     Another, Vigilance): the card goes sideways above your initiative,
     labelled with the action already filled in;
   - **Skip my turn**: the book says nobody takes minor actions then, so the
     count moves on.

   The GM's overrides include **Skip their turn**, for an acting player who has
   gone quiet.
5. **Out of turn**, at any point before Resolve, on anyone's turn:
   - **The Fool**: its holder gets **Play the Fool** (with a partner card).
     The book: it "counts as an interrupt action. The Fool always goes first".
     It takes a turn before the acting one, opens no minor actions, and the
     holder keeps their own turn. This replaces `round.interrupt` and
     `round.extraTurn` for the Fool; a talent's interrupt uses the same
     control, labelled by the player.
   - **A readied card**: its holder gets **Use it**. The card turns face up and
     comes into the play area labelled with what it was readied for. Riposte
     and Dodge trigger on an attack, Aid Another and Vigilance on another
     character's action, so they are used on other people's turns by design.
6. **Minor actions** open by themselves once every turn at the number is
   played. Everybody who did not just act sees **Any minor actions?** with
   three answers:
   - **Put one down**: choose the action and a card. The label is public, as
     the book has everyone declare. The card sits face down in your own
     `minor` slot. Players' cards of the wrong suit are dimmed, not refused;
     the GM's are never dimmed (majors have no suit). Vigilance takes the suit
     of the action it waits for.
   - **Ready one**: sideways, below your initiative, and kept.
   - **Pass.**

   The GM answers for each group that did not just act: "Each enemy or enemy
   group can make one minor action on another character's turn". The strip
   shows who is still deciding. The last answer turns every minor card face up
   together, into the play area. The GM can **Turn them over now** for someone
   who has gone quiet.
7. **Resolve.** Everyone reads the play area. The GM applies the hits (Health,
   Down) and presses **Next**. The number's cards go to their own discards and
   the count moves on. This replaces Sweep.
8. **Over.** The end-of-round check shows (surrender, retreat) with **End the
   round**, then the deal panel for the next one.

**The play area** is the turned-over-cards row from Decks mode, under the
count: each card with who played it, the action, the target, and "turn" or
"minor". It is drawn from the zones that already exist: every seat's and
group's `played` zone (which `revealFacedown` already uses) plus the revealed
minor cards, shown together. Labels are keyed by zone and position, as
`facedown` is today (`table.ts`), **never by card id**: card ids are the
cards' identities (`swords-ii`), so a label keyed by one would name a face-down
card to everyone.

**Undo** covers the new commands in a narrow window: a played card until
anyone answers minor actions; your own initiative until the count starts.
Never past an automatic reveal, because by then other people have seen the
card.

**Messages.** The guide line and the announcer speak to the viewer: "Your turn:
play a card or skip" for the acting player and "Ash's turn" for everyone else.
"You hold the Fool" goes only to its holder. When the Fool was drawn, End the
round says that both decks were shuffled. Commit 4 makes the guide and the
announcer take the viewer; Release C rewrites what they say but keeps that.

**Enemies.**
- **No split.** The migration merges any split-off group
  back into its family, as `mergeOpponent` does now.
- **Health in "Where everyone is"**: "Zombie B 4/6" beside each creature, for
  everyone while Health is shown and for the GM always.
- **Hiding Health hides it from then on.** While Health is hidden, the
  projection strips the pools from players' views, and new `set-hd` events
  carry the creature but no numbers, because events are the public log.
  Events written while Health was shown keep their numbers: what the table
  already saw, it saw. The announcer is given the viewer and the projected
  state (today `describe(event, nameOf)` has neither), so the GM still hears
  "Zombie B: Health 2 of 6". Down stays visible.

**The GM's draw fills itself in.** "Each type of enemy" counts families with a
creature up. "Outnumber" and "twice as many" compare creatures up with
adventurers seated, using "twice as many" as two or more times. Larger than a
human, elite and dungeon lord stay manual, because the table can't know them.
The pack gains a house-rule modifier, "One fewer with
three adventurers" (amount −1, ticked by itself at exactly three), labelled as
a house rule. The GM can still untick anything and type their own number.

**State, at schema v13–v15** (one bump per commit that changes the shape, each
with its fixture migration):
- v13 `enemyHealth: 'shown' | 'hidden'`;
- v14 no split: groups merged;
- v15 `round.step`, `round.acted` (per round), `round.answered` (who has
  declared or passed a minor action at this number), `round.shown`, a `minor`
  zone per seat (`owner`) and per group (`gm`), and `plays` labels keyed by
  zone and position. `round.interrupt` and `round.extraTurn` go. **A table
  saved mid-round** opens at its current count in step `count`, and the GM
  steps in; there is no inferring the step from its cards. A fixture for each
  of initiative, mid-count and minor actions open checks that it opens and that
  no card is lost.

### Commits

**Release A: the fixes from the test.** Mostly server-side, so little of it is
thrown away by Release C.

1. `docs`: close phase 31 (its commit 14): CHANGELOG, the a11y spec's new
   states, and the phase 31 section moved to the history file verbatim, with
   its commit 13 noted as moved here.
2. `fix(hmtw)`: every card to its own deck's discard, and no card lost.
   Adds `discardAll` and uses it in every sweep, in `removeOpponent` and in
   `removeSeat`, with the invariants test. The cards Chris's test left on the
   wrong pile fix themselves at the next shuffle, as now.
3. `fix(hmtw)`: the Fool stays secret. `foolDrawn` leaves the projection. The
   holder's notice comes from their own hand. Decks mode's notice comes from the
   Fool lying face up. End the round says when the Fool's reshuffle happened,
   and leaving the Challenge does the reshuffle it now skips.
4. `fix(hmtw)`: personal messages. The guide and the announcer take the
   viewer and say "your turn" only to the acting seat, with tests from three
   viewers.
5. `feat(hmtw)`: the GM's draw fills itself in, and the three-player house
   rule in the pack. `SCHEMA.md` covers the house flag
   and negative amounts.
6. `fix(hmtw)`: the Challenge's discards open in the pane (extracted from
   `DecksMode.svelte` into a shared `PileViewer.svelte`). Look closer fills the
   screen. Drawing or turning over from an empty deck reshuffles its discard
   first, as dealing does.
7. `fix(hmtw)`: the missing end-of-round prompt, kept small because Release C
   replaces `roundIsDone`. Tests for the three ways it stays hidden (+ past
   the last number, Sweep without closing minor actions, an enemy above 14).
   Running past the last number settles the round, and the GM's guide line
   says what is holding it open ("Ash still has a card at 9").
   **Milestone A: deploy.**

**Release B: whose cards are whose, and the enemies**

8. `feat(hmtw)`: who may do what, enforced in the engine and the command
   reducer and refused as `not-yours`, with the table above as its tests
   (one case per row, from a player, from the GM and with nobody in the GM
   seat). The screen stops offering what you can't do. Tests that change, each
   explained in the commit message: `invariants.test.ts` (anyone may flip a
   wanderer's initiative; anyone may move an enemy's facedown card), and
   `card-table.spec.ts` wherever a player moves someone else's card.
9. `feat(hmtw)`: the enemy Health switch (v13), Health in "Where everyone
   is", events without numbers while it is hidden, and the announcer given the
   viewer and the state. A test checks that a player's projection and the new
   events hold no pool values while hidden.
10. `feat(hmtw)`: no split (v14). The split and merge commands and buttons go,
    and the migration merges groups back. The lost-letter bug goes with them.
    `card-table-scene.spec.ts` loses its split and rejoin steps and the
    `gm-after-split` screenshot.
    **Milestone B: deploy.**

**Release C: one turn at a time**

11. `feat(hmtw)`: the v15 shape and its migration, with the three mid-round
    fixtures, and `round.shown` honoured by the projection. Nothing on screen
    changes yet.
12. `feat(hmtw)`: initiative and the count in the engine: `playInitiative`,
    `startCount`, `nextNumber` (per-round `acted`, ties, the empty-hand skip)
    and `showInitiative`, with their commands, `wrong-step`, and the
    self-retry on conflict in the page's `run`, with a test where three seats
    answer at once.
13. `feat(hmtw)`: the turn, out-of-turn plays, minor actions and resolve in the
    engine: `playTurn` (play, add a card, ready, skip, Guard), `playFool`,
    `useReadied`, `declareMinor`, `passMinor`, the reveal, and `resolve`
    through `discardAll`. Their commands and the GM's overrides (Start the
    count, Skip their turn, Turn them over now, Next, Back one). Whole-round
    tests: a tie, a skip, the Fool interrupting the GM's turn, everyone
    passing, a readied Dodge used two rounds later, Guard. Undo within its
    window.
14. `content(hmtw)`: in `challenge.json`, a flag for the actions the book plays
    facedown (Riposte, Dodge, Aid Another, Vigilance) and for the one that
    replaces your initiative (Guard: "replace your Initiative with any card
    from your hand … Your old Initiative is discarded"). The suit groups are
    already there. Chris checks the list.
15. `feat(hmtw)`: initiative on screen: Play as initiative, the GM's
    per-group buttons, the card turning face up when its number comes, and
    Show my initiative.
16. `feat(hmtw)`: the turn panel, only for the acting seat: actions by suit,
    the target picker, Play it, Add a card, Ready it, Skip my turn. Play the
    Fool and Use it for everyone, on any turn.
17. `feat(hmtw)`: minor actions on screen: Put one down, Ready one, Pass, who
    is still deciding, and the cards turning over together.
18. `feat(hmtw)`: the play area, with Resolve and Next. Sweep and "Guide the
    round" go, because the steps are the guide now. The end-of-round check
    leads the `over` step. Specs that change: `card-table-a11y.spec.ts`
    (it presses "Guide the round") and `card-table.spec.ts` ("Play here",
    "Play facedown — your turn").
19. `test(e2e)`: a full round in four browser contexts (GM plus three
    players), covering initiative, the count jumping, a tie, a turn, the Fool,
    minor actions with one pass, one card put down and one readied, Resolve and
    End the round. It has an axe scan for every new state and a check that no
    player's page ever shows another player's hand or minor card before the
    reveal.
    **Milestone C: deploy, then a second live test** with a new checklist note
    in the campaign vault like the first.

**Release D: the phone**

20. `fix(hmtw)`: the phone pass at 390 px: hand, turn panel, minor actions,
    the play area and the scene, building on the 390 px no-sideways-scroll
    check `card-table-scene.spec.ts` already has. 44 px targets, checked by the
    specs and then by Chris on his phone.
21. `docs`: close phase 32.
    **Milestone D: deploy.**

### As built (2026-11-25)

All four releases were built the same day, each merged into `main` with lint,
unit and browser tests green (1,169 unit tests and 49 browser tests at the end
of Release C). Not yet pushed or deployed when this was written; no D1 migration
is needed, because every change is inside the table's JSON state.

- **Release A** went as planned (commits 1–7, plus the changelog). Commit 7
  became "the round is over once the count is past the highest card, settled
  or not", with a `stillToAct` list in the projection, which Release C then
  replaced.
- **Release B** went as planned. Commit 8's rule is `mayReach` on zone ids, so
  the screen and the server ask the same question; with nobody in the GM seat
  everyone runs the table, except for hands.
- **Release C** landed as two commits rather than nine: the pack flags
  (`content(hmtw)`), then the engine, commands, screens and tests together,
  because the old round fields could not leave the engine without the screens
  that read them going in the same commit. Differences from the design above:
  - There is no `count` step: the count is a value, and the steps are `deal`,
    `initiative`, `turn`, `minor`, `resolve` and `over`.
  - Played cards stay in each seat's and group's `played` zone; "In play" is a
    view over all of them (the review's simpler option). `plays` labels face-up
    cards by card id, which is safe only because they are face up; face-down
    minor actions are labelled by zone in `minorDeclared`.
  - When nothing is face up after minor actions (a readied card, everyone
    passing), the count moves straight on instead of waiting on the GM's Next.
  - The GM's overrides are one command, `step-on`, which does what the step is
    waiting for. There is no "Back one"; `take-back` covers the common case.
  - Retrying on a conflict covers every step command except `step-on`, since
    the server re-checks the round on each try.
  - The worked example in ch.7 plays through the new commands in
    `example-challenge.test.ts`; ties and the Fool are covered in
    `steps.test.ts`, and a tie came up by chance in the four-browser spec and
    read correctly.
- **Release D** found no sideways scrolling and no target under 44px at 390px.
  It found the page is about 2,700px long on a phone, so the guide line is
  pinned to the top and carries a "Your move" link on narrow screens.

**Still to do before closing this phase:** the second live test, with a
checklist note like the first, and the player instructions (Chris asked for
them, "better than assuming they know how it all works"). Close the phase once
that test has been worked through.

**Guards**, phase 31's carried forward: the a11y spec stays the floor and
grows a state for each new panel, and contrast is computed. The second live
test is not optional. The specs can't tell whether four people understand the
round, and that is what this phase is for.

### Considered and rejected

**Enforcing suits and values.** Dim the wrong-suit cards; never refuse them.
The GM can rule that a card counts, and an app that says no at the table is
the thing phase 29 set out not to be. Who may do what is about ownership, and
`wrong-step` is about the table's own state; neither is a rule of the game.

**Timers for the automatic steps.** A step happens when the last person
answers, inside that command. A timer would need a clock on the server, which
a polling table doesn't have, and would race the people at it.

**The GM reaching into hands.** "The GM touches everything" stops at hands.
A hand is the one zone secret from the GM, and with nobody in the GM seat
everyone is the GM, which would open every hand to every player.

**Moving an initiative card to turn it over.** It is how the engine flips
everything else, but the count reads initiative from the slot. `round.shown`
is one list and keeps the slot the single source.

**Keeping split, with a shared initiative.** Split existed to give part of a
group its own initiative. Zones and Health are already per creature, so a split
that shares the initiative does nothing.

**Dragging cards.** Click to choose, then a button, as now. It is what carries
the keyboard and screen-reader story, and Chris's "click a card then click a
button" is the same shape.

### Not in this phase

- **A creature's stat block link** (phase 31's commit 13). It is still the
  lowest-value item, and the Castle Automatic's own enemies never link.
- **Engaged or disengaged**, as phase 31 left it.
- **A player who wanders off** (phase 30). The GM's overrides in Release C
  cover the round without them, but the seat stays.
- **The cheat sheet inside the table**, still waiting for Chris's sheet.

*Closed 2026-11-26. All four releases were deployed on 2026-11-25, with the
fixes from a short live test that afternoon (a seat let in mid-Challenge got no
hand until a reload; Next moved under the cards). The checklist second test was
not worked through: Session 14 of the Castle Automatic that evening was the
first real game on the table, the GM and four players, and Chris judged it "far
more authoritative than anything we were doing". The player instructions were
written (`Player Handouts/Card Table.md` in the campaign vault). What Session 14
found is phase 33. Edmund's PR #1 (an unchanged poll answered from one query)
was merged and deployed after it.*
