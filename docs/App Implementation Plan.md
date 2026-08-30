# Companion App — Implementation Plan (commit by commit)

*Drafted 2026-07-10; split 2026-07-16. This file holds only **unbuilt** work: the next unbuilt commit is the top of the first phase below. Completed phases (0–20, commits 1–122, through the v2.2.0 binder release) live in [[App Implementation History]] — append-only, decisions preserved. **Housekeeping rule:** when a phase completes, move its section to the history file verbatim in the same commit that closes it (milestone commits already do docs work; this rides along). Anything still listed here is not built.*

*The framework is **Splatbook** (splatbook.app); the first game module is a Stonetop companion at `/stonetop`. The framework-question essay, the naming story, and the Ringwall retirement are in the history file.*

## Ground rules

- Every commit builds, type-checks (`npm run check`), and passes tests. No broken states in history.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); scopes: `shell`, `packs`, `reference`, `stonetop`, `wizard`, `play`, `steading`, `gm`, `db`, `auth` — grown since by use: `tools`, `campaigns`, `e2e`, `ci`, `cloudflare`, `pdf`, and `ops` (monitoring/backup). A `content:` type covers data reimports (commit 91).
- Saved blobs migrate on load. Each game module owns a `migrate*` function per entity type (`migrateCharacter`, `migrateSteading`, `migrateThreat`), called wherever a blob is read. Any commit that changes a blob's shape bumps that module's `SCHEMA_VERSION` and extends the migration **in the same commit**, with a test that loads a fixture of the old shape. A character saved at v0.1 opens in every later version; anything else is data loss on a timer.
- Keep a `CHANGELOG.md` current (Keep a Changelog format).
- Stack: SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, Drizzle + SQLite (local/staging) / D1 (prod), Auth.js, Zod, Vitest + Playwright. Same as Arrowed's — deliberate, so his code remains a reference and future collaboration stays easy.
- Characters/steadings stored as one JSON blob per row with `schemaVersion`, `gameId`, `entityType` — the one genuinely universal persistence model.
- Three rules, enforced from commit 1: the shell only touches game code through the `GameModule` registry; game modules never import each other; every game-visible string lives in a content pack, never in app code ("game-visible" means game *content* — shell chrome is app copy and exempt).

*Toward v2.3: offline/PWA first (precache the static reference + a web manifest, then a write queue for sheets), and the user-facing half of the data-safety story (a "download my data" JSON export on the dashboard — the operator half, the scheduled D1 export, was pulled forward into phase 19). Both were reviewed 2026-07-12 and deferred, not rejected. Also parked from the Hearthfire review: lines-and-veils safety tools (excluded / veiled / special handling) and shared "Threats" / "I wonder…" boards on the campaign dashboard — cheap, very Stonetop, and worth doing once the session ledger exists to hold them.*

## Phase 21 — Manual test follow-ups (v2.2.0 binder pass)

*Chris ran the first human-in-a-browser pass over the binder release (commits
110–122) against `docs/Manual Test Checklist.md`, 2026-07-17 + follow-up
review notes, triaged 2026-07-22. ~30 findings, deduped by root cause. Two
items below aren't fixes: the `-webkit-text-size-adjust` console warning
looks like a Firefox-vs-Tailwind quirk rather than app code (worth one look,
not a commit), and the dev-mode CF-beacon check just needs a documented
way to verify it, not a code change. Order below is severity, not
necessarily commit order — Priority 1 goes first regardless.*

**Priority 1 — data-loss / correctness (do these first):**

*All shipped: the garbled-PDF Avara embed (`eeef50c`), long-text pagination
(`04bb9d5`), the steading-editor revoke (`e650de6`), the character-debility
model (three conditions over linked stat pairs, rolled at disadvantage —
confirmed against Harm and Healing), and steading debility effects
(diminished/lacking/malcontent per the playbook; the seasonal Fortunes
reset now exists and is +0 while malcontent).*

**Priority 2 — systemic: vault markdown leaking into the UI.** *All shipped:
the tree-free wikilink pass + derived `link-index.json` artifact
(`feat(reference)`), then wired into `/stonetop/table`, the play-mode Moves
tab / level-up cards, and every steading text surface (tracker moves,
improvement effects, the sheet's list lines — the literal-asterisk horses).*

**Priority 3 — wizard input bugs:**

- `fix(wizard)`: Appearance step needs a write-in option; a made selection
  can't be unchecked/cleared.
- `fix(wizard)`: Ranger's "something wicked this way comes" insert is
  missing the answer box for its questions.

**Priority 4 — steading fixes (bundle, several small commits):**

- `fix(steading)`: edit-steading button reads as a back button —
  affordance fix.
- `fix(steading)`: steading size doesn't track population.
- `fix(steading)`: "herd of horses" asset-name upgrade doesn't auto-apply
  on the sheet once the requirement is met — currently text-only.
- `fix(steading)`: link labelled "edit steading" should read "edit/play"
  once both modes exist behind one control.
- `chore(steading)`: drop the redundant Moves & gear link from the steading
  play surface.
- `feat(steading)`: PDF should show in-progress improvements, not just
  completed ones.
- `feat(steading)`: export-to-markdown, matching characters.

**Priority 5 — play mode / character sheet UX:**

- `feat(play)`: inserts tab shows a bare "+" with no way to tell which
  insert is which — needs an "add insert" menu plus a way to remove one.

**Priority 6 — campaign & GM tooling:**

- `fix(campaigns)`: steading rolls don't reach the roll log (player-sheet
  rolls do).
- `feat(gm)`: GM should be able to see player sheets.
- `fix(stonetop)`: arcana on a player sheet can only be the custom kind —
  pre-written arcana aren't selectable; separately, "Mystery" unlocks on a
  single mark, which is probably wrong (check the rules text for the real
  threshold).
- `feat(campaigns)`: Characters view needs a "create a character" button.
- `feat(campaigns)`: finishing a character build inside a campaign needs an
  explicit attach-to-campaign-or-leave-unassigned choice.
- `feat(shell)`: dashboard is missing a Threats link (Characters/Steadings
  are there).

**Priority 7 — end of session / session log:**

- `fix(campaigns)`: end-of-session notes — reloading before marking
  preserves the draft text but not checkbox state.
- `fix(campaigns)`: "turn the season" works but gives no feedback and the
  UI stays on the old season until a manual reload.
- `fix(campaigns)`: the season display box should show the current season,
  not all four.
- `fix(shell)`: session-log notes should append at the end, not wherever
  they land now.

**Priority 8 — hygiene:**

- `fix(shell)`: Svelte `hydration_mismatch` console error — worth chasing
  even though nothing visibly broke.
- Investigate: `-webkit-text-size-adjust` parse warning — check whether
  it's a dependency's CSS before spending a commit on it.
- Document: how to verify "no CF beacon script in dev" from view-source.

**Optional / nice-to-have, not defects:** gear list's piercing (`x`) note
could link the Prosperity section; auto-updating character sheets the
moment XP is marked at end of session instead of requiring a manual look.

## Phase 23 — HMtW dungeon-seed maps & verified art (parked — scope-creep guard)

*Not v1. Recorded here so the mapping isn't lost. The book's Dungeon Seeds each
get a Dyson Logos map, re-sourced from dysonlogos.blog/maps/commercial-maps/
(free royalty-free commercial license, credit "Dyson Logos" required,
modification permitted — terms checked 2026-08-06). Take the map images from
the individual posts, not the huge PDF. Needs an image-allowlist mechanism in
the pipeline (build_rules currently strips all embeds) and a CREDITS entry per
map. Later still: verified PD/CC-BY book plates per the vault's
`_project/ART-LICENSING.md`.*

| Dungeon Seed | Dyson map(s) |
|---|---|
| The Spires | Lino's Islands in the Sky + Brenton's Watch |
| The Boundless Moat | DiTullio Islands + Greth's Island Keep + Wreck of the Wight's Shadow (boats) |
| The Castle of Crossed Destinies | Aurelon's Keep |
| The Inverted Castle | The Turning Tower |
| The City of Ruin | Darklingtown — Cavern and Spillways District |
| The Pits | The Dark Caverns of Turr |
| Belly of the Beast | Veghul's Drop |
| The Drowned Wedding | Roots of the World |
| The Library Heretical | Last Home of the Three Heretics of Xaeen |
| The Field of Reeds | The Ruins near Elverston Hold |
| The Sepulcher of Titans | Bitterchains Tombs |
| Xania | Darklingtown — Frog Tower |
| The Necropolis of Ot | An-Nayyir's Pyramid (profile) + Barrow Mounds of the Lich & Famous III |
| The Menagerie of Singular Creatures | The Cinder Throne |
| The Hellmarkt | The Palace Market |
| The House of Many Angles | The Lost Ossuary |
| The Augury | Drow Spire Fortress |
| The Truesilver Forge | Crypt of the Smith |
| The White Gardens | Raining Cave |
| The Dragonbone Memorial | Serzen's Seven Stairs |
| The Undertomb | The Granite Shore |

## Phase 24 — Stonetop: bring the indexes back, as a pinned-terms layer

Restore `Book I Stonetop/20 - Index.md` and `Book II The Wider World/59 - Index.md`
to the Stonetop vault and give Stonetop the curated search layer HMtW got in
phase 22.

They were deleted on purpose — vault commit `9eece3d`, "Delete index, convert
page-refs to heading links, contents link tables, arcana glyphs" — because a
page-number index is dead weight in a digital vault. That reasoning was right
about the page numbers and wrong about the index: the book's own index is a
human-curated term → section map, including "see X" synonyms that keyword search
can't infer. HMtW ships exactly that as `content/hmtw/index-terms.json` (a fork
of the vault's copy, so term fixes live in the repo), which `build_search.ts`
resolves into `pinned-terms.json` and the reader renders as a pinned strip above
the ranked results. Recover the notes with
`git show 9eece3d^:"Book I Stonetop/20 - Index.md"`.

It also closes a live break: a Stonetop reimport today **fails** —
`build_rules.py` reports `unresolved note [[20 - Index]]` and silently drops both
notes from the snapshot, because the contents link tables still point at them
(found 2026-08-08 while fixing the HMtW sidebar hoist; nothing has reimported
Stonetop since the deletion, which is why it went unnoticed).

Steps, roughly:

- Restore both notes, then give them the same treatment the rest of the vault
  got in `9eece3d` — page refs become heading links, not `p. 214`.
- Extract to `content/stonetop/index-terms.json` with validated targets. The
  extractor to port is the HMtW vault's `_project/scripts/build_search_index.py`,
  which now checks every term's (file, anchor) against real headings and block
  ids the way Obsidian compares links — it caught 12 stale targets on its first
  run. Generalise it rather than forking it a third time.
- Two books means two term sets: decide whether Book II terms are GM-gated. The
  precedent exists — HMtW already ships a separate `pinned-terms-gm.json`.

## Phase 27 — Shareable links on headings

*Filed 2026-08-09 out of the design review of `/hmtw`, then argued down over
three passes from "copy the rule text" to this. The decision and the discarded
work are both recorded below, because the discarded parts are the ones a future
attempt would re-derive.*

**Decided (Chris, 2026-08-09): heading links only. Copy-text and
copy-attribution are not being built.**

### The build

Every heading deeper than a game's `referencePageDepth` renders inline on its
page ancestor and already carries an anchor id — 52 of 52 on "An incomplete list
of pretty things", 6 of 6 on "Tests of Fate". The URLs exist, resolve, and have
scroll-margin handling. There is simply no way to *get* one from the interface
short of reading the page source.

That matters because h4+ is the granularity people quote: a talent entry, an
alchemical substance, one of the 52 pretty things — not "chapter nine".

**Wrap the heading's text in a link to its own anchor.** That is the whole
feature:

- desktop: right-click → Copy Link Address
- touch: long-press → Copy Link
- either: tapping it puts the anchor in the address bar, so the URL *is* the
  deep link

No JavaScript, no clipboard API, no Safari user-gesture problem, no
secure-context guard, no popover — and no glyph added to the prose, which killed
every earlier version. A dense page gets links where it would have got 52 UI
buttons, and links are already what a reference book's headings look like.

- `feat(reference)`: emit inline-section headings as anchors to their own id, in
  the one place they are generated. Shell default styling plus a game override:
  quiet by default, underline on hover/focus, never a wall of underlines on a
  52-entry page.

*Design note: the h1 gets nothing — its URL is already in the address bar. Games
with no `referencePageDepth` (stonetop, where every heading is its own page) have
no inline sections and are unaffected.*

### Considered and rejected

**Copy section text as markdown.** The benefit was always narrow: the browser
already puts *two* flavours on the clipboard by itself, so Obsidian (which
converts pasted HTML to markdown) and Google Docs already work perfectly, and
Meet can only show plain text anyway. The entire gain was bold and headings
surviving into Zoom and Discord — the two clients that use the plain flavour,
which the browser strips of markdown syntax. That is not worth a DOM→markdown
serializer, a floating selection control, touch-selection handling, and
cross-browser clipboard code that rots.

**Attribution appended on copy.** Killed by arithmetic (Chris): the attribution
sits at the *end* of the payload, and the payload exceeds the client's limit
about half the time — so the attribution is the first thing truncated, in exactly
the clients it was meant for. A licence notice that disappears when the text is
long enough to need one is worse than none. Heading links moot it anyway: a link
carries no text, so it raises no redistribution question, and the destination
already carries the credits and the licence.

### Client behaviour, kept for whoever revisits this

Chris tested, 2026-08-09. Worth preserving: the format rules were guessed wrong
twice before anyone pasted into a real client.

| | markdown | tables | limit |
| --- | --- | --- | --- |
| Zoom | parses: bold, headings, links | no — cells land as separate lines, reads fine | **1,000 chars** |
| Discord | parses, `#`–`###` only (`####` shows literally) | no | 2,000 free / 4,000 Nitro |
| Meet | none — raw syntax visible | no | — |
| Obsidian | native | yes | — |

Zoom keeps bold by *parsing markdown*, not by taking rich text — an earlier draft
inferred the opposite and built a `text/html` path around it.

Payload sizes, measured across the corpus with a ~130-char attribution included:
median page **1,476** chars, mean 2,342, longest 23,019 ("Cups"). Over Zoom's
1,000: **250 of 364 pages (69%)**. Over Discord free's 2,000: 119 (33%). Over
Nitro's 4,000: 43 (12%).

*Method note, since it earned its keep twice: paste into the real client before
deciding a format rule.*

## Phase 28 — Origins 5.5e: a character builder (game #3)

*Filed 2026-08-30 from Chris's ask. Origins 5.5e (Patchwork Paladin,
2026-08-30) is **a classless, level-less rules hack for folk-heroic play**: you
build a character out of the SRD 5.2.1 character-origin rules alone — a
background, a species, ability scores — and classes and levels are simply
deleted. Initially a character builder and nothing else: no reference, no GM
guide, no campaign surface.*

*Neither source is reachable from the sandbox (the egress proxy 403s
`patchworkpaladin.com` and `media.dndbeyond.com` at CONNECT — an organisation
policy denial, not a network fault). The post came in as a saved HTML upload;
the SRD comes from `downfallx/dnd-5e-srd-markdown`, a community markdown
conversion of SRD 5.2.1 under the same CC BY 4.0.*

### Licensing: one licence, two credits

Both halves are **CC BY 4.0** — Origins 5.5e © 2026 by Patchwork Paladin, and
SRD 5.2.1 © 2024 Wizards of the Coast LLC. So `manifest.license` stays a single
SPDX string (`CC-BY-4.0`) and no shell change is needed; the pack's
`attribution` and `LICENSE.md` carry both credits, with the SRD notice
reproduced verbatim as the licence requires.

*An earlier draft of this phase assumed the two halves would be separately
licensed and planned a per-file-licensing layer in `PackManifest`. Recorded
because it is the kind of thing a future game will genuinely need — but it is
not needed here, and building it now would be abstraction without a second
instance, which is exactly what the ground rules forbid.*

**Provenance caveat, worth carrying:** the SRD markdown is a *community*
conversion, not the publisher's PDF. Treat it as a source that can be wrong.
The extraction tool must fail loudly on anything it cannot parse rather than
silently drop it, and the pack test must snapshot every id so a re-import that
loses a background or renames a feat fails CI instead of quietly shrinking the
builder.

### What Origins actually changes — the whole delta

The builder is small because the hack is small. Every deviation from the SRD:

1. **No class, no level.** Proficiency bonus is therefore fixed at **+2**, and
   there is no progression to model.
2. **Reference class.** You pick a class purely as a source of four things —
   **Hit Point Die, Armor Training, Shields, Weapon Proficiencies** — and staple
   them onto your background. Note what this *excludes*: **no saving-throw
   proficiencies, no class skills, no class features.** The builder must not
   quietly import them because 5e habit says it should. This is the single most
   surprising rule in the hack and the one most likely to be got wrong.
3. **Equipment.** Option A gains an ordinary equipment kit (Burglar's,
   Scholar's, Dungeoneer's, Priest's Pack…) plus clothes, weapons and armour,
   usually taken from the reference class's own starting equipment. Option B's
   starting gold rises from the SRD's 50 GP to **100 GP**, or **150 GP** for a
   character with Medium or Heavy armor training.
4. **Spellcasting.** You are a caster only if your background grants **Magic
   Initiate**. No spell slots and no preparation: each spell you know can be
   cast **once per Long Rest**, except cantrips and spells cast as Rituals,
   which are free. Cantrips and level 1 spells only. New spells arrive as
   adventure rewards — scrolls (Wizard list), a deity's blessing (Cleric list),
   or ingredients found in nature (Druid list).
5. **Hit points.** Roll your Hit Die and add your CON modifier — *not* the usual
   take-the-maximum at level 1.
6. **Species.** Level 1 benefit only.

Everything else — ability generation (roll / standard array / point buy),
skills, languages, armour class, passive Perception — is the SRD's, unmodified.

### The build surface is smaller than it looks

SRD 5.2.1 is not the *Player's Handbook*: it ships **4 backgrounds** (Acolyte,
Criminal, Sage, Soldier), **4 origin feats** (Alert, Magic Initiate, Savage
Attacker, Skilled), **9 species**, and **12 classes** — of which the builder
needs only each class's four reference traits and its starting equipment. Plus
equipment, and the cantrip/level-1 slice of the Cleric, Druid and Wizard spell
lists for Magic Initiate. That is the whole pack.

### Pipeline

`content/origins/` holds the *sources*: the vendored slice of SRD markdown we
actually import, and `origins-rules.md` — the post's own rules text, extracted
from the saved HTML. `tools/build_origins_data.py` turns them into the pack's
JSON, written straight into `static/content-packs/origins/data/`.

*Departure from Stonetop, deliberate: `content/stonetop/data/` and
`static/content-packs/stonetop/data/` hold byte-identical copies of the same
generated JSON, a duplication left over from before packs moved under
`static/`. Origins keeps one copy — source in `content/`, artifact in the pack —
matching how `rules/` already flows. Stonetop is not being migrated as part of
this phase.*

### The engine

`src/lib/games/origins/engine/` — pure TypeScript, no UI or DB imports:

- `character.ts` — the shape, `createCharacter()`, `migrateCharacter()`,
  `SCHEMA_VERSION`. Store *choices*, derive everything else, so a rules fix
  never has to migrate a stat block.
- `abilities.ts` — modifiers, the three generation methods with a validator
  each (an illegal point-buy spread should be refused, not warned about), and
  the background's +2/+1 or +1/+1/+1 increases, capped at 20.
- `derived.ts` — the one place the sheet's numbers come from: AC, HP,
  initiative, saves (ability modifier only — see rule 2), skill modifiers,
  passive Perception, carrying capacity.
- `spellcasting.ts` — which list Magic Initiate opened, what may be chosen from
  it, and the once-per-Long-Rest bookkeeping.
- `validation.ts` — is this draft finishable, and which choices are still open?
  The review step reads this rather than re-deriving it.

Tests before UI on all of it. The rules that will actually bite — the four
reference-class traits and nothing more, the 100/150 GP split, saves without
proficiency — each get a test that fails if someone "fixes" them back to
standard 5e.

### The wizard

Background → Reference class → Species → Ability scores → Equipment → Spells
(only if Magic Initiate) → Details → Review, following the post's own order.
Each step reads the pack, not the engine's opinion of the pack.

This is the best test the wizard abstraction has had: Stonetop's playbooks and
this are genuinely different character-creation grammars. **If a step needs
shell work, that is a finding worth its own commit** — and worth writing down
in `adding-a-game.md` either way.

### Commits

1. `feat(tools)`: `build_origins_data.py` — SRD markdown to pack JSON, strict.
2. `content(origins)`: the pack — manifest, `LICENSE.md` with both notices,
   `landing.json`, generated `data/`, and `SCHEMA.md`.
3. `feat(origins)`: pack schemas and the round-trip pack test.
4. `feat(origins)`: the engine, test-first, over several small commits.
5. `feat(origins)`: the wizard steps.
6. `feat(origins)`: the character sheet and play mode.
7. `feat(origins)`: register and theme the game.
8. `docs`: the third walkthrough note in `adding-a-game.md` — the promise held,
   or here is what it cost.

### Deliberately not in v1

The rules reference (the post is short enough to read on its author's site, and
the SRD is a click away), the DM-facing advice as a GM guide, encumbrance,
downtime, and anything to do with monsters, magic items or treasure.

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
