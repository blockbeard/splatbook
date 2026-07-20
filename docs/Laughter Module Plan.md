# Laughter of the Fairy Princess — module plan (draft)

*Drafted 2026-07-19 from the planning session of 2026-07-18. Status: reviewed
2026-07-19 — the design record for the module. The commit-by-commit sequencing
lives in [[Laughter Implementation Plan]], kept separate from [[App
Implementation Plan]] while Stonetop work is heavy there; sections transplant
into the app plan as each phase starts. Decisions below marked **settled** were made
explicitly with Chris and should not be re-litigated; items marked **open** are
called out rather than guessed at.*

## 1. Identity

**Laughter of the Fairy Princess** — a B/X-family retroclone, Splatbook's second
game module. Slug **`laughter`**: folders `content/laughter/` and
`src/lib/games/laughter/`, commit scope `laughter`, served at `/laughter`.
Never abbreviate to the four-letter acronym anywhere user-visible — the whole
point of the slug is to stay clear of the other publisher's initials. (Branding
aside, kept on request: "the Splatbook of S\*laughter" is reserved for future
use.)

The module's job, in priority order: **character generation**, **XP tracking and
level-up**, then rules reference. Headline feature: a GM-settable optional-rules
checklist (modelled on OSE's) where toggles genuinely reconfigure character
generation.

**Lineage (settled 2026-07-18):** the character-mechanics substrate is classic
B/X/OSE — five-category saves, classic ability modifiers, B/X progression
shapes — because drop-in compatibility with Dolmenwood tables is the aim. The
YARR draft (Chris's Word doc) contributes the prose voice, the slot-encumbrance
chapter, the spell descriptions, and the class/ancestry roster; its Target-20
core (single save, d20+score checks, target-20 skills and morale) is dropped
entirely, not kept as a variant. Known YARR fixes folded into the port: the
morale rule (2d6 ≥ 20 is unpassable at printed morale scores — revert to
classic 2d6 roll-under), the thief HD contradiction (header d4 vs table d6),
the empty Detect Evil, the truncated Mastiff, the STR/DEX paragraph merge.

## 2. Phase 0 findings — the framework as verified (2026-07-18/19)

Everything below was read from the working copy, not assumed.

**What the module contract provides, ready to use:**

- `GameModule` (`src/lib/games/types.ts`): id, `packSchemas` (Zod resolver wired
  into the CI pack-validation harness), opaque `engine`, `entityTypes` map with
  per-type `wizardSteps` / `summary` / `newDraft` / `entityMeta` / `dice` /
  `sheetComponent` / `playComponent` / `pdf`. Registration is a side-effect
  import (`registry.ts`); the `[game=game]` param matcher reads the registry, so
  a registered game gets its routes with **zero shell edits**.
- Persistence: one JSON blob per entity (`entities.data`) with `schemaVersion`,
  `gameId`, `entityType`, optional `campaignId`. The module owns
  `migrateCharacter`; any blob-shape change bumps `SCHEMA_VERSION` and extends
  the migration in the same commit, with an old-shape fixture test. Non-negotiable
  house rule, honoured from this module's first saved draft.
- Wizard (`src/lib/wizard/`): shell renders an ordered step list; every step
  component receives the whole draft + `update` + `goTo`. **Intra-step option
  gating therefore needs no framework change** — a class step can filter by the
  drafted ancestry exactly the way Stonetop steps read the drafted playbook.
- Campaign settings: `campaigns.settings` is an opaque JSON column; a game
  declares `campaignSettingsFields` and the shell renders them generically on
  the campaign dashboard. This is the embryo of the checklist.
- Pack pattern: `content/<game>/data/*.json` validated by game-registered Zod
  schemas in CI, trusted at runtime; prose under `content/<game>/rules/`
  generated from an Obsidian vault by `tools/build_rules.py`; a `SCHEMA.md`
  documents the data shapes. Stonetop's `pack/*.ts` fetch helpers are the
  loader idiom to copy.
- Advancement precedent: play components already own "mark HP and spend XP";
  the session ledger (`SessionProps.record`) stores per-character XP awards
  generically. Level-up lives entirely in module code.

**The three framework gaps (the complete list — nothing else surfaced):**

1. **`wizardSteps` is a static array.** Toggles that restructure the *step
   list* (race-as-class removing the ancestry step; a proficiency toggle adding
   a step) can't be expressed. Change: allow steps to declare an
   `applies?: (draft) => boolean` predicate (or accept a `(draft) => steps`
   function). Generic, backwards-compatible, Stonetop untouched.
2. **`CampaignSettingField` is boolean-only.** Several checklist entries are
   n-way (skill system is at least three-way; initiative variants likewise).
   Change: add a `select` field type with typed options; shell renders a
   dropdown/radio next to the existing checkboxes. Generic.
3. **The create flow has no campaign awareness.** `/[game]/[type]/build` never
   learns a campaign id (verified: no campaign reference in the build route or
   wizard lib), so a wizard can't seed the draft from the table's checklist.
   Change: pass an optional `campaignId` through the build route and
   `WizardStepProps`, mirroring what `PlayProps` already does. Generic, small.

Because the rules profile is **snapshotted into the character blob** (settled,
§4), gap 3 is only about *seeding*: a standalone character picks its profile in
the wizard's first step; a campaign-linked character starts from the table's
checklist. Nothing downstream of creation reads campaign settings for rules.

One further early commit, agreed 2026-07-18: an **ESLint import-boundary rule**
turning the two hard rules into tooling — `src/lib/games/laughter/**` may not
import from `src/lib/games/stonetop/**` (and vice versa), and shell code may not
import game internals except through the registry. Shell-level but game-neutral.

## 3. Module architecture

Standard shape, mirroring Stonetop file-for-file where the analogy holds:

```
content/laughter/
  data/            SCHEMA.md, ancestries, classes, spells, equipment,
                   rules-checklist.json (the checklist itself is pack data —
                   every GM-visible toggle label/description lives here, not in
                   app code)
  rules/           generated from the Laughter vault (YARR docx → vault first)
src/lib/games/laughter/
  index.ts         GameModule registration
  pack-schemas.ts  Zod schemas for every data file
  pack/            typed fetch helpers (Stonetop's loader idiom)
  engine/          pure TS: derivations, legality, profile resolution,
                   advancement, migrations — no UI/DB imports, fully unit-tested
  wizard/          step components + steps.ts + summary.ts
  sheet/ play/     character sheet; play mode with HP/XP/level-up
  theme.css        scoped to [data-game="laughter"]
```

The engine is where this module earns its keep; the components stay thin. Three
engine responsibilities are load-bearing:

- **`resolveProfile(snapshot)`** — the character's stored toggle snapshot,
  validated against the checklist definition, unknown/missing toggles filled
  with defaults (this is what makes old blobs survive checklist growth).
- **`derive(character, packData)`** — every derived stat (AC both ways, attack
  numbers both ways, saves, speed under either encumbrance rule, skill targets
  in the active system) computed on demand, never stored. Stored: rolled and
  chosen things only (abilities, HP max, inventory, spells, XP).
- **`legalOptions(draft)` / `normalise(draft)`** — the legality matrix (§5) and
  its enforcement. `normalise` runs on every wizard `update`: if a changed
  earlier choice invalidates a later one (back-navigation, the classic wizard
  trap), the invalid choice is cleared and the summary rail shows it as open
  again. This keeps invalidation **module-local** — no shell mechanism needed.

**Canonical representation (settled):** store and compute ascending — attack
bonus and ascending AC — and derive descending display (THAC0, descending AC
via the 19−x B/X correspondence) when the toggle says so. Classic defaults
affect *presentation defaults*, not the substrate. Skills are the exception
where representations aren't derivable from one another: percentile and x-in-6
progressions are authored explicitly side by side in class data (bounded,
mechanical — see §7).

## 4. The rules profile (toggle layer)

`content/laughter/data/rules-checklist.json` defines every toggle:

```jsonc
{ "id": "ac-style", "label": "Armour Class", "type": "select",
  "options": ["descending", "ascending"], "default": "descending",
  "tier": "generator",            // record | reference | generator
  "requires": [], "conflicts": [] }
```

- **`tier: record`** — the majority of the OSE checklist (individual initiative,
  morale variants, variable weapon damage at the table, etc. — full enumeration
  is data-authoring task 1, §7): the GM's choice is recorded and displayed to
  players; nothing in chargen changes. Cheap, and it makes the checklist read
  complete at launch (settled: full-checklist scope).
- **`tier: reference`** — the toggle additionally switches which rules prose the
  reference shows (variant-rule callouts carry a toggle id in the vault
  markdown; `build_rules.py` may need a small extension to preserve the tag).
- **`tier: generator`** — reshapes chargen and/or derived stats. Launch set:
  AC style, skill system (classic ↔ x-in-6 ↔ percentile where they differ),
  race-as-class ↔ split, class restrictions, demihuman level limits,
  encumbrance (coin-weight ↔ slots), variable vs flat weapon damage (equipment
  step + sheet), weapon proficiency/specialisation (adds a step; post-launch
  candidate), firearms (gates equipment entries; post-launch candidate).

`requires`/`conflicts` express toggle interdependence (specialisation requires
proficiency; the skill options are mutually exclusive by being one `select`).
The GM checklist UI *is* the campaign-settings surface — framework gap 2's
`select` type plus these pack-defined fields; the shell keeps rendering
generically and never learns what any toggle means.

**Snapshot semantics (settled):** the wizard's first step ("House Rules") writes
the resolved profile into the draft — seeded from the campaign when a
`campaignId` is present, GM-editable defaults otherwise. A saved character's
rules never change under it. When a GM flips a toggle mid-campaign, affected
characters show a **conversion offer** in play mode (diff of old/new profile,
one-tap apply per character, `migrateCharacter`-style recompute of derived
choices where mechanical, flagged manual review where not — e.g. skills systems
with no clean mapping). Defaults follow the classic pole (settled): descending
AC display, classic skills, coin encumbrance, restrictions on.

## 5. The legality matrix

The matrix is **derived, never authored as a table**. Authored inputs:

- per-ancestry: `requirements` (ability minimums), `allowedClasses`
  (list or `"all"`), `levelLimits` (`{classId: maxLevel}`) — the latter two
  only *consulted* when their toggles are on;
- per-class: `primeRequisites`, and optionally `ancestryLock` — the field that
  makes a race-class "a class that locks ancestry" (settled model).

`legalOptions(draft)` then answers, per wizard step, from four inputs (profile,
ancestry data, class data, abilities):

| profile state | ancestry step | class step offers |
|---|---|---|
| split model, restrictions **off** | shown | all classes without `ancestryLock` |
| split model, restrictions **on** | shown | drafted ancestry's `allowedClasses`, ability minimums enforced |
| race-as-class **on** | **hidden** (dynamic-steps predicate) | human-legal classes (each locking ancestry `human`) + all `ancestryLock` classes; one pick sets both fields |

Level limits bind at advancement, not creation: the level-up flow consults
`levelLimits` only when that toggle is on. Ability-score requirements gate at
the class step with the reason shown ("needs CON 9"), not silently hidden —
players should see what a reroll would unlock.

Character blob (initial shape, `SCHEMA_VERSION: 1`): `name`, `profile`
(snapshot), `abilities` (raw scores; adjustments recorded as deltas so the
exchange rule is reversible during the wizard), `ancestryId`, `classId`,
`level`, `xp`, `hpMax`/`hpCurrent`, `alignment`, `languages`, `inventory`
(item ids + write-ins + container/slots detail), `funds`, `spellsKnown`/
`spellsMemorised`, `skillChoices` (only what the active skill system makes
choosable), `notes`. Everything else is `derive()`d.

## 6. Advancement

- **XP in:** play mode gets an "award XP" affordance (prime-requisite ±% applied
  by the engine from the snapshot); campaign tables can use the generic session
  ledger (`record`) — the game supplies award lines, the shell stores and
  renders them. No shell change.
- **Level-up:** when `xp ≥ progression[level+1].xp`, play mode offers a level-up
  flow (module-local mini-wizard inside `playComponent`, the Stonetop pattern —
  not the shell wizard): roll new HD via the `roll` callback, pick new spells /
  skill or proficiency choices per the active toggles, engine recomputes and
  bumps the blob. Level limits (if toggled) cap here with the reason displayed.

## 7. Work breakdown

**(a) Data authoring — bounded, mechanical.** Sized in session-scale commits:

| item | size | notes |
|---|---|---|
| `SCHEMA.md` + Zod schemas + `rules-checklist.json` full enumeration against the OSE checklist PDF | 2 commits | checklist enumeration is task 1 — it fixes the toggle id namespace the snapshot depends on |
| YARR docx → Laughter vault; `build_rules.py` run for game 2 | 1–2 | pandoc conversion is trivial; the B/X core-mechanics rewrite of checks/saves/skills chapters is the real work (see (d)) |
| 4 core classes, B/X-converted progressions + five-save tables, levels 1–5 | 2 | port + convert from YARR |
| 3 race-classes (elf, dwarf, halfling) — **launch must-have** (settled) | 2 | adapt from OSE-SRD OGC mechanics, own wording |
| 4 ancestries with requirements/allowed-classes/level-limits data | 1 | |
| Equipment with dual encumbrance data (slots + coin weight) | 1 | port from YARR |
| Spells MU 1–3, Cleric 1–2 (port), plus gaps | 1–2 | |
| Thief skills in both classic representations (percentile + x-in-6) per level | 1 | |
| Post-launch: 5 AD&D-style classes, Dolmenwood kindred/class analogues (original names/text), levels 6+, more spell levels | 6–10 | **open:** launch level cap — recommend shipping 1–5 (YARR's current reach) and extending toward 10 (Dolmenwood's range) before 14 |

**(b) Module code against the framework as-is:** pack loaders, engine
(derivations + legality + normalise + profile + advancement, all unit-tested),
~9 wizard steps (house-rules, abilities, ancestry, class, HP, equipment,
spells-if-caster, details/alignment, review), summary rail, sheet, play mode
with XP/level-up, dice module, migration scaffold, e2e happy-path. Roughly
12–16 commits. PDF sheet: post-launch (precedent exists, commit 120).

**(c) Framework changes — each flagged, all generic:**

| change | size | risk |
|---|---|---|
| ESLint import-boundary rule | S | none — additive lint |
| `WizardStep.applies?(draft)` predicate | S | low — shell filters the list it already renders; Stonetop unaffected |
| `select`-type `CampaignSettingField` | S | low — additive union member |
| `campaignId` through build route + `WizardStepProps` | S–M | low — mirrors `PlayProps`; touches one route and one props type |

**(d) Ruleset finishing (content, not code):** B/X-convert YARR's checks, saves,
skills, morale; write the five missing classes' prose; fix the listed YARR
snags. Rides alongside (a); the rule detail is explicitly non-urgent except
where a data file needs the number (progressions, saves).

## 8. Licensing ruling (open question 2 — ruled)

**Recommendation: do not adopt the OGL by default.** Publish the Laughter pack
as Chris's own text under his own copyright (pack-level licence of his
choosing), with:

- a **CC BY 4.0 attribution block** for SRD 5.1, which YARR already cites and
  which several spells draw on — attribution is the entire obligation;
- **original wording throughout** for everything with only OGL-source lineage
  (OSE SRD, OSRIC, LL/AEC): game *mechanics* are not copyrightable and the
  numeric progression tables are system, not expression. This is the
  community-normal post-2023 posture;
- the OGL invoked **only if verbatim OGC text ever enters a file** — at which
  point that content ships with OGL 1.0a and a Section 15 chain, cleanly, at
  the pack level where the repo already layers per-folder licences (GPL app,
  CC BY-SA Stonetop text);
- Dolmenwood: strictly PI-free — original names and original text for the
  analogues, mechanics only (settled: "playable analogues", no import).

Rationale: the OGL buys certainty only for text actually taken from OGC, at the
price of contaminating the whole document with marking/Section 15 obligations.
With a fully-original synthesis the licence has nothing to attach to; CC BY
covers the one real source; and the option to invoke OGL later per-file remains
open. A `credits`/provenance note per data file (in `SCHEMA.md` or a
`sources.json`) keeps the audit trail honest either way.

## 9. Phasing

- **L0 — scaffolding:** lint boundary rule; module registered (`/laughter`
  routes live); pack skeleton + schemas + checklist enumeration; engine core
  (abilities, modifiers, derivations) with tests; vault conversion started.
- **L1 — classic generator:** fixed-rules wizard end-to-end (no toggles yet:
  classic defaults hardcoded as the only profile), sheet, save/load with
  migration scaffold. *Milestone: roll up a classic B/X character at
  `/laughter`.*
- **L2 — the checklist:** framework gaps 2+3, house-rules step, snapshot,
  campaign checklist UI; first generator toggles (AC style, encumbrance, skill
  system). *Milestone: the headline feature demonstrably reconfigures chargen.*
- **L3 — the matrix:** framework gap 1 (dynamic steps), race-as-class,
  restrictions, level limits; race-class data. *Milestone: launch scope
  complete — both models, one toggle apart.*
- **L4 — advancement:** XP, level-up flow, session-ledger integration,
  mid-campaign conversion offer.
- **L5+ — breadth:** AD&D classes, Dolmenwood analogues, proficiency/firearms
  toggles, levels 6+, PDF sheet, reference build from the vault, GM guide.

Each phase is a plan-doc section to transplant into [[App Implementation
Plan]] commit-by-commit when it starts, per the housekeeping rule.

## 10. What will fight this (blunt list)

- **The three shell gaps** (§2) — small but real, and they're contract changes:
  do them early (L2/L3 openers), each with Stonetop regression coverage, since
  every future game inherits them.
- **Snapshot drift:** the checklist will grow; every checklist change is
  effectively a blob-schema event for the snapshot. Mitigation: stable toggle
  ids from day one (why enumeration is task 1) and `resolveProfile` defaulting
  unknowns — plus the standard migration discipline.
- **Skill-system plurality** is the one place representations must be authored
  in parallel rather than derived; any new skill-bearing class pays the cost
  ×2. Accepted, bounded.
- **`build_rules.py` single-game assumptions** (paths, vault layout) — likely
  trivial to parameterise, but unverified. **Open** until the vault exists.
- **Mid-campaign conversion UX** is genuinely hard for unmappable toggles
  (percentile → x-in-6 has judgement calls). The offer-plus-manual-review
  design bounds it; don't promise lossless conversion.
- **Sandbox test environment** quirks (native binaries, no-unlink mount) — the
  CLAUDE.md workarounds apply unchanged; CI remains the verification backstop.
- Not a fight, but a note: Stonetop's PbtA shape means zero mechanics reuse —
  the contract is proven, the content patterns (tables-heavy, derivation-heavy)
  are new ground. The engine's test suite is where that risk is paid down.
