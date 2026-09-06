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

## Phase 29 — HMtW: a shared card table

*Filed 2026-09-06. Prompted by [Crawlspace](https://worm.jmac.org/) (Jason
McIntosh) — a free, well-made virtual card table for HMtW that is closed source
with no repo, so there is nothing to fork. A clean-room build is squarely inside
the book's grant (mechanics and game text may be reused freely); Crawlspace's
code, assets, and docs prose are not ours to copy, and its docs were read for
**what a card table needs**, not for how it does it. Credit it as prior art on
`/credits` when this ships.*

*The material fact found while planning: **guild-book already built this.** Chris's
fork (`~/Documents/guild-book`, upstream `arrowedisgaming/guild-book`, GPL-3.0,
SvelteKit 2 + Drizzle + D1) ships a live shared tarot table with a synchronised
Challenge phase, per-actor projections, a versioned command log, and a
deterministic tarot art pipeline. Splatbook is GPL-3.0-or-later, so the engine
ports with attribution. This phase is therefore a **port plus a new shell**, not
a from-scratch build — which also changes the risk profile: the subtle part
(hidden information and command concurrency) arrives already tested.*

### Scope — deliberately not Crawlspace parity

Two modes over **one persistent deck state**:

- **Decks** — flip the top card to discard, open a discard pane, zoom a card,
  GM reshuffle, automatic reshuffle when a pile empties, Fool-flipped prompt.
- **Challenge** — deal hands, face-down initiative visible only to its owner,
  played and face-down zones, minor actions queued then revealed
  simultaneously, Sweep, an initiative callout strip with ±, and per-step undo
  after Reveal and Sweep.

The deck is table state; the modes are two views onto it, and moving between
them never resets the piles.

**Out of scope, decided:** the Crawl/City/Camp procedure panels (a card flip
is a card flip — those phases need no dedicated UI), the whole gear/inventory
model (notches, flickers, lit status, hands/belt/pack slots), and the
one-off city-location workarounds. Tower Gnostic's Scrabble tiles are out of
Crawlspace's jurisdiction and out of ours.

### Decisions (Chris, 2026-09-06)

- **Access: standalone token-URL tables with guest seats.** A `tables` row with
  an invite token; a guest claims a seat behind a signed cookie capability, no
  account required; a signed-in user gets their real identity. This deliberately
  does *not* force campaigns onto HMtW (which contributes no entity types, and
  the shell gates campaign creation on that — `campaigns/+page.server.ts:33`,
  `+layout.svelte:28`). Optional "attach this table to a campaign" is a later
  commit, not a prerequisite.
- **Transport: one protocol, two adapters.** A Durable Object + WebSocket
  adapter for Cloudflare; an in-process WebSocket adapter for `adapter-node` on
  atlas. DOs are Cloudflare-only and `wrangler.toml` is explicit that the atlas
  deployment ignores that file entirely — a DO-only design would quietly demote
  atlas from staging soak to partial mirror. The engine and UI see only the
  interface.
- **Engine: port from guild-book, don't re-derive.**

### The port

| From guild-book | Lines | Fate |
|---|---|---|
| `src/lib/engine/session/*.ts` (state, zones, reducer, card-commands, private-transfer, projection, invariants, shuffle, result) | ~2,100 | port |
| `src/lib/engine/session/procedures/challenge/*` minus `modifiers.ts` | ~3,500 | port |
| `challenge/modifiers.ts` | 1,192 | **drop** — derives modifiers from guild-book's character model; HMtW-in-Splatbook has no characters |
| `src/lib/types/session.ts`, `types/common.ts` | ~630 | port, trimmed |
| `tests/unit/session/challenge/*` (13 files) | ~4,900 | port minus `modifiers.test.ts` |

Lands in `src/lib/games/hmtw/engine/` — pure TS, no UI or DB imports, per the
layer rule. guild-book's own `tests/unit/session/import-boundaries.test.ts`
enforces the same discipline; port that guard too.

**Not ported:** the persistence and route layers. guild-book's table hangs off
campaigns, `play_sessions`, content-pack digests, and runtime content ids — a
much heavier model than a token-URL table needs.

**Attribution:** a `CREDITS`/`LICENSE` note naming guild-book and Arrowed, since
this is derived GPL-3.0 work, not merely inspired-by.

### Shell changes forced — the extraction moment

The sequencing note said the test of the framework is whether game #2 touches
only its own pack and module, and that a forced shell change is the moment to
extract. This forces one, with two real games in hand:

- `GameModule` gains a slot for a **live shared surface**: the shell owns
  transport, seating, persistence, and per-seat projection dispatch; the game
  owns the deck definition, the reducer, and every rendered string.
- The **server runs game engine code**. Precedent exists — `entityTypes.pdf`
  already does — but this is the first time a reducer and a `project(state,
  seat)` run per request. Hidden information is a server-side guarantee, not a
  UI one: a face-down card's identity must never reach a seat not entitled to
  it. guild-book solves this with `campaign_event_secrets` (per-recipient
  payloads keyed to an event) and one combined projection loader per poll;
  keep both shapes.
- **New tables:** `tables`, `table_seats`, `table_commands`, `table_secrets`.
  The command log carries guild-book's optimistic-concurrency columns —
  `client_observed_version`, `expected_version`, and a `request_hash` for
  idempotency — against a versioned public-state blob.
- **First anonymous-writable surface on a public host.** Guest seats mean rate
  limiting, a table cap, and a retention policy are launch requirements, not
  polish.

### Content pack

HMtW has no `content/hmtw/data/` yet — only generated `rules/`, which is
never hand-edited. This phase creates one (hand-authored, like Stonetop's),
holding the deck definition (suits, ranks, values, the Fool's borrow into the
player deck), the Fool's fixed interrupt constants, and every string the table
renders. Zod schemas join `hmtw/pack-schemas.ts`; a `SCHEMA.md` documents it,
same as Stonetop's.

### Commits, roughly

1. `feat(shell)`: `tables`/`table_seats` schema + token-URL creation and the join/claim-a-seat flow.
2. `feat(shell)`: guest identity — signed cookie capability bound to the invite token.
3. `feat(hmtw)`: `content/hmtw/data/` deck config + schemas + SCHEMA.md.
4. `feat(hmtw)`: port the session engine layer (state, zones, reducer, card-commands, shuffle) with its tests.
5. `feat(hmtw)`: port private-transfer + projection + invariants, with the import-boundary guard.
6. `feat(shell)`: `table_commands`/`table_secrets` + the versioned command service (expected-version, request-hash idempotency).
7. `feat(shell)`: `TableTransport` interface + the adapter-node in-process WebSocket adapter.
8. `feat(cloudflare)`: the Durable Object adapter + binding; both adapters against one protocol test.
9. `feat(shell)`: `GameModule` live-surface slot; the generic table route and seat rail.
10. `feat(hmtw)`: Decks mode — flip, discard pane, zoom, reshuffle, Fool prompt.
11. `feat(hmtw)`: port the Challenge engine (deal, initiative, fool, turns, transfers) with its tests.
12. `feat(hmtw)`: Challenge UI — hands, initiative placement, played/face-down zones.
13. `feat(hmtw)`: simultaneous minor-action reveal, Sweep, callout strip.
14. `feat(hmtw)`: undo after Reveal and Sweep; the confirmation gates on New Round and End Challenge.
15. `feat(shell)`: retention policy + table cap + rate limiting on the guest write path.
16. `test(e2e)`: Playwright multi-context — two seats, hidden information stays hidden.
17. `docs`: CREDITS attribution (guild-book/Arrowed, Crawlspace as prior art), CHANGELOG, pack docs.

Call it 17 commits before it is worth showing anyone, gear excluded. That is a
phase on the scale of a game module, not a side quest.

### Open questions — settle before commit 1

1. **Card art provenance is unresolved, in all three candidate sources.** The
   SouthFork SVGs (`~/Desktop/Tarot/Rider SVG SouthForkSVG`, 78 files, 16 MB,
   ~220 KB each) are unattributed traced path art with no licence metadata —
   they would optimise well with svgo, but the provenance needs establishing.
   guild-book's RWSa scans carry Chris's own warning in
   `scripts/fetch-rwsa-tarot.sh`: the steve-p.org images are that site owner's
   cleaned-up scans and the page asks for permission by e-mail — "fine for
   private/dev use; get permission before shipping them in a public build," a
   note still outstanding. And the worm card backs composite
   `scripts/tarot-art/adherent-logo.png`, whose origin must be confirmed as
   original: the book's grant excludes art outright. The 1909 deck itself is
   public domain (Smith d. 1951); the question is which *scan or trace* we
   ship. Fallback if none clears: original SVG/typographic faces.
2. **Retention.** Crawlspace keeps a table ~6 weeks with a save-to-file escape
   hatch. Pick a number, and decide whether an export exists at all.
3. **Divergence from guild-book.** Two GPL forks of one engine will drift. Worth
   deciding early whether the engine eventually becomes a shared package, or
   whether these are simply two apps that once shared a starting point.

### Considered and rejected

- **Cloning Crawlspace.** No repo, no licence. Clean-room from the book only.
- **Writing the Challenge engine fresh.** Cleaner fit to Splatbook's much
  simpler model, but re-derives the exact logic most likely to hide subtle bugs,
  when a tested implementation exists under a compatible licence.
- **Extending guild-book instead of building here.** A real option — it is
  already an HMtW app with this feature. Rejected because the table belongs next
  to the reference the table already has open, and because Splatbook's
  reference-only HMtW is the thing people are actually pointed at.
- **Polling, like guild-book's ~1s `GET /sync`.** Proven at a real table and
  host-agnostic, but drag-and-drop deserves push.
- **Campaign-attached tables.** Would reuse invite tokens, roles, and the roll
  log almost for free, but forces campaigns onto a game that has none and puts
  an account between a player and their seat.
- **Full Crawlspace parity.** The gear model alone is a phase; city/camp panels
  add UI for something a card flip already covers.

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
