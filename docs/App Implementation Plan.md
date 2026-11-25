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

## Phase 32 — HMtW card table: one turn at a time

*Filed 2026-11-25, from the first live test: Chris as GM and three players on
splatbook.app, worked down the checklist in
`GM Notes/Card Table Test — 2026-11-25.md` in the campaign vault, with his
notes under each step. Zones, the picture, creatures, Health, the action
summaries and the rule links all worked. What did not work is the round
itself: anybody could put any card anywhere, so nobody could tell what was
going on. In Chris's words: "I like the idea we could touch each others cards
but it makes it too hard to know what is going on."*

*An adversarial review on the day it was filed changed the design in several
places: conflicts, how an initiative card turns over, the Fool and readied
cards on other people's turns, who may run the round, and what hiding Health
really hides. Those changes are folded in below, and Chris's answers to the
questions it raised are in "Decided after the review".*

*It sits first because it is the next work. Phase 31 is complete apart from
its commit 13 (stat-block links, moved to "Not in this phase" below) and its
closing commit 14, which becomes this phase's commit 1.*

### What the test found

**Bugs:**
- **GM cards land in the Player discard.** Into the discard (Decks mode's
  turned-over cards) sends everything to the Player discard, even a GM card
  (`card-table.ts`, `clear-fate`). Sweep, End the round, leaving the Challenge
  and Reset all choose a discard by whose spot a card is in, not which deck it
  belongs to. `reshuffleDeck`'s stray rule then moves the cards to the right
  discard, which is why the shuffle looked like it fixed them.
- **Cards can vanish from the game** (found in review). `removeOpponent` and
  `removeSeat` delete zones that still hold cards (`table.ts`, and seats are
  removed through `syncSeats`).
- **"The Fool is out" shows to everyone.** `projectFor` made `round.foolDrawn`
  public so the table would know to reshuffle. `endRound` already reshuffles
  both decks by itself, so the notice only leaks that someone holds the Fool.
  Leaving the Challenge also clears `foolDrawn` without the reshuffle
  (`mode.ts`).
- **"…that is you" shows on every screen.** The guide's turn line is the same
  for everyone.
- **No prompt at End the round.** `roundIsDone` needs `round.settled` to equal
  the count, and `settled` is set only by **Close minor actions**. Any move of
  the count clears it. So pressing + past the last number never prompts, and
  neither does Sweep without closing minor actions first. Chris pressed Sweep
  and then End the round. An enemy initiative above 14 also holds the round
  open, and so did the stray card in round 2.
- **The discard piles can't be opened in the Challenge.** Decks mode has the
  pane (`openPileFrom`), the Challenge view does not.
- **Look closer is still small.**
- **Zombie B lost his letter under initiative** once he was split off.
- **The GM drew 7 where the book gives 6.** One type of zombie plus one other
  enemy is 2 types, not 3: 3 + 2 types + 1 for outnumbering three adventurers
  is 6. The "one card fewer with three players" Chris promised in the Discord
  post would make it 5, and it is nowhere in the tool (phase 31 rejected it as
  a line of its own, on the grounds that the GM would override; the test shows
  the override gets forgotten).
- **Players can shuffle a discard back in.** The button is the GM's, but the
  server does not check (`reshuffle` has no `gm-only`). Nor do the round and
  roster commands: deal, end the round, mulligan (a player can redraw the GM's
  hand), the count, minor actions, Sweep, and adding, renaming and removing
  enemies and creatures.

**Where the table was right and the notes are about clarity:**
- **"On your turn any card pays for any action"** is the book's rule (ch.7,
  Take turns: "On your turn, you can use *any* card to perform *any* action").
  Suits must match only for minor actions. The ask that stands is Chris's: the
  action list should be split by suit, with "any suit" as its own group, as
  well as lighting up the cards. The pack already holds that grouping
  (`bySuit`, `anySuit`, `free`, `gmOnly` in `challenge.json`);
  `Actions.svelte` flattens it.
- **Removing a zone warns on Save, not when you press Remove.** Chris asked
  "probably OK?" Yes: nothing changes until Save, and that is where the warning
  is. No change.

**The round doesn't read** (Chris's notes, in the order of the round):
- "In initiative phase you should click a card then click a button to confirm
  it as your initiative." In round 2 a card went into play instead.
- "Initiative should reveal on a player's turn. It also needs a reveal option to
  reveal it when you are attacked." (The book: flip it when the count reaches
  you, and "When other characters attempt to perform an action against you,
  flip your Initiative card face up".)
- "Counting to next initiative should be automatic unless there is some sort
  of issue."
- "You should only be able to place your own initiative and play a card in
  front of you."
- "Played cards should go to an area where we can see them properly like in the
  crawl phase", meaning Decks mode's turned-over cards, labelled with what they
  were for.
- "Minor actions could close automatically on everyone playing or passing", and
  "closing minor actions should reveal everyone's card and what they are
  doing". Today closing the window leaves every minor-action card face down
  and sideways.
- "I don't know why minor action cards are turned sideways, that should only be
  for cards you are keeping." The table conflates two things the book keeps
  apart. An ordinary minor action is put down, revealed with everyone else's,
  resolved and discarded (ch.7 step 4). A **facedown** action such as Dodge is
  set sideways and kept until it is used; the minor-action version of that sits
  below the initiative card (ch.7, Facedown cards).
- "Readying a facedown card for something like Dodge should prefill the
  description with what it is for."
- "Players should get their own messages."
- Moving other players' zones should be the GM's.

**Enemies:**
- Health is only visible inside each group's fold; it belongs in "Where
  everyone is".
- Chris is undecided whether players should see enemy Health at all, and
  suggested a switch: "Maybe if it's hidden only the GM can change health."
- "Splitting off enemies does work, but in the game they shouldn't get an
  initiative slot. All members of a group use the same initiative and when they
  play a card use the same card, even if they are in different zones." (The
  book: "Groups of the same enemy share an Initiative card.")

**Not tested:** the phone, deferred by Chris to this phase.

### Decided (Chris, 2026-11-25, in the test notes)

- **You touch your own cards; the GM runs the table.** Phase 29's "any card on
  the table may be moved by any seat" goes. This is about whose cards are
  whose, not about rules: the table still never checks a value or a suit.
- **The round runs as steps**: initiative confirmed with a button, the count
  moving itself, a labelled play area everyone can read, and minor actions
  that are declared or passed by everyone and then revealed together.
- **Sideways means kept.** Only readied facedown actions are set sideways.
- **A group of enemies is one initiative and one card**, wherever its
  creatures stand.
- **Messages are personal.** Only the acting player is told it's them.
- **The phone check** is part of this phase.

### Decided after the review (Chris, 2026-11-25)

- **The three-player house rule goes in the draw checklist**: "One fewer with
  three adventurers", ticked by itself at exactly three, labelled as a house
  rule. It was promised in the Discord post, and the test shows the override
  gets forgotten. This reverses phase 31's rejection.
- **Hands stayed private in the test.** "Each player sees only their own hand"
  was checked and fine, only left unticked.
- **Enemy Health: a GM switch, shown by default** (today's behaviour). When
  shown, anyone may change it, as now; when hidden, players see none of it and
  only the GM changes it. Down stays visible either way, because a creature
  that falls is something everyone sees.
- **Split is removed.** Each creature already has its own zone and Health, and
  a group shares one initiative. A creature that starts acting on its own, like
  Session 13's raised zombie, is added as a new enemy.

**Taken as recommended unless Chris says otherwise:**
- **Shuffling a discard back in is the GM's.** The usual argument against is a
  Test of Fate from an empty deck failing, which today it does (`moves.ts`,
  `empty`); commit 6 makes an empty deck reshuffle its discard by itself, as
  dealing already does, so that argument goes.
- **Ties.** The book's tied characters "act at the same time". Every tied
  character takes their turn, then minor actions open once for the number.
  Players at the same number choose who goes first; the GM decides between a
  GM character and an adventurer.

### The design, in the table's own terms

**Every card goes to its own deck's discard.** One engine helper,
`discardAll(table, fromZone)`, sends each card to `discardZone(deckOf[card])`.
Every sweep uses it: Sweep, End the round, leaving the Challenge, Reset,
Into the discard, clearing a facedown card, the mulligan, removing an enemy
group, removing a seat, and the new end-of-number tidy-up.
`reshuffleDeck`'s stray rule stays as the safety net for a card a person drops
on the wrong discard by hand. An invariants test runs every command against a
table with both decks in play and checks two things afterwards: every card
still exists exactly once, and no discard holds the other deck's card.

**Who may do what.** Every command is listed with who may send it; anything
not listed is refused as `not-yours` and not offered on screen. With nobody in
the GM seat, everyone may do what the GM may, the rule `reset-table` already
follows. **Hands stay owner-only for everyone, the GM included** (as
`canTakeFrom` and `undo.ts` already insist), because a hand is the one place
the table is secret from the GM too.

| Command or zone | Who |
|---|---|
| Your hand | you only |
| Your initiative, played, facedown and minor cards | you, and the GM |
| Giving a card into someone's inspiration slot | anyone (the High Chant: "Distribute the cards to other players"); taking one out is that seat's and the GM's |
| An enemy group's zones, its initiative and its cards | the GM |
| The table's `play` area | nobody directly: cards arrive and leave through the step commands; the GM can move them |
| Decks and discards: draw, turn over, pick from a discard | anyone (a Test of Fate is a player's; the High Chant picks from the discard) |
| Shuffle a discard back in, Reset, mode, guided | the GM |
| Deal, mulligan, end the round, the count, minor-action overrides, Sweep | the GM |
| Add, rename and remove enemies and creatures; split and merge while they last | the GM |
| Scene zones and picture | the GM (as now) |
| Where an adventurer stands | that adventurer, and the GM |
| Where a creature stands | the GM |
| Enemy Health | the GM; anyone too while Health is shown |
| Down / Back up | the GM; anyone too while Health is shown |

**The round as steps.** `round.step` is one of `deal`, `initiative`, `count`,
`turn`, `minor`, `resolve`, `over`. Step commands are refused as `wrong-step`
when they arrive in the wrong step, from a page a poll behind or straight at
the API. That is a check on the table's own state, not a rules check: the GM
can always move the step on. Free card moves stay, under the table above, for
the GM's fixes, Tests of Fate and discarding for a Favour.

**Automatic steps happen inside the command that completes them**: the last
initiative card starts the count, the last answer to minor actions turns the
cards over. There are no timers.

**Conflicts retry by themselves.** Today a refused command is dropped: the page
catches up and says "Someone got there first", and the person has to press
again (`cards/[token]/+page.svelte`, `run`). With four people pressing Play as
initiative or Pass at the same moment, most presses would bounce. Step
commands whose result doesn't depend on order (your initiative, your
minor-action answer, Show my initiative) re-send on a conflict with the fresh
version, up to three times, before saying anything. Card moves keep today's
behaviour, because two hands reaching for one card is a real conflict.

1. **Deal.** As now, with the draw checklist filling itself in (below).
2. **Initiative.** You pick a card and press **Play as initiative**. A card can
   no longer be dropped onto the slot. The GM gets one button per enemy group
   ("Initiative for the Zombies"). A group with every creature down needs none.
   When every adventurer holding cards and every group with a creature up has
   one, the count starts. The GM can **Start the count** without waiting, for a
   player who has gone quiet.
3. **Count.** The count jumps to the lowest initiative held by anyone who has
   **not yet acted this round** (`round.acted` is per round, not per number,
   so Guard's new initiative can't give anyone a second turn). The server knows
   the values, and a GM counting aloud tells the table the same thing, that
   nobody is at 4, 5 or 6. Initiative cards at that number turn face up for
   everyone, which is the book's "flip your Initiative card face up to declare
   that you are the acting player".
   - **How a card turns face up.** Visibility belongs to a zone and the count
     reads initiative from the slot, so the card can't move out. Instead
     `round.shown` lists the holders whose initiative is face up;
     `projectZone` shows those slots to everyone; End the round clears it.
   - **A tie** lists everyone at the number with the book's tie rule. Each of
     them takes their turn, then minor actions open once.
   - **No cards in hand** at your number: your turn is skipped by itself, and
     nobody takes minor actions (ch.7, Skipping your turn).
4. **Turn.** Only the acting player (or the GM, for a group) gets the turn
   panel. Everyone else sees whose turn it is. The panel has:
   - the actions grouped by suit, with Miscellaneous ("any suit") and free
     actions as their own groups and the line "On your turn any card pays for
     any action";
   - who it is aimed at, optional. Naming someone turns their initiative card
     face up, since an action against them is when the book flips it.
     **Show my initiative** is there for everyone at any time, for when a
     target was not named;
   - **Play it**: the card goes face up into the play area. Guard puts it on
     your initiative instead, face down, and discards the old one;
   - **Add a card**, for plays of more than one card: the GM's greater doom
     with the lesser doom it rides on, a greater doom discarded for favour;
   - **Ready it**, for actions the book plays facedown (Riposte, Dodge, Aid
     Another, Vigilance): the card goes sideways above your initiative,
     labelled with the action already filled in;
   - **Skip my turn**: the book says nobody takes minor actions then, so the
     count moves on.

   The GM's overrides include **Skip their turn**, for an acting player who has
   gone quiet.
5. **Out of turn**, at any point before Resolve, on anyone's turn:
   - **The Fool**: its holder gets **Play the Fool** (with a partner card).
     The book: it "counts as an interrupt action. The Fool always goes first".
     It takes a turn before the acting one, opens no minor actions, and the
     holder keeps their own turn. This replaces `round.interrupt` and
     `round.extraTurn` for the Fool; a talent's interrupt uses the same
     control, labelled by the player.
   - **A readied card**: its holder gets **Use it**. The card turns face up and
     comes into the play area labelled with what it was readied for. Riposte
     and Dodge trigger on an attack, Aid Another and Vigilance on another
     character's action, so they are used on other people's turns by design.
6. **Minor actions** open by themselves once every turn at the number is
   played. Everybody who did not just act sees **Any minor actions?** with
   three answers:
   - **Put one down**: choose the action and a card. The label is public, as
     the book has everyone declare. The card sits face down in your own
     `minor` slot. Players' cards of the wrong suit are dimmed, not refused;
     the GM's are never dimmed (majors have no suit). Vigilance takes the suit
     of the action it waits for.
   - **Ready one**: sideways, below your initiative, and kept.
   - **Pass.**

   The GM answers for each group that did not just act: "Each enemy or enemy
   group can make one minor action on another character's turn". The strip
   shows who is still deciding. The last answer turns every minor card face up
   together, into the play area. The GM can **Turn them over now** for someone
   who has gone quiet.
7. **Resolve.** Everyone reads the play area. The GM applies the hits (Health,
   Down) and presses **Next**. The number's cards go to their own discards and
   the count moves on. This replaces Sweep.
8. **Over.** The end-of-round check shows (surrender, retreat) with **End the
   round**, then the deal panel for the next one.

**The play area** is the turned-over-cards row from Decks mode, under the
count: each card with who played it, the action, the target, and "turn" or
"minor". It is drawn from the zones that already exist: every seat's and
group's `played` zone (which `revealFacedown` already uses) plus the revealed
minor cards, shown together. Labels are keyed by zone and position, as
`facedown` is today (`table.ts`), **never by card id**: card ids are the
cards' identities (`swords-ii`), so a label keyed by one would name a face-down
card to everyone.

**Undo** covers the new commands in a narrow window: a played card until
anyone answers minor actions; your own initiative until the count starts.
Never past an automatic reveal, because by then other people have seen the
card.

**Messages.** The guide line and the announcer speak to the viewer: "Your turn:
play a card or skip" for the acting player and "Ash's turn" for everyone else.
"You hold the Fool" goes only to its holder. When the Fool was drawn, End the
round says that both decks were shuffled. Commit 4 makes the guide and the
announcer take the viewer; Release C rewrites what they say but keeps that.

**Enemies.**
- **No split.** The migration merges any split-off group
  back into its family, as `mergeOpponent` does now.
- **Health in "Where everyone is"**: "Zombie B 4/6" beside each creature, for
  everyone while Health is shown and for the GM always.
- **Hiding Health hides it from then on.** While Health is hidden, the
  projection strips the pools from players' views, and new `set-hd` events
  carry the creature but no numbers, because events are the public log.
  Events written while Health was shown keep their numbers: what the table
  already saw, it saw. The announcer is given the viewer and the projected
  state (today `describe(event, nameOf)` has neither), so the GM still hears
  "Zombie B: Health 2 of 6". Down stays visible.

**The GM's draw fills itself in.** "Each type of enemy" counts families with a
creature up. "Outnumber" and "twice as many" compare creatures up with
adventurers seated, using "twice as many" as two or more times. Larger than a
human, elite and dungeon lord stay manual, because the table can't know them.
The pack gains a house-rule modifier, "One fewer with
three adventurers" (amount −1, ticked by itself at exactly three), labelled as
a house rule. The GM can still untick anything and type their own number.

**State, at schema v13–v15** (one bump per commit that changes the shape, each
with its fixture migration):
- v13 `enemyHealth: 'shown' | 'hidden'`;
- v14 no split: groups merged;
- v15 `round.step`, `round.acted` (per round), `round.answered` (who has
  declared or passed a minor action at this number), `round.shown`, a `minor`
  zone per seat (`owner`) and per group (`gm`), and `plays` labels keyed by
  zone and position. `round.interrupt` and `round.extraTurn` go. **A table
  saved mid-round** opens at its current count in step `count`, and the GM
  steps in; there is no inferring the step from its cards. A fixture for each
  of initiative, mid-count and minor actions open checks that it opens and that
  no card is lost.

### Commits

**Release A: the fixes from the test.** Mostly server-side, so little of it is
thrown away by Release C.

1. `docs`: close phase 31 (its commit 14): CHANGELOG, the a11y spec's new
   states, and the phase 31 section moved to the history file verbatim, with
   its commit 13 noted as moved here.
2. `fix(hmtw)`: every card to its own deck's discard, and no card lost.
   Adds `discardAll` and uses it in every sweep, in `removeOpponent` and in
   `removeSeat`, with the invariants test. The cards Chris's test left on the
   wrong pile fix themselves at the next shuffle, as now.
3. `fix(hmtw)`: the Fool stays secret. `foolDrawn` leaves the projection. The
   holder's notice comes from their own hand. Decks mode's notice comes from the
   Fool lying face up. End the round says when the Fool's reshuffle happened,
   and leaving the Challenge does the reshuffle it now skips.
4. `fix(hmtw)`: personal messages. The guide and the announcer take the
   viewer and say "your turn" only to the acting seat, with tests from three
   viewers.
5. `feat(hmtw)`: the GM's draw fills itself in, and the three-player house
   rule in the pack. `SCHEMA.md` covers the house flag
   and negative amounts.
6. `fix(hmtw)`: the Challenge's discards open in the pane (extracted from
   `DecksMode.svelte` into a shared `PileViewer.svelte`). Look closer fills the
   screen. Drawing or turning over from an empty deck reshuffles its discard
   first, as dealing does.
7. `fix(hmtw)`: the missing end-of-round prompt, kept small because Release C
   replaces `roundIsDone`. Tests for the three ways it stays hidden (+ past
   the last number, Sweep without closing minor actions, an enemy above 14).
   Running past the last number settles the round, and the GM's guide line
   says what is holding it open ("Ash still has a card at 9").
   **Milestone A: deploy.**

**Release B: whose cards are whose, and the enemies**

8. `feat(hmtw)`: who may do what, enforced in the engine and the command
   reducer and refused as `not-yours`, with the table above as its tests
   (one case per row, from a player, from the GM and with nobody in the GM
   seat). The screen stops offering what you can't do. Tests that change, each
   explained in the commit message: `invariants.test.ts` (anyone may flip a
   wanderer's initiative; anyone may move an enemy's facedown card), and
   `card-table.spec.ts` wherever a player moves someone else's card.
9. `feat(hmtw)`: the enemy Health switch (v13), Health in "Where everyone
   is", events without numbers while it is hidden, and the announcer given the
   viewer and the state. A test checks that a player's projection and the new
   events hold no pool values while hidden.
10. `feat(hmtw)`: no split (v14). The split and merge commands and buttons go,
    and the migration merges groups back. The lost-letter bug goes with them.
    `card-table-scene.spec.ts` loses its split and rejoin steps and the
    `gm-after-split` screenshot.
    **Milestone B: deploy.**

**Release C: one turn at a time**

11. `feat(hmtw)`: the v15 shape and its migration, with the three mid-round
    fixtures, and `round.shown` honoured by the projection. Nothing on screen
    changes yet.
12. `feat(hmtw)`: initiative and the count in the engine: `playInitiative`,
    `startCount`, `nextNumber` (per-round `acted`, ties, the empty-hand skip)
    and `showInitiative`, with their commands, `wrong-step`, and the
    self-retry on conflict in the page's `run`, with a test where three seats
    answer at once.
13. `feat(hmtw)`: the turn, out-of-turn plays, minor actions and resolve in the
    engine: `playTurn` (play, add a card, ready, skip, Guard), `playFool`,
    `useReadied`, `declareMinor`, `passMinor`, the reveal, and `resolve`
    through `discardAll`. Their commands and the GM's overrides (Start the
    count, Skip their turn, Turn them over now, Next, Back one). Whole-round
    tests: a tie, a skip, the Fool interrupting the GM's turn, everyone
    passing, a readied Dodge used two rounds later, Guard. Undo within its
    window.
14. `content(hmtw)`: in `challenge.json`, a flag for the actions the book plays
    facedown (Riposte, Dodge, Aid Another, Vigilance) and for the one that
    replaces your initiative (Guard: "replace your Initiative with any card
    from your hand … Your old Initiative is discarded"). The suit groups are
    already there. Chris checks the list.
15. `feat(hmtw)`: initiative on screen: Play as initiative, the GM's
    per-group buttons, the card turning face up when its number comes, and
    Show my initiative.
16. `feat(hmtw)`: the turn panel, only for the acting seat: actions by suit,
    the target picker, Play it, Add a card, Ready it, Skip my turn. Play the
    Fool and Use it for everyone, on any turn.
17. `feat(hmtw)`: minor actions on screen: Put one down, Ready one, Pass, who
    is still deciding, and the cards turning over together.
18. `feat(hmtw)`: the play area, with Resolve and Next. Sweep and "Guide the
    round" go, because the steps are the guide now. The end-of-round check
    leads the `over` step. Specs that change: `card-table-a11y.spec.ts`
    (it presses "Guide the round") and `card-table.spec.ts` ("Play here",
    "Play facedown — your turn").
19. `test(e2e)`: a full round in four browser contexts (GM plus three
    players), covering initiative, the count jumping, a tie, a turn, the Fool,
    minor actions with one pass, one card put down and one readied, Resolve and
    End the round. It has an axe scan for every new state and a check that no
    player's page ever shows another player's hand or minor card before the
    reveal.
    **Milestone C: deploy, then a second live test** with a new checklist note
    in the campaign vault like the first.

**Release D: the phone**

20. `fix(hmtw)`: the phone pass at 390 px: hand, turn panel, minor actions,
    the play area and the scene, building on the 390 px no-sideways-scroll
    check `card-table-scene.spec.ts` already has. 44 px targets, checked by the
    specs and then by Chris on his phone.
21. `docs`: close phase 32.
    **Milestone D: deploy.**

**Guards**, phase 31's carried forward: the a11y spec stays the floor and
grows a state for each new panel, and contrast is computed. The second live
test is not optional. The specs can't tell whether four people understand the
round, and that is what this phase is for.

### Considered and rejected

**Enforcing suits and values.** Dim the wrong-suit cards; never refuse them.
The GM can rule that a card counts, and an app that says no at the table is
the thing phase 29 set out not to be. Who may do what is about ownership, and
`wrong-step` is about the table's own state; neither is a rule of the game.

**Timers for the automatic steps.** A step happens when the last person
answers, inside that command. A timer would need a clock on the server, which
a polling table doesn't have, and would race the people at it.

**The GM reaching into hands.** "The GM touches everything" stops at hands.
A hand is the one zone secret from the GM, and with nobody in the GM seat
everyone is the GM, which would open every hand to every player.

**Moving an initiative card to turn it over.** It is how the engine flips
everything else, but the count reads initiative from the slot. `round.shown`
is one list and keeps the slot the single source.

**Keeping split, with a shared initiative.** Split existed to give part of a
group its own initiative. Zones and Health are already per creature, so a split
that shares the initiative does nothing.

**Dragging cards.** Click to choose, then a button, as now. It is what carries
the keyboard and screen-reader story, and Chris's "click a card then click a
button" is the same shape.

### Not in this phase

- **A creature's stat block link** (phase 31's commit 13). It is still the
  lowest-value item, and the Castle Automatic's own enemies never link.
- **Engaged or disengaged**, as phase 31 left it.
- **A player who wanders off** (phase 30). The GM's overrides in Release C
  cover the round without them, but the seat stays.
- **The cheat sheet inside the table**, still waiting for Chris's sheet.

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
