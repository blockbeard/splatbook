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

## Phase 33 — HMtW card table: what Session 14 found

*Filed 2026-11-26, from Session 14 of the Castle Automatic on 2026-11-25: the
first real game on the table, the GM and four players, two Bouts in about an
hour. The notes are the "Card table feedback" write-up of the session and the
group's Discord afterwards. It mostly worked: the private initiative, the
automatic count, "click a card to see what it pays for", the minor-action
prompts and the In play area were all named as wins. Olivia: "i understand it
more now than i have the last three sessions ive played!" Edmund: "even just
that, I feel like saved multiple dozens of minutes."*

*What went wrong is one crash, a handful of bugs, and the thing the Discord
picked up on: there is no way to play a talent, or to hand a card to someone.
Chris, in the Discord: "There definitely needs to be a way to do any legal
action."*

*The layout wishes (a sticky header, the play area by zone, the map at the
top) are not in this phase. They go into one design pass with Edmund, on
Olivia's advice not to let it become too many cooks. The polling and request
code is not in it either: Edmund is sending that as a series of PRs, and PR #1
was step 1 of 15.*

### What Session 14 found

**The crash.** At the end of Bout I's first minor actions Chris pressed Next.
Bonnie and Tatyana were both on Initiative 1, so the count rightly stayed on 1
for Tatyana's turn, but nothing on screen said so. Chris pressed Next again,
which skipped Tatyana, and the table answered "Worker exceeded resource
limits", then Cloudflare's 1102 ("CPU time per HTTP request 10 milliseconds").
After that the page said it was no longer taking cards. A refresh brought it
back with the game intact.

Three separate things are in that, and only one of them is the CPU limit:

1. **The second Next skipped a turn.** After Bonnie's turn was cleared, the
   count stayed on 1 for Tatyana, In play emptied and its Next went with it,
   and the GM's button in the guide line changed in place from "Next" to "Skip
   their turn". Nothing said why the round hadn't moved, so Chris pressed again
   "to see where it goes", and the press skipped Tatyana. The page was very
   likely up to date: `busy` drops a double click, and the reply to the first
   Next updates the page at once. `step-on` also carries nothing about what it
   is moving on from, so a press from a page a poll behind would do the same,
   but that is the smaller half.
2. **The page gave up on a table that was fine.** `sendCommand` turns any reply
   that is not the table's own JSON into `no-such-table`, so an HTML 1102 page
   reads as "This table is no longer taking cards." A fetch that throws never
   releases `busy`, so the page stops sending anything until a reload. That is
   what "stopped taking cards" was, and why a refresh fixed it.
3. **A request went over 10 ms of CPU.** Measured on 2026-11-26 (below), it is
   almost certainly the first request a fresh Worker serves, not any one
   command. Splatbook stays on Workers Free (Chris, 2026-11-26), so 10 ms per
   request is a design limit, not a bill to pay.

**The bugs.**

- **The deck came to 54 cards, not 57, after the Fool's reshuffle.** Two Test
  of Fate cards never went back. The fate pile is only shown in Decks mode, the
  end of a round doesn't clear it, and the reshuffle gathers only the deck and
  its discard, so a Test of Fate during a Challenge takes its card out of the
  game until the table is reset.
- **The GM couldn't turn an enemy's initiative over.** `show-initiative`
  already accepts a group; there is no button for one.
- **The Fool with its partner is hard to find.** It works ("Add a card to it",
  under the closed "Out of turn"), but Chris didn't remember it existing.
- **Everyone forgot to press Put it down / Play it.** Edmund: "we gotta move
  that." It sits in Your move, well away from the hand you just tapped.
- **Your own face-down card shows its rank, in Roman numerals.** A played 2
  showed "II", which read as 11, until it turned face up and showed "2".
- **"3 3" on the lion** was the book's stat line (Health 3, Defense 3) in the
  group's name, while the zone list in the scene shows Health only, as a bare
  number. Edmund read the Creatures panel correctly ("Defense is 0 of 3, health
  3 of 3"); the zone list is what misled.
- **Clarissa wondered whether her hand had been shuffled.** It is sorted by
  value, and nothing says so.
- **Tests of Fate took a second to appear for everyone**, and show the card's
  value only, with no attribute added.
- **The letters A to F were hard to keep track of.** There is no way to name a
  creature.
- **Nothing says which cards add your attribute** (Chris, 2026-11-26). The book
  is exact about it: "On your turn, your action's total value equals the card's
  face value _plus_ the associated attribute", and "A minor action's total value
  equals the card's face value". The Fool's extra turn adds it too. A face-down
  card goes by when it was put down: readied on your turn it adds the attribute
  when turned over, readied as a minor it is face value (ch.7, Facedown cards).
  The engine knows which, because a readied card's slot records `position`, but
  the play it becomes when used is just `kind: 'readied'`, so nobody can tell
  from the screen. Abilities stay out, so the table doesn't add anything; it
  only says which kind each card is.

**What the Discord asked for: talents and Counsel.** Eldritch had to play his
Counsel card as Tatyana's Recover, because there is no way to hand a card over.
Clarissa suggested a "path talent" option with a choice of how the card is
played. Olivia wanted just "Talent" with that choice, not a list of every
talent. Edmund found the full list too long to scroll every time. Chris
suggested a drop-down to pick which path's talents to show, none by default,
each adding buttons like the general actions. And Chris drew the line: no
character sheet, no abilities or favour, "to keep it closer to in person play".

Going through Chapter 5's talents for what they do with a card in a Challenge,
they come down to a few shapes, all but one of which the table already has:

| What the talent does with the card | Examples | The table today |
| --- | --- | --- |
| A named action on your turn, face up | Doom Eye's perfect shot, Gramarye | "Something else" |
| An action as a minor, with another suit | Two-handed Focus, Fight Dirty | Minor action (suits dim, never refuse) |
| An interrupt | Quick!, Counter-spell, Heavy Metal Machine | Out of turn |
| Discard any card for a miscellaneous action | Heavy Metal Machine | **Nothing** |
| Hand a card to another adventurer | Counsel | **Nothing** |

The rest (Monster Hunter, Ambusher, Aegis and so on) change a number, a Wound
or a notch, which the table leaves to the people at it. The gap is therefore
small: one "how is it played" choice, a discard, and handing a card over.

**A second face-down card**, the other half of the Counsel problem, is the
book's rule rather than a bug: "You may only have one facedown action at a
time" (ch.7, Facedown cards). The counselled card goes into the other player's
hand, so it never needs a second face-down slot.

### Measured (2026-11-26)

Two experiments, on Chris's laptop (Node 26, an M-series Mac). A Worker's CPU
is slower and its numbers will be higher. These say which path is heavy, not
how heavy it is on Cloudflare.

**Simulated rounds** (`src/lib/server/card-tables/cpu-sim.test.ts`): 300
rounds over 34 fights at a Session 14-sized table. That is 9,752 commands and
every poll that followed them, about 97,000 requests timed through the real
service code, with SQLite's own time taken off (on a Worker, D1 is I/O and
costs no CPU).

| Request | p50 | p99 | Max |
| --- | --- | --- | --- |
| A command (load, reduce, write, view) | 0.43 ms | 0.9 ms | 12.4 ms |
| A poll that finds a change (full view) | 0.20 ms | 0.6 ms | 8.8 ms |
| A poll that finds nothing (`204`) | 0.09 ms | 0.14 ms | 6.1 ms |

The steady state is twenty times under budget. The maxima are a dozen
requests in 97,000, scattered through the run: garbage collection, not any one
command. The double Next from Session 14 came up 95 times and cost no more than
any other step. With V8's optimising compilers off (the way code runs the
first time through), a command costs about 1 ms, and the first command of the
run cost 6.5 ms. Code that has never run is several times slower.

**A cold Worker.** The built Worker, bundled the way Wrangler bundles it and run
in Node with a stub D1, cold and then warm:

| | CPU |
| --- | --- |
| Startup (the bundle's top level) | 37.5 ms |
| The first card-table request | **63.7 ms** |
| The same request again | 1.0 ms |

esbuild wraps about 700 modules in lazy initialisers, so a route's modules are
first evaluated inside the first request that imports them. In the profile, the
largest share of that first request is building zod schemas when the game
registry loads. Each alone, cold: zod itself, 6.6 ms; HMtW's card table and
pack schemas, 5.5 ms more; **Stonetop's pack schemas, 14 ms more**. Those are
built on every cold card-table request, although a card table never reads them
(680 zod calls in `stonetop/pack-schemas.ts`). The PDF libraries are in the
bundle (2.3 MB) but load lazily, and never ran.

So the likeliest story for Session 14: a request landed on a fresh isolate and
paid tens of milliseconds of module loading. Cloudflare starts isolates often
for a table this quiet, spread over five players' locations. It happened once
in two hours, not on every cold start, so an overrun evidently isn't always
fatal; why some are and some aren't is Cloudflare's, and not documented. None of
this is proof. It is the one path that measures over budget, and the next game's
log tail is the check.

Cloudflare documents a separate limit for startup: a Worker gets 1 second to
parse and run its top level ([limits](https://developers.cloudflare.com/workers/platform/limits/),
raised from 400 ms in October 2025). Whether that time also counts against the
first request's 10 ms isn't documented, which is why commit 3 is checked on
Cloudflare rather than assumed.

### Adversarial review of Release A (2026-11-26)

Done the same day, against the code and Cloudflare's documentation. What it
changed:

- **The second Next.** The first draft blamed a stale page and fixed it with
  `from`. Reading `PlayArea.svelte` and `guide.ts` says otherwise: the page was
  current, and the button changed meaning in place. Commit 5 now leads with
  the tie wording and a named, quiet, briefly-ignoring Skip; `from` stays as
  the smaller half.
- **"Startup isn't charged to a request"** was stated as fact. Cloudflare
  documents startup as its own 1 s limit and says nothing either way, so the
  claim is gone and commit 3 depends on what the tail shows.
- **Commit 2 was lazy builders for 1,000 lines of schemas.** Nothing at run
  time reads the pack schemas, so the smaller change is not to import them.
- **The poll already survives a 1102**, so commit 4 only pins that with a test.
- **The picture upload** had dropped out of commit 1's measurements; it's back.
- **The fallback for commit 3** has to run inside `npm run build`, or Chris's
  deploy never sees it.
- Checked and left alone: `endRound` already does its discards first and the
  Fool's reshuffle last, so adding the fate pile to the discards (commit 6)
  puts its cards back in the deck with no reordering; the schema versions (v17 here,
  v18 and v19 in Releases B and C) don't collide; the zone list is where "3 3"
  misled (the Creatures panel is labelled already, and Edmund read it right).
- **Still unproven:** the cold-start story. Node is not a Worker, and the stub
  D1 means a page load wasn't measured. Commit 1's script and the next game's
  tail are how this phase finds out whether A1 fixed it.

### Decided

- **Stay on Workers Free** (Chris, 2026-11-26). Fix the CPU in code; don't
  raise the Paid plan unless 1102s become frequent.
- **No character sheet.** Talents are about how a card is played, never about
  what they add to a number (Chris, in the Discord).
- **Enemy stats stay shown by default**, with the GM's switch to hide them
  (phase 32). Edmund likes not knowing; his GM can untick it.
- **The layout waits for the design pass with Edmund**, except the Play it
  button, which two people forgot in one session and needs a fix now.

### Decided after filing (Chris, 2026-11-26)

1. **The "how is it played" choice and Counsel first**, then talents by path
   (commits 13, 14 and 15, in that order).
2. **Olivia's "draw" meant handing a card to a player**, which is commit 14.
   There is no draw option.
3. **Tests of Fate stay the card's value.** "We decided to keep abilities out of
   it for now."
4. **The Bout II picture wasn't a bug.** Chris couldn't find the art, and the
   zone list carried the Bout well enough without it.
5. **Each play says whether it adds your attribute** (commit 9), added the same
   day.

### The design

**Release A: nothing stops the table.** Needed before the next session. It comes
in two halves, so the first can ship on its own if time is short: A1 (commits 1
to 5) is the crash, A2 (6 to 12) the bugs.

*A1: the crash.*

1. `test(card-table)`: **the measuring tools.** `cpu-sim.test.ts` (written on
   2026-11-26, skipped unless `CPU_SIM=1`), plus `scripts/cold-start.mjs`. The
   script builds the Worker bundle with esbuild the way Wrangler does, stubs
   `cloudflare:workers`, D1 and `ASSETS`, and prints the startup cost and the
   first, second and third request's CPU for the sync, commands and page
   routes. It does that signed out and with a signed-in session cookie, since
   Auth.js decodes a JWT on every signed-in request and the simulation doesn't
   cover that, and it reports the first request twice: straight after loading
   the bundle, and after `server.init` has finished, which is the number commit
   3 is trying to move. The simulation gains a picture upload (a 1 MB WebP
   through the picture endpoint's handler, with its 1.4 MB JSON body), which the
   first run left out. Both print tables. Neither is a CI gate, because timings on a
   shared runner are noise. The numbers above go in the commit message.
2. `perf(games)`: **the app stops loading pack schemas.** Nothing at run time
   reads them: packs are checked by `npm run validate:packs` and the tests, and
   the runtime trusts what they passed (`stonetop/pack/gm.ts`, `steading.ts`).
   They reach the server only because each game module hands `schemaFor` to the
   registry (`GameModule.packSchemas`), and that import builds every schema.
   `src/lib/games/schemas.ts` already registers them for the tooling on its own,
   so `packSchemas` leaves `GameModule` and `registerGame`, and only
   `schemas.ts` imports `pack-schemas.ts`. The other importers (Stonetop's
   wizard, `pack/inserts.ts`, `export.ts`) take types only, which vanish in the
   build. Separately, the card table's command schema (110 zod calls in
   `hmtw/card-table.ts`) is built the first time a command is reduced, so the
   sync route never builds it. Tests: `registry.test.ts` loses its
   `packSchemas`, the pack tests import `schemas.ts`, and a new test checks that
   the built server chunk for the registry contains no pack schema (by a
   string from one, in `.svelte-kit/output`, after a build). Measured with
   commit 1's script: about 20 ms off the first card-table request, and off
   every other cold route that touches the registry.
3. `perf(cloudflare)`: **load the game registry at startup.** An `init` hook in
   `hooks.server.ts` imports `$lib/games`, so a new isolate evaluates the
   registry, zod included, before it serves anything. SvelteKit runs `init` from
   `server.init`, which the adapter's `_worker.js` calls at top level. These
   tools can't show whether that finishes during Cloudflare's startup phase
   (a 1 s budget, not charged to a request) or inside the first request. So
   this commit is checked on Cloudflare: deploy, open a table, and read the
   first requests' CPU time in `wrangler pages deployment tail --format json`.
   If it hasn't moved, revert it and take the fallback: a post-build step that
   adds a static import of the registry chunk to `_worker.js`, which esbuild
   then evaluates at the bundle's top level. That step has to live in the
   `build` script, run only when `ADAPTER=cloudflare`, because Chris's deploy
   is `ADAPTER=cloudflare npm run build` and nothing else. The comment in `hooks.server.ts`
   warns that importing the registry there instantiates it twice. The commit
   checks for that in `npm run dev` and in the built output (one registration
   each). If the tail then shows a table's first *command* still near the limit
   (code that has never run is several times slower, above), the same `init`
   can reduce a canned round on a scratch table once, so the engine's functions
   are compiled before anyone plays. That is only if the numbers ask for it.
4. `fix(card-table)`: **a hiccup isn't a closed table.** `sendCommand` tells a
   reply from the table (JSON with a `reason`, at 404, 409, 410 or 422) from
   anything else: a 5xx, Cloudflare's HTML error page, or a network failure
   (the fetch throws). Anything else becomes `reason: 'unanswered'`, which the
   page reads as "The table didn't answer. Try again.". It catches up and
   leaves every control working, and `busy` is released in a `finally`. Only a
   real 404 or 410 says the table is closed. The poll needs nothing: `fetchSince`
   already treats any non-OK reply as "nothing new", and a fetch that throws is
   a dropped poll in the transport. A test pins that, since the 1102 page is
   exactly that case. Unit tests in
   `client.test.ts` drive each reply shape. A browser spec covers the page's
   `run`: it answers one command with a 503 HTML page (Playwright's `route`)
   and checks that the next one goes through.
5. `fix(hmtw)`: **a tie says so, and Skip is never where Next was.** Three
   parts, the first two of which would have saved Tatyana's turn:
   - **The tie, in words.** When the count stays on a number because someone
     else is on it, the guide says so: "Bonnie and Tatyana are both on 1.
     Bonnie's done; Tatyana's turn." The announcer says it too.
   - **Skip is named and quiet.** The GM's override in a turn reads "Skip
     Tatyana's turn" (the name, not "their"), in the quiet button style, never
     the primary one. When a step changes, the guide's button ignores presses
     for a moment (about 0.8 s), so a press aimed at the button that was just
     there can't land on the one that replaced it.
   - **Next knows what it's moving on from.** `step-on` gains an optional
     `from: { step, count, up }`, the round as the page saw it. The server
     refuses a mismatch as `rejected (moved-on)`, which the page reads as "The
     round has moved on" (it joins `wrong-step` in that list). Every button that
     sends `step-on` sends it. Without `from`, as from an old page, it behaves as
     now. This covers a press from a page a poll behind, or two people running
     the table with nobody in the GM seat.

   Tests:
   - a `steps.test.ts` case replays Session 14, a stale second Next refused;
   - guide tests for the tie wording and the named Skip;
   - a component test that a press within the moment after a step change does
     nothing.

*A2: the bugs.*

6. `fix(hmtw)`: **the Test of Fate pile in a Challenge.** ChallengeMode shows
   the fate pile beside the decks when it has cards, face up, with a Clear
   button (the existing `clear-fate`). `endRound` discards it to the player
   discard before the Fool's reshuffle, so the reshuffle gathers it. Tests:
   - a round with a Test of Fate and the Fool ends with all 57 player cards in
     the deck and the discard;
   - `invariants.test.ts` gains Tests of Fate in its random runs (every card
     somewhere, exactly once).
7. `feat(hmtw)`: **the GM turns over an enemy's initiative.** A "Turn over"
   button on each group's face-down initiative in In the fight, for the GM only.
   It sends the existing `show-initiative` with the group as holder. A browser
   check confirms a player then sees the card.
8. `fix(hmtw)`: **the small things.**
   - Your own face-down card shows its value ("2") where it shows the rank today
     (the "mine" mark in `Card.svelte`).
   - The scene's zone list shows "Health 3 · Defense 3", labelled, where it shows
     a bare Health number now.
   - The hand's heading says "Sorted by value".
9. `feat(hmtw)`: **which plays add your attribute.** `Play` gains `adds: boolean`:
   - true for a turn, and for an out-of-turn play (the Fool's extra turn, and
     talent interrupts until the book says otherwise);
   - false for a minor action;
   - for a readied card, decided by the `position` it was put down at (`turn`
     adds, `minor` doesn't). The position is carried from the facedown slot onto
     the play in `useReadied` and `revealFacedown`.

   In play shows "+ attribute" or "face value" under each card, and a readied
   card says which while it is still face down. Schema v17: a play stored before
   it has no `adds`, and shows neither. Tests cover each kind, the migration and
   the Fool.
10. `feat(hmtw)`: **the Fool up front.** Holding the Fool, Your move leads with
    "Play the Fool", which picks the Fool and starts adding its partner, instead
    of leaving it inside the closed "Out of turn".
11. `feat(hmtw)`: **the button by the hand.** Once a card is picked, a bar pinned
    to the bottom of the viewport carries the card's name, the chosen action and
    the one button that sends it (Play it, Put it down or Ready it). It never
    covers the hand: the page gains bottom padding the height of the bar while it
    shows. It is the same control as in Your move, not a second one, so there is
    one thing to press. The a11y spec gains the state, and the phone spec checks
    that it stays clear of the hand at 390px. The design pass may redo it.
12. `docs`: **Release A's changelog and handout.** The CHANGELOG, and the player
    handout: the Test of Fate pile, "+ attribute" and "face value", the Fool,
    the bar, and what "The table didn't answer" means.

**Release B: any legal action.**

13. `feat(hmtw)`: **"Something else" becomes "A talent, or something else".** A
    name, typed, and how the card is played: Play it now (face up, on your turn),
    Ready it (face down, above), As a minor action (face down, below), Out of
    turn (an interrupt), Discard it (a miscellaneous action), or Hand it to
    someone (commit 14). Each is an existing command except the last two. In
    play labels it with the name.
14. `feat(hmtw)`: **handing a card over (Counsel).** A `give-card` command: from
    your hand to another adventurer's, any time in a Challenge, with the action
    you counsel and whether it may interrupt (the Resolve was spent). The card
    arrives labelled "From Eldritch: Recover". Playing it picks that action, and
    with the interrupt it's offered under Out of turn. Everyone sees that a card
    was handed over and for what; only the giver and the receiver know which
    card. The label lives in a `counsel` map keyed by card, projected only to
    those two. Schema v18, with a migration test.
15. `feat(hmtw)` + `content(hmtw)`: **talents by path**, after 13 and 14.
    `talents.json` in the pack lists, for each path, the talents with a card
    shape in a Challenge: the name, the default "how", the suits, a one-line
    summary written for the table, and a link to its Chapter 5 heading. Your
    move gains "Show talents for: none, Swords, Pentacles, Cups, Wands", none by
    default and remembered on the device. A chosen path adds its talents as
    buttons beside the actions. SCHEMA.md and `pack-schemas.ts` grow with it.

**Release C: the GM's table.**

16. `feat(hmtw)`: **naming a creature.** The GM can give a creature a name, shown
    as "Red Cloak (A)"; the letter stays, for the count and for anyone who knew
    it by that. Schema v19 with a migration test.
17. `fix(card-table)`: **Tests of Fate appear sooner.** Outside a Challenge the
    table polls every 3 seconds. Poll at the busy cadence for a minute or two
    after any change. This is the poll cadence, so ask Edmund first: it may be
    one of his steps.
18. `docs`: **close phase 33.** The player handout gains talents, handing a card
    over and naming creatures; the CHANGELOG; this section to the history.

**Guards.** The a11y spec stays the floor and gains a state for the talent
choice, the handed card and the pinned bar. The next real session is the test,
as Session 14 was for phase 32. Each release builds, type-checks and passes
lint, unit and browser tests before it's merged.

### Not in this phase

- **The layout pass with Edmund.** The wishes so far: a sticky header with the
  round, initiative and whose turn it is (Edmund); the play area in columns by
  zone, sketched before it's coded (Edmund, with Clarissa's worry about cards
  jumping when people move); the map and zones at the top, cards below
  (Clarissa); Olivia's view filling only two-thirds of her screen height; enemies
  on one line and players on another (Chris); each player pinning sections to
  the top (Chris).
- **The polling and request code**: Edmund's PRs. Commit 17 asks him first.
- **Workers Paid**, declined.
- **Phase 30's items** (a player who wanders off, room codes) and phase 31's
  stat-block links.
- **Table talk that isn't the app's**: treasure, healing costs, physical decks,
  fewer minor actions, how many players per session.

### Considered and rejected

**Replacing zod on the card table.** zod costs 6.6 ms to load cold, and the card
table could check its commands by hand. But it is the project's one validation
library, and loading it at startup (commit 3) costs a request nothing. Revisit
only if commit 3 fails and its fallback does too.

**Lazily building each pack schema.** Considered for commit 2 and dropped: the
app doesn't need the pack schemas at all, so not importing them is smaller and
complete.

**Automating each talent.** It would need the character sheet Chris ruled out,
and the book's talents mostly change numbers the table already leaves to
people. The "how" choice makes them all playable without the table knowing
what they do.

**A second face-down slot for Counsel.** The book allows one face-down action
at a time. A counselled card goes into a hand, where the rule already allows it.

**Refusing an off-suit card for a talent.** Suits dim, never refuse, as in
phase 32. Two-handed Focus and Fight Dirty are exactly the cases where the
"wrong" suit is right.

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
