# Laughter of the Fairy Princess — implementation plan (commit by commit)

*Drafted 2026-07-19. **Deliberately separate** from [[App Implementation Plan]]
while Stonetop work is still heavy there (Chris's call, 2026-07-19): this file
is the whole Laughter queue, with its own local commit numbers. When a Laughter
phase actually starts, its section transplants into the app plan and picks up
real commit numbers; until then the app plan stays clean. Completed phases here
get marked ✔ in place rather than moving to [[App Implementation History]] —
the housekeeping rule applies once the sections live in the app plan. Design
rationale, schemas, and the settled decisions live in [[Laughter Module Plan]];
this file is sequencing only and defers to it on any conflict.*

## Ground rules (inherited, plus module-locals)

- Everything in the app plan's ground rules applies unchanged: every commit
  builds, type-checks, and passes tests; conventional messages (scope
  `laughter`; `content:` for data imports; `shell` for the three framework
  commits); saved blobs migrate on load, shape changes bump `SCHEMA_VERSION`
  with a fixture test **in the same commit**; CHANGELOG at milestones.
- Module-local: every engine behaviour lands with unit tests in the same
  commit — the engine is pure TS and there is no excuse. Toggle ids in
  `rules-checklist.json` are **immutable once committed** (they live inside
  character snapshots forever); renames are additions plus migration.
- Data commits (`content(laughter):`) are valid targets for a session on their
  own — they're bounded and mechanical, and the Zod schemas make review cheap.

## Phase L0 — Scaffolding (commits 1–6)

1. `chore(lint): import-boundary rules for game modules` — the two hard rules
   become tooling: ESLint `no-restricted-imports` (per-directory overrides) so
   `src/lib/games/<a>/**` cannot import from `src/lib/games/<b>/**`, and shell
   code (`src/routes/**`, `src/lib/` outside `games/`) cannot import game-module
   internals — only `$lib/games` (registry surface). Written generically so
   game #3 is covered by pattern, not by edit. Verified by running lint over the
   existing tree (Stonetop must pass untouched); the rule descriptions say *why*
   in one line each, since lint output is the only place future-us reads them.
2. `feat(laughter): register the module` — `src/lib/games/laughter/index.ts`
   with id `laughter`, name "Laughter of the Fairy Princess", stub
   `packSchemas`, empty `entityTypes`, `theme.css` scoped to
   `[data-game="laughter"]` (bare palette for now). Registration is **two
   files** (verified 2026-07-19): `BUILT_IN_GAMES` in `$lib/games/index.ts`
   *and* the UI-free `$lib/games/schemas.ts` (validate:packs runs under tsx,
   which can't load `.svelte` — its own header says register in both). The
   id-uniqueness test extends; `/laughter` goes live off the existing
   `[game=game]` matcher with zero route edits — which is itself the test that
   the registry contract holds for a second game. Known cosmetic: the game
   landing page shows an unconditional "Rules reference" door that stays dead
   until the reference build lands (~commit 6/L5) — acceptable on staging;
   gate it on the manifest if it grates.
3. `content(laughter): pack skeleton` — the **served pack root is
   `static/content-packs/laughter/`** (verified against stonetop's:
   `manifest.json`, `LICENSE.md`, `SCHEMA.md`, `data/`, `rules/`, search
   indexes — CLAUDE.md's "later `static/content-packs/`" has already
   happened; `content/<game>/` is the generation *source* side). Mirror that
   layout: manifest with empty file list, `LICENSE.md` carrying the §8
   licensing posture from day one, `SCHEMA.md` drafted from [[Laughter Module
   Plan]] §5; `pack-schemas.ts` resolver wired so `npm run validate:packs` is
   green and *stays* green as files land.
4. `content(laughter): rules-checklist.json — the full toggle enumeration` —
   **data task 1, deliberately before any character data**: every entry from
   the OSE optional-rules checklist plus YARR's own variants, each with a
   stable id, label/description (GM-facing words live here, not in app code),
   `type` (boolean/select + options), `default` (classic pole — settled),
   `tier` (record / reference / generator), `requires`/`conflicts`. Zod schema
   plus integrity tests: ids unique and kebab-case, defaults are legal values,
   `requires`/`conflicts` reference real ids, select options non-empty. This
   commit fixes the id namespace the profile snapshot depends on forever.
   Entries the 2026-07-19 review added: ability-score generation method
   (3d6-in-order / 4d6-drop / array — a select; commit 12 otherwise hardcodes
   one), HP at first level (max vs rolled — YARR says max, classic says
   rolled), XP-for-treasure (commit 31 assumes it, and YARR currently has
   *no* XP-award rules at all — see the book repo's RULESET-REVIEW). **Defaults
   get a per-toggle pass with Chris here** — the blanket "classic pole" rule
   fits AC/skills but not obviously YARR's own kindnesses like max HP at 1st.
5. `feat(laughter): engine core — abilities and derivations` — pure functions,
   exhaustively tested: the B/X ability-modifier table, prime-requisite XP
   percentages, ascending⇄descending AC (19−x) and attack-bonus⇄THAC0
   correspondence, encumbrance→speed under both coin-weight and slot systems,
   XP-threshold lookup. No character model yet — just the arithmetic the whole
   module stands on, pinned down while it's cheap to review.
6. `tools: build_rules.py learns a second game` — parameterise the
   vault-path/output assumptions (currently Stonetop-shaped; exact scope
   unverified until the Laughter vault exists — flagged in the module plan) and
   land the first generated `content/laughter/rules/` drop from the converted
   YARR docx. The B/X rewrite of the checks/saves/skills chapters is ongoing
   content work that re-imports incrementally; nothing downstream blocks on
   prose, so this commit may slide anywhere in L0–L2 without consequence.

## Phase L1 — The classic generator (commits 7–17)

*No toggles yet: the wizard hardcodes the classic-defaults profile as the only
one. Everything in this phase is exercised again when the checklist arrives, so
build it against `derive()`/`legalOptions()` from the start — the profile
parameter exists from commit 7, it just only ever receives the default.*

7. `feat(laughter): character model v1 + migration scaffold` — the blob shape
   from [[Laughter Module Plan]] §5, `SCHEMA_VERSION = 1`, `newDraft`,
   `entityMeta`, `migrateCharacter` (identity for now) **plus the v1 fixture
   test that every later schema bump extends** — the "a character saved today
   opens in every later version" contract starts at v1, not when it first
   breaks. **Engine-only: do not register `entityTypes.character` yet.**
   (Review finding 2026-07-19: the landing page routes a type with `newDraft`
   but no `wizardSteps` to the *editor-first* play view — verified in
   `[game=game]/+page.ts` — which this type can't serve until L4's play mode
   exists; registering here would ship a broken "Create a character" button.
   Registration waits for commit 12.)
8. `content(laughter): ancestries` — human, elf, dwarf, halfling: ability
   requirements, `allowedClasses`, `levelLimits`, special abilities, languages,
   speed. The toggle-gated fields (`allowedClasses`, `levelLimits`) are
   authored *now* and consulted *later* (L3) — data completeness doesn't wait
   on the feature. Zod + integrity tests (class refs resolve once classes land;
   test marks the cross-file check pending until commit 9 closes it).
9. `content(laughter): the core four classes, levels 1–5` — fighter, cleric,
   magic-user, thief, B/X-converted from YARR: XP thresholds, HD (thief d4
   contradiction resolved here — pick d4, the B/X value, and note it), attack
   bonuses, **five-category save tables**, cleric turn-undead and spell slots,
   MU spellbook rules, thief percentile skills (x-in-6 waits for commit 24 —
   its schema slot exists now). Integrity tests: XP monotone, one row per
   level, save tables complete, prime requisites reference real abilities.
10. `content(laughter): equipment` — armour/weapons/gear from YARR with cost
    **and both encumbrance representations** (slots and coin weight) per item,
    weapon damage dice + qualities, armour AC in canonical ascending form.
    Beasts/hirelings tables ride along if the session has room; nothing needs
    them until play mode.
11. `content(laughter): spells — MU 1–3, cleric 1–2` — port from YARR (Detect
    Evil completed, the two YARR truncations fixed), spell-id namespace, class
    list membership. Zod + reference-integrity tests.
12. `feat(laughter): wizard — abilities step` — `entityTypes.character`
    registers **here** (label/newDraft/entityMeta/wizardSteps together, so the
    landing button routes to the builder from its first appearance — the
    commit-7 trap). The step: generation per the profile's method toggle
    (classic default from commit 4's pass; engine RNG, seedable for tests),
    the reroll-if-hopeless rule, the point-exchange rule as reversible deltas
    (raw rolls stay in the blob), and the summary rail (`summary.ts`) seeded
    with its first rows. First real wizard step — also the commit that proves
    the generic wizard shell hosts a second game.
13. `feat(laughter): wizard — ancestry and class steps` — selection cards from
    pack data; ability-requirement gating **with the reason shown** (a player
    should see what a reroll would unlock, not a silently missing option);
    `normalise()` lands here: change ancestry after picking a class and the
    invalid class clears, with a back-navigation test proving it. This commit
    is the intra-step half of the legality matrix; the toggle-driven half is L3.
14. `feat(laughter): wizard — HP, alignment, details steps` — HP per the
    checklist's max-vs-rolled entry (default decided in commit 4's per-toggle
    pass; hardcoded to that default until L2 activates the toggle), alignment,
    name/appearance/languages.
15. `feat(laughter): wizard — equipment step` — 3d6×10 starting gold rolled,
    purchase UI against the equipment pack, running encumbrance readout
    (coin-weight, the classic default), funds tracked into the blob.
16. `feat(laughter): wizard — spells step` — memorisation picks for casters.
    Static step lists mean non-casters *see* this step until L3's `applies`
    predicate exists: render an explicit "the Fighter carries steel, not
    spells" pass-through rather than pretending. The compromise is noted here
    and retired in commit 25.
17. `feat(laughter): review step + character sheet` — review with rail
    links-back; read-only `CharacterSheet` rendering `derive()`d stats in
    classic dress (descending AC, THAC0 line, save table); save; **e2e golden
    paths** for one martial and one caster, Stonetop-commit-98 style (data-driven
    so later classes join the loop free). CHANGELOG. **Milestone: roll up a
    classic B/X character at `/laughter`, start to sheet.**

## Phase L2 — The checklist (commits 18–24)

18. `feat(shell): select-type campaign settings` — **framework change 1 of 3.**
    `CampaignSettingField` grows a discriminated `type: 'boolean' | 'select'`
    (options with value/label, still game-authored words); the campaign
    dashboard renders selects beside the existing checkboxes; storage unchanged
    (opaque JSON). Stonetop's lone boolean field is the regression case; unit
    tests on the render component, e2e touch on the dashboard.
19. `feat(shell): campaignId reaches the create flow` — **framework change 2
    of 3.** The build route accepts an optional campaign context (link from the
    campaign dashboard's "new character", membership-validated server-side);
    `WizardStepProps` gains optional `campaignId`, mirroring `PlayProps`
    verbatim — same opacity contract, the shell never reads settings on a
    step's behalf. Stonetop steps ignore the new prop by construction.
20. `feat(laughter): house-rules step + profile snapshot` — `resolveProfile()`
    in the engine (validates a snapshot against the checklist, defaults
    unknowns — the function that makes old blobs survive checklist growth);
    wizard step 0 shows the checklist, seeded from campaign settings when
    `campaignId` is present, GM-defaults otherwise; resolved profile written
    into the draft. From this commit on, a character's rules are *its own*.
    **Open decision (surfaced 2026-07-19):** when campaign-linked, is the step
    read-only (GM sets the table's rules, the player only views them)?
    Lean yes — otherwise a player can quietly diverge from the table — with a
    GM-role bypass for GM-made characters.
21. `feat(laughter): the GM checklist on the campaign dashboard` —
    `campaignSettingsFields` generated from `rules-checklist.json` via a
    build-time JSON import (the single pack file module code imports statically
    rather than fetches — single-source, noted in SCHEMA.md). Record-tier
    toggles are now functional end-to-end: GM sets, table sees. The checklist
    *reads* complete from this commit even though generator wiring is still
    landing — the settled full-checklist posture.
22. `feat(laughter): AC-style toggle` — first generator-tier toggle wired:
    `derive()` serves both faces, sheet/review/wizard render per profile, with
    the cross-table conversion line ("AC 5 [14]") always available for
    drop-in-at-someone-else's-table use. Tests assert both presentations from
    one stored character.
23. `feat(laughter): encumbrance toggle` — coin-weight ⇄ slots; equipment step
    readout and sheet speed derivation both react; the dual item data from
    commit 10 pays off with no data change.
24. `feat(laughter): skill-system toggle` + x-in-6 data — percentile ⇄ x-in-6:
    the thief table gains its authored-in-parallel x-in-6 progression (the one
    place representations can't be derived — module plan §3), general
    exploration skills (listen, search, doors) follow the active system,
    wizard/sheet render accordingly. CHANGELOG. **Milestone: the headline
    feature is demonstrable — flip a toggle, watch chargen reshape.**

## Phase L3 — The legality matrix (commits 25–28)

25. `feat(shell): WizardStep.applies predicate` — **framework change 3 of 3,
    the one the module plan calls the crux.** Steps may declare
    `applies?: (draft) => boolean`; the shell filters the rendered list on
    every draft change, progress bar and deep-link routing follow the filtered
    list, and a hidden step's drafted data is left in place (clearing is
    `normalise()`'s job — the shell stays dumb). Wizard-navigation unit tests
    plus a Stonetop e2e regression; commit 16's caster compromise retires in
    the same change.
26. `content(laughter): race-classes — elf, dwarf, halfling` — the three
    launch race-classes (settled must-have): OSE-SRD-lineage mechanics in
    original wording, each an ordinary class with `ancestryLock` set,
    progressions/saves/specials to level 5 (elf's dual-progression XP costs
    included). Golden-path e2e loop picks them up automatically.
27. `feat(laughter): race-as-class toggle` — the matrix's sharpest case, now
    one predicate and one filter: ancestry step hides via `applies`, the class
    step offers human-legal classes (locking ancestry human) plus all
    `ancestryLock` classes, one pick sets both fields. E2e golden paths run in
    **both** modes from here on.
28. `feat(laughter): restrictions and level-limits toggles` —
    `legalOptions()` consults `allowedClasses` + ability minimums when the
    restrictions toggle is on (reasons shown, per commit 13's principle);
    level limits recorded into effect for L4's level-up to enforce. CHANGELOG,
    version note. **Milestone: launch scope — both character models live, one
    toggle apart, restrictions authentic to taste.**

## Phase L4 — Advancement (commits 29–32)

29. `feat(laughter): play mode — HP, funds, inventory, XP` — `PlayMode` with
    the editable counterparts (HP current/max, funds, inventory add/drop with
    live encumbrance, XP award applying the prime-requisite percentage from
    the snapshot); shell autosave via `onChange` as ever.
30. `feat(laughter): level-up` — threshold detection against the class
    progression; a module-local mini-flow inside play mode (the Stonetop
    pattern — the shell wizard is for creation): HD rolled through the `roll`
    callback so it lands in the campaign log, new spells/skill picks per the
    active toggles, engine recompute. Level limits cap here, reason displayed.
    Blob shape should survive unchanged; if it doesn't, the migration rides in
    this commit per the ground rule.
31. `feat(laughter): end-of-session — treasure and monster XP` —
    `sessionComponent`: GP-for-XP and monster-HD XP tallies, per-character
    shares, written through the generic session ledger (`record`) which
    already renders award lines. Retainer half-shares deferred until retainers
    exist as data.
32. `feat(laughter): mid-campaign conversion offer` — play mode detects a
    campaign-settings/snapshot divergence and offers the per-character
    conversion (settled design): mechanical toggles recompute one-tap,
    unmappable ones (skill systems) apply with a flagged manual-review note.
    Never silent, never automatic, never lossless-promising. Tests per tier.

## Phase L5 — Breadth (commits 33 onward, sized loose on purpose)

*Order within this phase is preference, not dependency; items are one session
each unless noted. Renumber on transplant.*

33.–37. `content(laughter):` the five AD&D-style classes (spellsword, delver,
    ruffian, druid, mystic in YARR's naming — final names at authoring time),
    one commit each: data + prose, joining the e2e loop and the legality data.
38.–40. `content(laughter): Dolmenwood analogues` — kindred analogues (2
    commits), class analogues (1–2): original names, original text, mechanics
    only; a PI check is part of each commit's review. The settled
    drop-in-compatibility deliverable.
41. `content(laughter): levels 6–10` — progressions, spell levels 4–5, saves;
    toward Dolmenwood's range before B/X's 14 (module plan open item, resolved
    by doing).
42. `feat(laughter): weapon proficiency/specialisation toggle` — the first
    post-launch generator toggle that *adds* a wizard step, exercising
    `applies` in the growing direction; class data gains proficiency slots.
43. `feat(laughter): firearms toggle` — equipment-list gating plus rules text;
    mostly a record/reference-tier entry wearing a small generator rider.
44. `feat(laughter): character sheet PDF` — the commit-120 pattern
    (server-side pdf-lib behind the generic endpoint), rendering the active
    profile's presentation (a descending-AC table prints THAC0, an ascending
    one prints attack bonus).
45. `content(laughter) / feat(reference):` reference build-out — the
    B/X-rewritten prose fully re-imported, reference-tier toggle tags
    honoured by `build_rules.py` (variant callouts carry toggle ids), table
    reference page if wanted. Open-ended; content work by nature.

## Transplant protocol

When a phase starts: move its section into [[App Implementation Plan]] at the
queue position it's actually taking, renumber against the app's real commit
counter, and leave a one-line tombstone here pointing at it. This file empties
phase by phase and is deleted when the last one transplants; [[Laughter Module
Plan]] persists as the design record.
