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
slots), and the one-off city-location workarounds. Tower Gnostic's Scrabble
tiles are out of Crawlspace's jurisdiction and out of ours.

**Also out: save/restore.** Crawlspace has it; we don't need it. With no gear to
preserve, the whole of what a restore would carry is a handful of player names,
and retyping those is not a burden worth a feature. It also removes a genuine
hazard rather than merely declining a nicety — table state contains the undrawn
deck order, so an export handed to a client is the deck handed to a player,
defeating the per-seat projection through a download button. (Crawlspace looks
to have met the same wall: its save file restores players and gear, "not card
state or phase.")

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
`SCHEMA.md` documents it. No formulas, no rules constants — there are no rules
in this table to hold constants for.

### Commits

*Ordered so the pure, testable work comes first: commits 1–3 are plain
TypeScript with no dependency on seats, transport, or infrastructure, so there
is something real and reviewable while the shell questions are still being
answered. Nothing needs hardening until commit 7 puts a guest write on the
wire.*

1. `feat(hmtw)`: `content/hmtw/data/` deck definition, Zod schemas, SCHEMA.md —
   plus the new file in the pack's `manifest.json` `files` list and a `version`
   bump. The manifest is hand-written and the harness fails a file that is
   "listed in manifest but not found", so this is one commit's worth of detail
   that otherwise breaks CI on first contact with the pack.
2. `feat(hmtw)`: the card-table engine — zones, piles, seeded **server-side**
   shuffle, and move/flip/deal/return addressed **by slot** (naming a card only
   in a public zone). Carries a `schemaVersion` and a `migrateTable` from the
   first blob written, per the ground rule above: tables live for weeks, so a
   shape change during this very phase would otherwise break a table someone is
   mid-round on. Pure TS, test-first, with an old-shape fixture from the commit
   that first bumps it.

   **Ownership, since a table is not an entity type and the rule is written for
   those:** the shape is HMtW's, so HMtW owns `migrateTable`, exposed through
   the `cardTable` slot exactly as `entityTypes` expose theirs. The rows are the
   shell's, so the shell calls it on every read, and never inspects what comes
   back. Same division as `entities.data`.
3. `feat(hmtw)`: per-seat projection of state, and its leak tests. (The command
   stream's projection arrives with the stream, at commit 7, and extends these
   same tests — see there for why that half matters more.)
4. `feat(shell)`: `tables`/`table_seats` schema, room-token URLs, and table
   creation — **signed-in only**.
5. `feat(shell)`: guest seat identity — the signed cookie capability (reusing
   `AUTH_SECRET`), a `hooks.server.ts` handle that resolves a seat *without*
   calling `locals.auth()`, the seat list, the GM's admit/decline, the
   claimable-while-vacant GM seat, and GM re-seating with private zones carried
   across (a test, not a hope). This app has never set a cookie outside Auth.js;
   budget accordingly.
6. `feat(shell)`: the bounded limits — per-table command ceiling as a column
   increment, seat cap, pending-join cap, and the read budget. On the last:
   D1 bills per query, not per byte, so "just read the version column" is still
   one read per client per second and barely moves the number. The levers that
   work are **frequency and count** — adaptive cadence (quicker in Challenge,
   slower at rest), a pause on hidden tabs as `RollLog.svelte` already does,
   idle-table backoff, and returning only commands after the client's cursor so
   a quiet poll is small as well as rare.
7. `feat(shell)`: `table_commands`/`table_secrets`, the versioned command
   service (observed/expected version, request-hash idempotency), and the poll
   endpoint plus client sync loop behind the `TableTransport` seam. One
   transport, both hosts.

   **The command stream is projected per seat, exactly as state is.** This is
   the trap the first three drafts walked past: a poll returns *commands since
   your cursor*, so the sync channel is a second way out of the building, and a
   projection that only guards state guards the front door alone. A shuffle
   carrying a seed is the deck order in plaintext; a deal naming cards is every
   hand at once. So a shuffle reduces to a version bump with no payload, a deal
   emits one public fact ("seat 3 drew four") plus per-recipient rows in
   `table_secrets`, and every command type declares what each seat may see of
   it. Commit 3's leak tests extend to cover the wire, not just the store — a
   test that reads the projected state and never the projected stream would have
   passed against a design that leaked everything.
8. `feat(shell)`: the `GameModule.cardTable` slot, the mounted route at
   `/[game=game]/cards`, and the seat rail — which shows each seat's durable
   card face-up, since the table is entitled to know who is holding what.
   `docs/architecture.md` and `docs/adding-a-game.md` change **in this commit**:
   the ground rules require boundary docs to move with the boundary, and this is
   the commit that moves it.
9. `feat(hmtw)`: Decks mode — flip, zoom, reshuffle, Fool prompt, and the
   discard pane as a *source*: a card drags from it into any seat's durable
   slot, which is how a High Chant reaches the table. Spending is the reverse
   trip, back to the discard.
10. `feat(hmtw)`: Challenge mode — deal, hidden initiative, played/face-down
    zones, minor-action queue and simultaneous reveal, Sweep, callout strip, the
    Fool-was-dealt reshuffle prompt before the next deal (the Fool spans both
    modes; commit 9 covers only the flipped case), and the confirmed
    dump-to-discard on leaving, sparing the durable slots.
11. `feat(hmtw)`: undo and free handling — any card on the table moved or
    flipped by any seat, no legality check; hands stay owner-only. Includes the
    one rejection this design has: `expected_version` means whoever loses a
    simultaneous grab gets refused, and open reach makes that *likely* rather
    than rare, since "two people flip the AFK player's card" is both the
    motivating case and the collision case. It must read as "someone got there
    first" and re-sync silently, never as an error — a permissive table that
    scolds you is a broken promise.
12. `feat(shell)`: lazy expiry on read, plus the bounded opportunistic sweep.
13. `test(e2e)`: Playwright multi-context — two seats through a full round, with
    hidden information asserted hidden at every step. `e2e/campaigns.spec.ts`
    already has the multi-context pattern to follow.
14. `docs`: `/privacy` gains its guest-data section (the page's own header
    demands it whenever a migration stores personal data — so this rides with
    commit 4's schema if it can, and no later than here); CREDITS (Crawlspace as
    prior art, guild-book for the two patterns); CHANGELOG; pack docs; and the
    art basis in LICENSE.md.
15. `docs`: close phase 29 — move this section to [[App Implementation History]]
    verbatim, per the housekeeping rule, in the commit that closes it.

Fifteen commits, up from thirteen — nothing was added to the scope, the count
went up because commit 1 was three pieces of work wearing one bullet and the
phase had no closing commit. Treat it as a floor rather than an estimate: an
earlier draft said 25–30 in conversation and then produced a 17-commit list
without justifying the drop, which is exactly the arithmetic this project's
history punishes. For calibration, Origins 5.5e was 6 commits and 10,091 lines
*with no shell change*; this still has a shell slot and a new identity
mechanism, in a codebase that has never set a cookie of its own.

### Art — decided

Ship the provably public-domain colour set: Wikimedia Commons' 1909 first
edition, [Category:Rider-Waite tarot deck (Roses &
Lilies)](https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck_(Roses_%26_Lilies)),
80 files, complete at 22 majors + 56 minors, named `RWS1909 - 00 Fool.jpeg` /
`RWS1909 - Cups 01.jpeg`. The file-level tags are the point: PD-old-80-expired
(Waite, the copyright holder, died 1942) plus PD-US (published before 1 January
1931) — public domain in both jurisdictions this project cares about, with no
scan-level permission claim held by anyone.

**Make the provenance provable per card, not asserted.** The fetch step records
each file's Commons licence tag into the art manifest beside the hash and
dimensions, and the build fails if any of the 80 lacks a public-domain tag.
guild-book's pipeline already writes a licence manifest, so this is a field, not
a mechanism. That is what goes in the pack's LICENSE.md — a per-card basis
rather than a sentence claiming one.

*Deferred, not rejected: a black-and-white set.* Chris will source or derive one.
Keep the collection swappable exactly as guild-book's Amendment 3 did (a single
`COLLECTION` constant that the source map, output paths, and manifest all read).

*Not used, and why:* the steve-p.org scans (permission was confirmed on
2026-07-15, but to guild-book, and it does not travel) and Chris's Illustrator
SVG traces (`~/Desktop/Tarot/Rider SVG SouthForkSVG` — almost certainly fine,
since faithful reproductions of public-domain works carry no new copyright per
Bridgeman v. Corel and THJ v Sheridan [2023] EWCA Civ 1354, but a colour-to-ink
trace is a step further from a scan than either case addresses, and "almost
certainly" is a worse footing than a Commons PD tag when the alternative is
free).

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

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
