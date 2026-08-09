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

## Phase 27 — Share a rule: copy section text and links

*Filed 2026-08-09, out of the design review of `/hmtw` (see CHANGELOG's v2.3.x
entries and `docs/hmtw-fonts.md` for the rest of that pass). The use case is
concrete and it is the one this product exists for: someone at the table wants
to put a rule in front of the other players, in Discord, Zoom, Meet or their own
notes, without making everyone find the page. Today they select prose in the
browser and paste it, which loses the bold — and in HMtW bold is what flags the
term a rule turns on.*

*A first spec put a control on every heading behind a popover, copied "the
section's own prose excluding children", and appended an attribution line naming
the book and splatbook.app. An adversarial pass killed most of it; the findings
are recorded under each commit below rather than lost, because every one of them
is a trap the next attempt would fall into too.*

**One control per page, not per heading.** Pages are this product's shareable
unit — that is the pitch on the reference landing. Per-heading controls die on
the tail of the corpus: the median page has 1 heading but "An incomplete list of
pretty things" has 53, Appendix D's four suit pages have 47–52 each, and
"Creating interesting rooms" has 43. Fifty-three UI glyphs down a page, in a book
whose prose contains no icons at all, is not a tradeoff worth arguing about.
Per-heading controls for h4+ anchors stay possible later, but only once something
measures whether anyone wants them.

- `feat(reference)`: a **clipboard-markdown renderer** — the whole of the work,
  and the piece the first spec hid inside a subordinate clause ("source it from
  the pack"). Neither existing target fits: pack markdown still carries
  `[[wikilinks]]`, `^block-ids` and `> [!callout]` syntax, and the rendered HTML
  has hoisted sidebars and resolved in-app hrefs in it. A third target, with its
  own tests, emitting two flavours from one pass:
  - **`text/plain`** — markdown. Heading syntax capped at `###`, anything deeper
    demoted to `**bold**` (Discord renders h1–h3 and shows `####` literally —
    Chris tested). This lands on `referencePageDepth: 3` by itself: h1–h3 are
    exactly the sections with their own pages, and h4+ are the talent entries and
    statblock fragments the theme already sets in bold rather than as headings.
  - **`text/html`** — real bold, real tables, absolute links.
  - Cross-references become **plain label text in both flavours** (decided
    2026-08-09). A quoted rule carries many of them; masked links are noise in
    Discord and raw markdown blobs in Meet, and the attribution block already
    carries the one URL that gets a reader back to the book.
  - Tables flatten to `Label — value` lines in plain (no chat client renders
    markdown tables) and stay real `<table>` in HTML, where Docs and Obsidian
    take them.
  - Callouts keep their title as a bold line, then their body.

- `feat(reference)`: the **Share control**, one per page, in the page furniture
  beside the breadcrumb. Copy text, and copy link as its second item. Write both
  flavours via `ClipboardItem`, falling back to `writeText` where that isn't
  available. Two mechanics that are not optional:
  - `ClipboardItem` accepts a **Promise** for its data, which is how Safari's
    user-gesture requirement survives any async work. Awaiting *before* the write
    makes iOS reject it silently — the first spec's shape invited exactly this.
  - `navigator.clipboard` needs a secure context. Fine on splatbook.app and the
    tailnet HTTPS front; hide the control where it's absent rather than shipping
    a button that does nothing.
  - Feedback: the label becomes "Copied" for ~1.5s, same word for both actions,
    with an `aria-live` announcement. Reserve the width so it doesn't reflow.

- `feat(reference)`: **attribution, non-optional.** The pack's licence says *"All
  creators retain the right to be identified as such. In all cases this notice
  must remain intact."* The first spec named the book and splatbook.app and
  omitted Joshua McCrowell entirely — backwards, and it proposed a preference to
  switch attribution off, against a licence that says "in all cases". The block:

  ```
  His Majesty the Worm — Chapter 1: The Basics
  © Joshua McCrowell, published by Exalted Funeral Press.
  Shared from splatbook.app/hmtw/reference/…
  ```

  Game-supplied, not hard-coded: it comes from the pack's own licence metadata
  through the `GameModule`, the same way `referenceSpoilers` and
  `referenceOmitCallouts` do. Stonetop's is CC BY-SA 4.0 and needs different
  words.

*Open when built: whether Zoom's rich paste keeps tables and nested lists, which
decides how hard the HTML flavour works. Worth pasting one real section into each
client before the format is fixed — the plain/rich split above came out of doing
exactly that, and guessing had it backwards.*

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
