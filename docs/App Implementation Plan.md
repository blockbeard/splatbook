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

## Phase 31 — HMtW card table: zones, creatures, and the rules at hand

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

## Phase 30 — HMtW card table: what playing it decides (parked)

**Parked until Chris has run a real game on it.** Everything here is a question
the built thing raised and that a session will answer better than an argument
will. Nothing in this list is committed to; the point of writing it down is that
it stops being carried around in someone's head.

### 1. A player who wanders off, and no way to see them out

Somebody joins, plays half a fight and vanishes, and their seat sits there
holding cards. There is no control for it: "Turn away" is offered for a seat
that is *waiting*, and nothing removes one that is already in.

The server can already do it — `removeSeat` is GM-only but takes any seat id and
does not check status — so this is a missing button rather than a missing
mechanism. **But do not just add the button**, because the engine's half is
wrong underneath it:

```
export function removeSeat(table, seat) {
  const zones = Object.fromEntries(Object.entries(table.zones).filter(([, z]) => z.owner !== seat));
  ...
```

The seat's zones go, and every card in them goes with them — out of the game,
not to a discard. A reshuffle gathers a deck's own discard, so those cards do
not come back until someone resets the table. A GM who kicks a player mid-fight
would quietly shorten the deck by four cards.

So the real question is the one the sweep already answers for a round: **where do
a leaver's cards go?** Almost certainly the discard for their deck, the way
`endRound` empties a hand — but that is a table decision, which is exactly why
`syncSeats` refuses to make it on its own today.

Worth deciding at the same time: does a kicked seat's *name* go immediately
(it is the one personal thing a table holds), and can a player leave voluntarily
rather than only be removed?

### 2. Room codes, and what a seat is proved by

Chris is not sold on the cookie. Worth separating, because "a code like
playingcards.io" is two changes and only one of them is about cookies:

- **The room's name.** Today a table is a UUID in the URL — unreadable aloud,
  fine to paste. A short code would be better over voice chat and worse to guess
  against, so it needs its own rate limit and a bigger alphabet than four digits.
- **What proves a seat is yours.** Today a cookie holds a per-seat secret, so a
  refresh keeps your hand. A code you are shown and can type would let you
  reclaim a seat *from another device or browser*, which the cookie cannot do —
  it is a capability the cookie lacks rather than a replacement for it.

The two compose: a short room code to get in, and the cookie as the convenience
path with a typed seat code as the fallback. Do the second only if playing
actually shows the cookie failing; the privacy page currently promises the
cookie says nothing about who you are, and a code that a person keeps is not
obviously better for them than one a browser keeps for them.

### 3. Housekeeping noticed on the way past

`CHANGELOG.md`'s Unreleased section has grown eight `###` subsections — Added,
Fixed, Changed, Fixed, Changed, Added, Fixed, Fixed — where Keep a Changelog
wants one of each. It predates this phase (six before it started) and every
release since has appended rather than merged. Tidying it is a mechanical move
of a few hundred lines and should be its own commit, not a rider on one that
happens to touch the file.

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
