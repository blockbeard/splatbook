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
need retargeting. Licensing is settled: **Chris spoke to Josh (2026-08-06)
and he's fine with the project** — leaving out the Tomb of Golden Ghosts is
his ask. The license's "redistribution of copies … prohibited" line reads as
copies of the book itself (PDF/print), not the freely-reusable game text, and
the author's direct OK closes the question either way.*

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
  style. Font roles are **documented in the creator pack's template PDF**
  (`Downloads and AddOns/Adherent of the Worm Template/`): body 10.5pt
  **IM Fell English** (already a dependency — the default text style of the
  whole book); H2 24pt caps + H3 18pt **HamletOrNot**; H4 16pt
  **CaslonAntique**; chapter-intro paragraphs **BilboDisplay**; sidebar text
  9.5pt **Goudy Old Style** under 14pt **Kelmscott Roman** headers; quotes
  **Dark Roast** with IM Fell italic attributions. H1's blackletter face
  isn't named in the sample text — read it out of the `.idml` paragraph
  styles in the same folder. Web-license check per face before embedding
  (the template grants InDesign use, not `@font-face` rights): IM Fell is
  clear; for the murky ones substitute OFL equivalents (e.g. Sorts Mill
  Goudy for Goudy Old Style). Self-hosted files namespaced `hmtw-*` in
  `static/fonts/`.
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

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
