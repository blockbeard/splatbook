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

1. **The second Next skipped a turn.** `step-on` carries nothing about what
   it is moving on from, so a second click, or a click from a page a poll
   behind, acts on whatever the round has become. At a tie it skips the second
   person on the number.
2. **The page gave up on a table that was fine.** `sendCommand` turns any reply
   that is not the table's own JSON into `no-such-table`, so an HTML 1102 page
   reads as "This table is no longer taking cards." A fetch that throws never
   releases `busy`, so the page stops sending anything until a reload. That is
   what "stopped taking cards" was, and why a refresh fixed it.
3. **A request went over 10 ms of CPU.** Which one isn't known yet. The engine's
   commands run in under a millisecond, so the cost is around them: loading
   and migrating the table's state, projecting it, the first request on a cold
   route, or a picture upload. Splatbook stays on Workers Free (Chris,
   2026-11-26), so 10 ms per request is a design limit, not a bill to pay.

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
- **"3 3" on the lion** read as Health and Defense with no labels, while the
  zone panel shows Health only.
- **Clarissa wondered whether her hand had been shuffled.** It is sorted by
  value, and nothing says so.
- **Tests of Fate took a second to appear for everyone**, and show the card's
  value only, with no attribute added.
- **The letters A to F were hard to keep track of.** There is no way to name a
  creature.

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

### Decided

- **Stay on Workers Free** (Chris, 2026-11-26). Fix the CPU in code; don't
  raise the Paid plan unless 1102s become frequent.
- **No character sheet.** Talents are about how a card is played, never about
  what they add to a number (Chris, in the Discord).
- **Enemy stats stay shown by default**, with the GM's switch to hide them
  (phase 32). Edmund likes not knowing; his GM can untick it.
- **The layout waits for the design pass with Edmund**, except the Play it
  button, which two people forgot in one session and needs a fix now.

### For Chris to decide

1. **Talents: the "how" choice first, the path buttons after?** I'd build the
   choice (commit 10) and Counsel (commit 11) first, since together they make
   every talent playable. The path drop-down (commit 12) is a convenience on
   top, and needs the pack to list each talent's card shape and a one-line
   summary.
2. **What did Olivia mean by "draw"?** Her options were "play, place, draw". No
   talent in Chapter 5 draws a card during a Challenge (High Chant takes cards
   from the discard, at Camp). "Hand it to someone" may be what she meant.
3. **Tests of Fate with an attribute.** Leave them as the card's value, with the
   player saying the total (my recommendation, in line with no character sheet),
   or add an optional "+ attribute" box on the fate pile?
4. **The lost Bout II picture.** Did it go up and then vanish, or was it never
   put up? If it vanished, that's a bug for Release A.

### The design

**Release A: nothing stops the table.** Needed before the next session.

1. `test(hmtw)`: **measure first.** Build a table the size of Session 14's (the
   GM, four players, three enemy groups with six creatures, a picture, two
   rounds of events) and time each request path through the service on node:
   `step-on` through `loadTable`, `runCommand` and `viewFor`; a changed poll for
   each seat; the picture PUT. Include the exact sequence from the session (a
   tie on 1, minors answered, Next, Next). Node is faster than a Worker, so the
   numbers compare paths against each other rather than against 10 ms. They go
   into this plan. Chris also runs the log tail at the next game, to catch the
   one that goes over.
2. `fix(card-table)`: **a hiccup isn't a closed table.** `sendCommand` tells a
   reply from the table (404, 409, 410, 422 with JSON) from anything else (a
   5xx, an HTML error page, a network failure). Anything else says "The table
   didn't answer. Try again.", catches up, and leaves every control working;
   `busy` is released in a `finally`. Only a real 404 or 410 says the table is
   closed. A unit test drives each case through the page's `run`.
3. `fix(hmtw)`: **Next knows what it's moving on from.** `step-on` carries the
   step, the count and who is up when it was pressed. The server refuses a stale
   one as `already-moved-on`, which the page reads as "The round has moved on".
   At a tie, the guide names both people and says whose turn it is now:
   "Bonnie and Tatyana are both on 1. Tatyana's turn." A `steps.test.ts` case
   replays the session.
4. `perf(hmtw)`: **cut whatever commit 1 finds over budget.** I can't name it
   before measuring. If it's the state, migrate only when the stored
   `schemaVersion` is behind, and project once per request rather than once per
   question. If it's the picture upload, send the bytes as the body rather than
   a 1.4 MB JSON string. If nothing stands out, say so here and leave it to the
   tail.
5. `fix(hmtw)`: **the Test of Fate pile in a Challenge.** Shown beside the decks
   in Challenge mode, with its cards and a Clear button. The end of a round
   discards it to the player discard, so the Fool's reshuffle gathers it.
   `invariants.test.ts` gains a run that turns over Tests of Fate through a
   round with the Fool and checks every card is somewhere, exactly once.
6. `feat(hmtw)`: **the GM turns over an enemy's initiative.** A "Turn over"
   button on each group's initiative in "In the fight", for the GM only.
7. `fix(hmtw)`: **the small things on a card.** Your own face-down card shows its
   value ("2"), never its rank. A creature reads "Health 3 · Defense 3". The
   hand says "Sorted by value".
8. `feat(hmtw)`: **the Fool up front.** Holding the Fool, Your move leads with
   "Play the Fool", which picks it and starts adding its partner, instead of
   leaving it inside the closed "Out of turn".
9. `feat(hmtw)`: **the button by the hand.** Once a card is picked, a bar pinned
   to the bottom of the screen carries the card, the chosen action and the
   button (Play it, Put it down, Ready it). It is the smallest change that puts
   the button where your finger is; the design pass may redo it.

**Release B: any legal action.**

10. `feat(hmtw)`: **"Something else" becomes "A talent, or something else".** A
    name, typed, and how the card is played: Play it now (face up, on your turn),
    Ready it (face down, above), As a minor action (face down, below), Out of
    turn (an interrupt), Discard it (a miscellaneous action), or Hand it to
    someone (commit 11). Each is an existing command except the last two. In
    play labels it with the name.
11. `feat(hmtw)`: **handing a card over (Counsel).** A `give-card` command: from
    your hand to another adventurer's, any time in a Challenge, with the action
    you counsel and whether it may interrupt (the Resolve was spent). The card
    arrives labelled "From Eldritch: Recover". Playing it picks that action, and
    with the interrupt it's offered under Out of turn. Everyone sees that a card
    was handed over and for what; only the giver and the receiver know which
    card. The label lives in a `counsel` map keyed by card, projected only to
    those two. Schema v17, with a migration test.
12. `feat(hmtw)` + `content(hmtw)`: **talents by path** (decision 1).
    `talents.json` in the pack lists, for each path, the talents with a card
    shape in a Challenge: the name, the default "how", the suits, a one-line
    summary written for the table, and a link to its Chapter 5 heading. Your
    move gains "Show talents for: none, Swords, Pentacles, Cups, Wands", none by
    default and remembered on the device. A chosen path adds its talents as
    buttons beside the actions. SCHEMA.md and `pack-schemas.ts` grow with it.

**Release C: the GM's table.**

13. `feat(hmtw)`: **naming a creature.** The GM can give a creature a name, shown
    as "Red Cloak (A)"; the letter stays, for the count and for anyone who knew
    it by that. Schema bump with a migration test.
14. `fix(card-table)`: **Tests of Fate appear sooner.** Outside a Challenge the
    table polls every 3 seconds. Poll at the busy cadence for a minute or two
    after any change. This is the poll cadence, so ask Edmund first: it may be
    one of his steps.
15. `docs`: **close phase 33.** The player handout gains talents, handing a card
    over and the Fool; the CHANGELOG; this section to the history.

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
- **The polling and request code**: Edmund's PRs. Commit 14 asks him first.
- **Workers Paid**, declined.
- **Phase 30's items** (a player who wanders off, room codes) and phase 31's
  stat-block links.
- **Table talk that isn't the app's**: treasure, healing costs, physical decks,
  fewer minor actions, how many players per session.

### Considered and rejected

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
