# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Moves & gear, handed out** (commit 113). The app's equivalent of the
  printed Moves & Gear handout, for a player at the table without a character
  open: the basic moves, the special moves, and the gear / small items /
  prosperity lists the inventory insert already carries — read-only, at
  `/stonetop/table`. `tools/build_moves.ts` now also emits
  `special-moves.json` (Advantage/Disadvantage, Burn Brightly, End of Session
  from the playing-the-game run, plus Death's Door lifted callout-only from
  the Player Moves chapter — the "discussed in detail…" trailer stays in the
  reference). The shell side is a new `GameModule.tableReference` slot
  (label + component, mirroring how the session component fetches its own
  pack data) and a generic `/[game=game]/table` route; the game landing and
  the play view link to it.
- **The session log on the dashboard** (commit 112). The campaign page grows
  the history phase 17's table holds: each recorded session — number, date,
  XP handed out (total and per character), notes — newest first, visible to
  every member. The GM can edit a record's notes after the fact
  (`updateCampaignSessionNotes`, GM-gated against the session's own campaign;
  the number, triggers and awards deliberately don't take edits — they're
  what happened). The end-of-session e2e now asserts the record too: the log
  shows the numbered session, the award lines and the notes, and the
  after-the-fact edit sticks.
- **The session ledger** (commit 111). End of session already marked everyone's
  XP; now it remembers. A `campaign_sessions` table (migration
  `0009_campaign_sessions`) holds one row per run: the campaign's own session
  `number` (assigned by the service, 1, 2, 3… per campaign), the date, the
  checked `triggers` (the game's answer shape, stored opaquely — same
  discipline as `entities.data`), per-character `awards` (`{ entityId, name,
xp }`, denormalised like `rolls.characterName` so history survives renames
  and deletions), and the GM's `notes`. `recordCampaignSession` /
  `listCampaignSessions` (`campaign-sessions.ts`) are GM-gated and
  roster-style respectively. `SessionProps` grows an optional `record(run)`;
  Stonetop's end-of-session flow calls it after every sheet takes its award,
  and the notes textarea still seeds once from the old localStorage key — so
  anything jotted under the browser-only scheme lands in the first recorded
  session instead of being lost — then clears it on a successful record.

- **The steading has editors** (commit 110). The GM can now delegate edit on
  the shared campaign steading, per member. A `steadingEditor` flag on
  `campaign_members` (migration `0008_steading_editor`) carries the grant;
  the campaign dashboard grows a "Can edit the steading" toggle next to each
  player, gated to the GM. The grant is enforced server-side, not just in the
  UI: `getCampaignSteadingForEditor` / `updateCampaignSteadingData`
  (`entities.ts`) allow a read and a blob write on a `steading` attached to a
  campaign where the caller is GM or holds the flag, and the entity endpoints
  fall through to them when the owner-scoped path misses — so a delegate's
  play sheet loads and autosaves the shared tracker rather than 404-ing or
  forking a private draft. Ownership is untouched (the GM still owns the
  entity); the write is narrow (only the one steading a campaign shares, blob
  only). The campaign steading page's "Open tracker" link now appears for the
  owner, the GM, or a delegate, matching what the write path will actually
  permit. `setSteadingEditor` on the campaigns service is the GM-gated grant.
- **A miss marks XP** (commit 109). A stat roll that totals 6 or less now
  offers a "Mark XP" button on the roll surface — Stonetop's "on a miss, mark
  experience," reached without the shell ever knowing what marking XP means.
  `ResolvedRoll` grows an optional `onMiss: { label, apply: (entity) =>
entity }` — a pure update function the game computes ahead of the roll,
  since only the game holds the character's shape. `stonetopDice.resolve`
  and `rollForStat` (`dice.ts`) always arm one (`markXp`, +1 XP);
  `rollForSteadingStat` deliberately never does, so a steading roll can never
  qualify, and `rollDamage` never reaches `rollForStat` at all, so damage
  rolls can't either. `PlayMode.svelte` bridges the pure `apply` into an
  imperative `{ label, action }` closure over `onChange` (`asRollOpts`) —
  the one place with both the character and the save path in scope — before
  handing it to the shell's `roll()`, whose own `PlayProps.roll` signature
  grows a matching third `opts?: { onMiss? }` parameter. The shell
  (`+page.svelte`, both routes) only arms the follow-up on the `RollEntry`
  when the total actually came in at 6 or less, and only ever runs the
  closure it was handed — it still never reads the character. `RollSurface`
  holds a pending follow-up open instead of fading it on the usual 6s timer,
  shows a brief "✓ Marked." confirmation once run, and then closes on a
  shorter 3s timer. `e2e/miss-marks-xp.spec.ts` drives a guaranteed miss via
  the bonus box (commit 107) at -20 and asserts the button, the confirmation,
  the XP tally updating on the sheet, and that a damage roll never shows the
  button even at the same total.

- **Damage rolls** (commit 108). The playbook's `base.damage` (the Heavy's
  d10) is now a "Damage (dX)" button on the play sheet's header, always
  available, and on any move card tagged `rollsDamage` — moves whose own
  resolution says "deal your damage" rather than spelling out a roll: Clash
  and Let Fly (basic moves, curated by id in `tools/build_moves.ts` rather
  than text-matched, since the same phrase also shows up as one option among
  several on moves that aren't fundamentally about dealing damage — Defend's
  "strike back... deal your damage, with disadvantage" is a Readiness spend,
  not a trigger), plus the Fox's Ambush, the Judge's The Hammer and the
  Book, and the Ranger's Call the Shot (hand-tagged in their playbook data).
  A rider on top of another roll's damage (e.g. "+1d4") isn't tagged — it
  rides commit 107's bonus box instead, dialled in before the triggering
  roll. New `pack-schemas.ts` field `rollsDamage: boolean?` on both
  `moveSchema` and the shared basic/steading-moves shape; `pack.test.ts`
  asserts the exact tagged set and that nothing else across the 9 playbooks
  picked up the tag by accident. `e2e/damage-rolls.spec.ts` covers both the
  header button and a move card's button end to end.

- **Full dice panel + custom bonus** (commit 107). The dice panel now always
  offers the whole standard polyhedral set — d4, d6, d8, d10, d12, d20, 2d6 —
  regardless of what a game's own presets cover, so it's useful for a damage
  roll, a percentile check, or anything ad hoc, not just a game's named rolls.
  These base buttons are shell-generic (`DiceRoller.svelte`), not a
  `DiceModule` contribution — Stonetop's redundant plain "Roll 2d6" preset is
  retired in favor of the panel's own 2d6 button, leaving `stonetopDice` with
  just its six stat rolls.

  Alongside it, a small signed bonus box: dial in a situational modifier and
  it applies once, to whatever rolls next — a base die, a game preset, or a
  stat tapped straight on the sheet, since all three funnel through the play
  page's `makeRoll`. The engine tracks it as `RollResult.bonus`, kept apart
  from `modifier` (which comes from the notation itself) so the log can show
  where each part of a total came from: "2d6+1 (bonus +2)" reads as stat +1,
  situational +2, rather than folding both into one number. Consumed (reset
  to 0) the instant a roll uses it — "applies to the next roll" is a
  one-shot, not a sticky setting. `rollResultSchema` and the `rolls` table's
  stored blob grow the field; the roll surface, the campaign roll log, and
  the panel's own recent list all render it distinctly from the base
  modifier.

- **Inserts land at creation** (commit 106). Closes the gap Phase 14 opened
  back at commit 99: `autoAttachedInsertIds` only ever ran inside
  `migrateCharacter`'s v2→v3 upgrade, so a freshly-built Lightbearer,
  Marshal, Blessed+Initiate, or Ranger-who-picked-Animal-Companion had to
  reload the sheet once before their insert appeared. The wizard's
  `ExtrasStep` now runs the same commit-99 rule live: it's late enough in
  the flow that playbookId, backgroundId, and chosen moves are all settled,
  and it's already fetching the playbook, so attaching there needs no new
  fetch except Crew's (which still needs `insert-crew.json` to seed the
  right number of write-in lines). The effect is idempotent and keyed off
  the draft, so it's a no-op once everything qualifying is already attached
  — safe to leave running for as long as the step is mounted, including a
  player bouncing back to it.

  The same effect seeds the Seeker's major arcanum as an Arcana card: the
  Seeker's three backgrounds (Patriot, Antiquarian, Witch Hunter) each carry
  an `arcanum` background choice naming the item acquired (e.g. "◇ The Staff
  of the Lidless Orb" — the leading ◇/◇◇ is a Stock/slot cost, stripped
  before it becomes the card's name), and `ExtrasStep` is where the pack
  also surfaces the "Collection" section prompting the player to pick which
  major-arcana questions they'll answer at the table — the natural place for
  that item to show up as a real card, ready for the GM to author mysteries
  onto later.

  `e2e/playbook-golden-paths.spec.ts` (commit 98's matrix) now closes the
  loop it was written to eventually catch: the five insert-bearing playbooks
  each drive the specific wizard choice their insert needs (Initiate
  background for Blessed, an arcanum pick for Seeker, the Animal Companion
  move for Ranger — Lightbearer and Marshal need nothing extra, their rule
  keys off playbookId alone) and then visit the play sheet to assert the
  tab actually attached, no reload required.

- **Arcana insert — free-form cards** (commit 105). Matches the paper ritual
  where the GM hands you a card: write-in name and notes, a configurable row
  of mark boxes, and _mysteries_ (sections) that unlock as marks accumulate.
  Structured Minor/Major Arcana data (Hearthfire's transcription, CC BY-SA
  4.0) stays a planned fast-follow, exactly as the plan allowed — this commit
  ships the free-form shape any GM can use today without waiting on that
  import. Attaches through a "+" tab like Followers/Ghost/Revenant/Thrall,
  needing no pack data either.

  The genuinely new piece: a card's mysteries are edited by two different
  parties. The player marks boxes as they play; the GM authors and reveals
  the mystery text through `/campaigns/[id]/arcana`, a new shell route that
  mirrors end-of-session's shape exactly (`requireGm`, a `save` action that
  goes through `updateCampaignEntityData`, which re-checks GM-of-this-table
  server-side) — the game contributes an `arcanaGmComponent` the same way it
  contributes a `sessionComponent`. Both parties' edits run through the same
  pure `engine/arcana.ts` functions; only the caller differs.

  Whether a not-yet-unlocked mystery's text is visible to the player at all —
  "some tables like the anticipation, some don't" — is the app's first
  **per-campaign setting**: a `campaigns.settings` JSON column (migration
  `0007`), opaque to the shell the same way `entities.data` is, plus a new
  generic `GameModule.campaignSettingsFields` extension point the campaign
  dashboard renders as plain checkboxes — the shell never hard-codes what a
  setting means, mirroring how `referenceSpoilers` already keeps game words
  out of app code. Stonetop registers one field, `showLockedArcana`, default
  off. `updateCampaignSettings` merges rather than replaces, GM-gated the
  same way `rotateInviteToken` is.

  21 new unit tests (16 engine, 5 campaign-settings service) plus two new e2e
  specs: the player's attach/add/mark/reload-persists path, and a full
  GM-authors → player-can't-see-it-yet → GM-flips-the-setting →
  player-can-see-it-now round trip exercising the whole write-and-gate
  pipeline in one flow. 547/547 unit tests passing, tsc/eslint/prettier
  clean, `drizzle-kit generate` produced and applied the migration cleanly.

- **Undead inserts** (commit 104): Ghost, Revenant, and Thrall — gained by
  dying a particular way, not by playbook, so none has an
  `autoAttachedInsertIds` rule. All three get a "+" tab-bar button like
  Followers, but simpler: attaching needs no pack data (blank state, nothing
  to seed from), so unlike Followers' fetch-gated button, these are always
  clickable.

  Ghost and Revenant validate against one shared pack schema
  (`undeadInsertSchema`, commit 100) and now share one engine module
  (`engine/undead.ts`) and one UI component (`UndeadInsert.svelte`,
  parametrized by insert id and fetcher) rather than duplicating both twice
  for what's structurally the same insert with different book content.
  Consequences can gate on an earlier pick (Ghost's `unstable` requires
  `breakdown` already marked) — `toggleUndeadConsequence` checks that against
  the pack's `requires.consequences`, and unmarking a prerequisite cascades
  to unmark whatever it gated, so state can't point at a gate that no longer
  holds.

  Thrall gets its own engine module and component: a write-in master and
  impulse, an Instinct pick, and a Favor track (0-3) that lives on the
  insert's own state rather than `character.trackers`, since Thrall's
  granted moves never enter `character.moves` and so never reach the
  playbook move-tracker sync that regular moves get.

  34 new unit tests. Unlike commit 103's class inserts, these attach through
  a real "+" button today, so they get full e2e coverage now rather than
  waiting on commit 106: Ghost's attach → pick an Instinct → reload-persists
  path, plus a lighter check that Revenant's and Thrall's own "+" buttons
  each produce their own tab. 526/526 unit tests passing, tsc/eslint/prettier
  clean.

- **Class inserts** (commit 103): Invocations, Animal Companion, Initiates of
  Danu, and Crew — the four playbook-specific inserts that auto-attach per
  commit 99's rules rather than getting a "+" button like Followers. Each
  gets its own engine module, UI component, and tab that simply appears once
  attached:

  Invocations (Lightbearer) tracks which spells are known and which single
  _ongoing_ one is active — activating a second ends the first, matching the
  book's "only one Invocation at a time" rule; instant (non-ongoing)
  Invocations are just a known/unknown checklist, no activation needed.

  Animal Companion (Ranger, gated behind the `animal-companion` move — an
  envelope-level `requires` beyond `appliesTo`, the first insert to use it)
  seeds HP/armor/damage/damage-tags from the chosen type's printed base;
  re-picking a type resets type-specific traits but keeps the name, instinct,
  cost, and Loyalty the player already set. Beast of Legend (a repeatable
  advancement pick) logs each pick made rather than just a count, since the
  book's three options differ in effect.

  Initiates of Danu (Blessed/Initiate background) is the first insert whose
  roster is fixed book content rather than blank write-ins: five named NPCs
  the player picks 2-3 of. State is keyed by catalogue id rather than an
  array index — natural once the roster is a fixed set rather than freely
  added-to — and tracks only what changes in play (current HP, Loyalty, and
  the catalogue entry's flavor prompts like pronouns/manner), leaving name/
  tags/damage/moves/cost in the pack.

  Crew (Marshal) is a single group-follower, not a roster: pick-driven tags
  (fixed + chosen + write-in + a move-gated _exceptional_ special tag),
  instinct/cost with a Loyalty track, a few write-in gear lines against a
  fixed equipment table, and an "individuals" list (crew members who stand
  out) capped at the pack's `portraitBoxes`.

  45 new unit tests across the four engine modules. No new e2e coverage yet —
  none of these attach on a freshly-built character today (only the v2→v3
  migration path runs `autoAttachedInsertIds`); commit 106 wires the wizard
  to attach them at creation and adds the e2e matrix asserting each tab
  appears for its playbook. 505/505 unit tests passing, tsc/eslint/prettier
  clean.

- **Followers insert** (commit 102). The first of the "+" tabs commit 101 set
  up for: any character can attach the generic Followers roster from a play
  sheet button, and get its own tab. `engine/followers.ts` edits the roster
  by array index rather than a generated id — the same convention as the
  steading's `ResidentsTable`/`NeighborsTable` (phase 6): nothing outside the
  roster ever refers to a follower by id, so an index is simpler than minting
  and threading one through. State lives at `character.inserts['insert-followers']`
  per commit 99's attachment model; `addFollower` attaches (if not already)
  and appends a blank follower shaped by the pack's own `moveLines`/`gearLines`
  counts, so the UI never hardcodes them.

  `Followers.svelte` renders the roster as free-text cards — name, tags,
  HP/armor/damage, instinct, move/gear write-ins, flags, cost, and a
  tap-to-set Loyalty track — each edit a pure engine call passed back through
  `onChange`. `PlayMode.svelte`'s tab bar goes from the static `TABS` of
  commit 101 to a `$derived` one that adds "Followers" once attached, plus a
  "+" button (visible only while unattached) that attaches and jumps straight
  to the new tab in one action — this is the general shape commits 103-105
  reuse for their own inserts, though only Followers is player-optional in
  this way (Crew/Invocations/etc. auto-attach at creation per commit 99's
  rules; Ghost/Revenant/Thrall are narrative-triggered, not a player button).

  `pack/inserts.ts`'s one-off `fetchInventory` becomes `cachedInsertFetcher<T>`,
  a factory producing an independently-memoised fetcher per insert file — used
  for both `fetchInventory` and the new `fetchFollowersInsert`, and the shape
  the rest of Phase 14's inserts will reuse.

  A real ARIA bug turned up writing the e2e coverage: the "+" button used
  `title="Add Followers"`, but its visible text content ("+") wins the
  accessible-name computation over `title` — `aria-label` was the fix.
  12 new unit tests (`engine/followers.test.ts`) plus a new e2e spec
  (`play-followers.spec.ts`: attach, add, edit, reload-persists, add a
  second, dismiss the first) exercising the debounced-autosave path end to
  end. 460/460 unit tests passing, tsc/eslint/prettier clean.

- **Tabbed play sheet** (commit 101, opening Phase 14's UI work). PlayMode
  restructures into a Sheet · Moves · Inventory tab bar — Sheet keeps
  vitals/stats/XP/trackers/advancement; Moves and Inventory moved whole into
  their own tabs. `?tab=` makes the active tab shareable and survives a
  reload: reading `page.url` on load picks it up (no `onMount` needed,
  works identically through SSR and hydration) and `replaceState` keeps it
  in sync on every tap without adding history entries. The Inventory tab
  carries an attention badge when overloaded, loaded independently of the
  tab's own component so it renders even when that tab isn't active —
  `fetchInventory` memoises, so this doesn't cost a second request. This is
  the three-tab base the rest of Phase 14 builds onto: commits 102-106 add
  one tab per attached insert plus a "+" tab to attach more.

  New e2e coverage (`play-tabs.spec.ts`) — the play route had none before
  this: switching tabs updates the URL, and a reload lands back on the tab
  that was open. 448/448 unit tests still passing (no engine changes),
  tsc/eslint/prettier clean.

- **Typed insert schemas** (commit 100). The seven inserts commits 102-105
  build UI against — Followers, Crew, Animal Companion, Initiates of Danu,
  Invocations, Ghost, Revenant, Thrall — get real Zod shapes in
  `pack-schemas.ts`, replacing the loose envelope-only `insertSchema` for
  those files (it stays as the fallback for any future unmodeled insert).
  Ghost and Revenant validate against one shared `undeadInsertSchema`: both
  replace the playbook Instinct, grant a fixed move set, pick a Terrible
  Purpose, and track Consequences toward a shared Final Consequence — same
  structure, different book content. Small shapes repeat across the
  follower-like inserts (Followers/Crew/Animal Companion/Initiates all print
  "Order Followers"/"Strengthen Your Bond") and are shared rather than
  copied per file.

  Two real vocabulary gaps turned up reading the actual pack JSON, both
  filled: the ghost/revenant consequence lists gate some entries on an
  earlier pick (`Unstable` requires `Breakdown` already chosen) — the same
  `childOf`/prerequisite shape moves already use, now generalized to
  `requires: { consequences: [...] }` since the gated pool differs; and
  cross-checking our move vocabulary (`requires`/`replaces`/`maxTakes`)
  against Hearthfire's (`requires`, `requiresLevel`, `requiresConsequences`,
  `requiresMarks`, `excludes`) found one real gap — mutual exclusion — added
  to `moveSchema` as `excludes` even though no current Book I move uses it
  yet, so the day one does it's a data change, not a schema change mid-UI.
  `requiresConsequences`/`requiresMarks` are Major Arcana-specific
  (commit 105's problem, not this one) and weren't spliced in speculatively.

  `pack.test.ts`'s existing round-trip test (every manifest file resolves to
  a schema and parses) now exercises all seven at full strictness for free;
  a new snapshot captures each insert's meaningful interior ids (invocation
  names, initiate ids, consequence ids…), and a new test confirms every
  ghost/revenant consequence's `childOf`/`requires` reference resolves
  within its own list — the same dangling-reference check playbooks already
  get. 448/448 tests passing (2 new), tsc/eslint/prettier/validate:packs
  clean.

- **Insert attachment model** (commit 99). `StonetopCharacter.inserts` — a
  map from insert id (`insert-crew`, `insert-followers`…) to that insert's
  own state blob, present in the map means attached — plus pure
  `attachInsert`/`detachInsert` and `autoAttachedInsertIds`, the rule table
  behind "class inserts attach themselves" (phase 14 intro): Invocations to
  the Lightbearer, Crew to the Marshal, and Initiates of Danu to a Blessed
  with the Initiate background all key off `playbookId`/`backgroundId`
  directly since those grants are guaranteed; Animal Companion keys off
  actually holding the `animal-companion` move, since not every Ranger
  picks it. All four rules run against the raw blob only — no pack fetch
  — so they work equally inside the engine, `migrateCharacter`, and (commit 106) the wizard.

  `SCHEMA_VERSION` bumps to 3. `migrateCharacter` treats a genuinely missing
  `inserts` field (the v2 shape) as a one-time migration and seeds it with
  whatever the character already auto-qualifies for — a saved Lightbearer
  wakes up with Invocations attached without a re-save. A blob that already
  has an `inserts` field, even `{}`, is left exactly as saved: a player who
  detached an auto-attach insert stays detached on reload, same as any
  other edit — the rules run once, on the version bump, not on every load.
  `insert-inventory` was deliberately left out of this map; the Outfit
  keeps its own dedicated `inventory` field and always-present tab, unlike
  the "+"-tab inserts this commit tracks.

  15 new tests (`character.test.ts`, `advancement.test.ts`) cover all four
  auto-attach rules (including the "same background id, wrong playbook"
  and "gained via advancement, not just at creation" edge cases),
  attach/detach idempotency, and the v2→v3 migration fixture. 446/446
  passing.

- **Per-playbook e2e golden paths** (commit 98, opening Phase 14). One
  data-driven Playwright spec (`e2e/playbook-golden-paths.spec.ts`) builds a
  character for all nine playbooks through the wizard and asserts each
  sheet shows a fixed starting move unique to that playbook — fixed moves
  render on the sheet with no wizard interaction required, unlike fixed
  possessions (gated behind the player picking at least one optional item).
  The Fox is the one playbook with no fixed starting moves, so its case
  picks the first `pickOne` option before continuing. The playbook loop
  reads the pack's own list, so a tenth playbook is covered for free; this
  is the safety net for the rest of Phase 14, which reworks both the wizard
  and the play sheet.

- **Spoiler opt-in replaces the GM gate** (commit 97, closing Phase 13). The
  book itself says players may read Book II if they want to, so "you may see
  it if you run a table" was the wrong shape — this replaces campaign-GM
  membership with a reader's own opt-in preference
  (`REFERENCE_SHOW_SETTING`, commit 96), persisted once and remembered.

  A new `GameModule.referenceSpoilers` config slot (`badge`, `toggleLabel`,
  optional `interstitialSectionId`) keeps Stonetop's vocabulary — "Setting"
  instead of "GM", the checkbox copy — out of shell code; Stonetop's own
  entry points its interstitial at Book II's own "Should the players read
  this?" passage. The reference layout resolves `showSetting` from
  `locals.prefs` when signed in, or `localStorage` when signed out
  (reconciled on mount via `invalidate('reference:showSetting')` if the
  two disagree); the search page's checkbox writes through
  `savePreference` and immediately reflects the change via a writable
  `$derived`, no round-trip lag. A gated section a reader hasn't opted into
  no longer 404s: `[section]/+page.ts` renders the configured interstitial
  passage in its place, with an inline "Include this — take me back" button
  that opts in and reloads the same load in place, same URL.

  `isGmOfAnyCampaign` (`$lib/server/db/campaigns.ts`) and the GM
  index-gating it drove are gone from the live `[game=game]` reference
  routes; the function itself stays only because the legacy `/g/[game]`
  redirect tree (unreachable — every route there 301s before rendering,
  commit 95) still imports it and this sandbox can't delete files. New e2e
  coverage in `reference-spoilers.spec.ts`: toggle on the search page reveals
  a Book II hit and survives a reload signed out; the interstitial shows
  and clears on opt-in. `campaigns.spec.ts`'s old "GMing reveals Book II"
  assertion is removed — that's no longer how it works.

- **User preferences** (commit 96, opening Phase 13). A small generic
  `preferences` table (`userId`, `key`, `value`, composite primary key) —
  `$lib/server/db/preferences`'s `getPreferences`/`setPreference`/
  `clearPreference` — plus a `preferences` handle in `hooks.server.ts` that
  loads a signed-in viewer's whole map onto `locals.prefs` once per request
  (after `auth`, before route handling), so a server-rendered page can read
  a preference without its own round trip. `PUT /api/preferences` is the
  write path. A signed-out reader gets the same key/value shape in
  `localStorage` instead (`$lib/preferences/client`, namespaced
  `splatbook:pref:<key>`) — deliberately with no migrate-on-sign-in the way
  drafts get: a preference set while signed out is a browser default, not a
  server intent, so switching accounts on a shared machine can't leak one
  account's preference into another's row. `$lib/preferences`'s
  `REFERENCE_SHOW_SETTING` constant is the first key, ready for commit 97's
  spoiler opt-in to consume; this commit only builds the plumbing.

  Also: this sandbox's `better-sqlite3` mac-arm64 binary now has a real
  fix, not just a workaround-the-workaround. `bindings.js` always resolves
  the native addon from a fixed path
  (`node_modules/better-sqlite3/build/Release/better_sqlite3.node`), so a
  second copy elsewhere never helped — but `$HOME` (unlike the project
  mount) supports normal file operations, so building a real Linux binary
  there (`npm pack` + `npm install --ignore-scripts` + `npm run
build-release`, using the sandbox's gcc/g++/make/python3) and
  bind-mounting its `build/` directory over the broken one, inside the same
  `unshare --mount` session already used for `.svelte-kit`/`node_modules/
.vite`, took the full suite from 46 failing (every `db/*.test.ts` file)
  to **431/431 passing**. Documented in `CLAUDE.md` for the rest of this
  phase, which touches the database heavily.

- **Games at the root — `/stonetop`, "Ringwall" retired** (commit 95,
  closing Phase 12). Game routes move from `/g/[game]` to `/[game=game]`:
  `src/params/game.ts` is a new matcher accepting only a registered game id
  (`listGames()`), so a static route (`/campaigns`, `/dashboard`, `/privacy`,
  …) can never be shadowed by a game segment — SvelteKit already gives
  static path segments priority over dynamic ones, but the matcher makes
  that contract explicit and turns an unknown "game" segment into a clean
  404 instead of a route that renders and fails deeper in its own `load`.
  Every `resolve('/g/[game]…')` call site updates to `resolve('/[game=game]…')`
  (mechanical, caught by `tsc`); one real bug turned up doing it —
  `render.ts`'s wikilink-resolution built its reference deep-links by
  hand-concatenating `${base}/g/${gameId}/reference/${id}` rather than going
  through `resolve()`, so it had silently kept pointing at the old prefix.
  Fixed, with `render.test.ts`'s three link-resolution assertions updated to
  match.

  The old `/g/[game]/…` tree's nine leaf routes each keep a
  `+page.server.ts` (`$lib/server/legacy-routes.ts`'s `legacyRedirect()`
  helper) that 301s to the new address, params and query string intact, so
  bookmarks and shared links survive. The rest of each old route directory
  (`+page.svelte`, `+page.ts`) is now dead — unreachable, since the redirect
  load throws before they'd ever run — but couldn't be deleted in this
  sandbox (see the environment note below); **Chris: `git rm -r
src/routes/g` once you're back on the real filesystem**, same as the two
  stray files flagged in commit 91. `eslint.config.js`'s
  `svelte/no-navigation-without-resolve` exemption (pages that append a
  `?id=` query to a resolved path) keeps a glob for the dead tree alongside
  the new one, for the same reason.

  The "Ringwall" codename this deployment used for the Stonetop module
  (`/g/stonetop`, served as its own identity rather than descriptively) is
  retired: a name nobody searches for was an indirection tax, and the
  disclaimer already does the legal work `/credits` needs. Every place that
  named it — the game module's doc comment, `README.md`, `docs/
architecture.md`, `docs/adding-a-game.md`, this repo's `CLAUDE.md` — now
  presents the module descriptively ("a Stonetop companion," served at
  `/stonetop`), never as "Stonetop" the product's own brand: the CC BY-SA
  license covers Jeremy Strandberg's text, not a name for the app to claim.

  Verified with `tsc --noEmit`, `eslint`, `prettier`, and — for the first
  time this phase — a genuinely working `vitest` and `vite build` in this
  sandbox: mounting a tmpfs over `.svelte-kit/` and `node_modules/.vite/`
  inside an unprivileged `unshare --mount` namespace routes around the
  mount's inability to unlink existing files (the same limitation that
  blocked `svelte-kit sync` for commits 91–94), without touching the real
  files underneath. `vite build` completes end to end (the adapter's final
  output-directory cleanup still trips the same unlink limit on a stray
  `.DS_Store`, unrelated to this change); the full suite runs, 372 of 418
  tests passing — the other 46, across four `db/*.test.ts` files, fail on
  `better-sqlite3`'s mac-arm64 binary not loading on this Linux sandbox
  (`invalid ELF header`), a pre-existing environment gap this workaround
  doesn't reach, not a regression.

- **Book theme refresh** (commit 94). Stonetop's skin trades EB Garamond for
  the vault's own book theme: **Avara** (Raphaël Bastide / Velvetyne Type
  Foundry) for H1–H4 — the book's actual display face, 900-weight chapter
  titles — **Libre Caslon Text** for body (the free stand-in for the book's
  Adobe Caslon), **IM Fell English** as the fallback accent face. All SIL
  OFL. Libre Caslon Text and IM Fell English ship as `@fontsource` packages
  (same pattern as the outgoing EB Garamond); Avara has no such package, so
  `tools/extract_avara_font.py` pulls its three `@font-face` rules out of
  the vault snippet's embedded base64 and writes them back out as real
  `static/fonts/*.woff2` files plus `fonts-avara.css` — a one-off, run once
  against the mounted vault, not part of the regular content pipeline (the
  font doesn't change when the rules text does).

  The reference body (headings, links, the ornamental `hr`, book-ruled
  tables, italic blockquotes) picks up the vault theme's look, scoped under
  `[data-game="stonetop"] .reference-body` so it never touches another
  game's typography. Commit 93's generic `.sb-callout` box gets its ink-on-
  paper skin via the `--sb-callout-*` hooks it already exposed, plus two
  kind-specific touches: `[!move]` gets a heavier box rule so a page of
  moves reads as a sequence of entries, and `[!monster]` gets a small
  swords mark by its label (Lucide's `swords` icon, ISC license — not one
  of the icons derived from Feather, so this is its ISC term alone). This
  is the one trade-dress-adjacent icon this commit ships; Strandberg's
  confirmed permission (via the Hearthfire project's README) covers the
  actual playbook/Seasons-Change/monster icon set for a later pass, once
  there's a traced set to ship.

  Checked with `tsc --noEmit`, `eslint`, `prettier`, and a `postcss.parse`
  syntax check of the new CSS (a full `vite build` isn't possible in this
  sandbox — see the environment note below); every referenced font and
  icon file's presence and woff2 magic bytes verified by hand.

- **Callout rendering** (commit 93). Obsidian callouts (`> [!move] …`,
  `[!box]`, `[!monster]`, …) now render as styled `<aside>` boxes — a
  small kind-labelled header plus the de-quoted, re-parsed body — instead
  of a plain `<blockquote>` with literal `[!type]` text leaking through.
  A dedicated `marked` block extension (`$lib/reference/render.ts`'s
  `calloutExtension`, on its own `Marked` instance so it doesn't touch the
  app's other markdown) recognizes an embedded callout inline; a
  kind-tagged section (its _heading_ opened the callout — commit 90's
  `kind` field) boxes its own leading quoted run the same way via
  `leadingQuotedRun()`/`renderCalloutBox()`, without ever synthesizing a
  fake `[!type]` opener into the body. Wikilinks that target a note's
  named block id (`[[Note#^blockId|Label]]` — the vault's newer, stable
  cross-reference form, replacing fragile heading-text anchors) now
  resolve too: `LinkIndex` grew a `byBlockId` map alongside `byTitle`.
  `[section]/+page.ts` passes the section's `kind` through to
  `renderMarkdown`; the reference page picked up `.sb-callout`/
  `.sb-callout-label` CSS, generic and kind-neutral for now (a game theme
  skins a specific kind via `--sb-callout-*`, or `.sb-callout-<kind>`
  directly — commit 94).

  Four real-data bugs found and fixed along the way, each with a
  regression test: a greedy `\s?`/`\s*` around a `>` marker matches a
  newline too, so a naive de-quote merged a callout's own blank-line
  paragraph breaks into one paragraph (every such pattern in this file
  and `search-fields.ts` now says `[ \t]`, never `\s`, where it means
  "space within a line"); a consecutive run of callouts with no blank
  line between them (`09 - Threats`' one `[!box]` per threat type) had
  the first one's greedy `>`-continuation swallow every sibling whole,
  de-quoting their own `[!type]` openers into literal text — fixed with
  a negative lookahead (`CALLOUT_OPEN`) in both `CALLOUT_BLOCK`'s
  continuation group and `leadingQuotedRun`; and stripping a block id
  down to nothing (rather than to a bare `>`) broke that same unbroken
  `>`-line run for a callout sitting right after one, so marked's
  _default_ blockquote tokenizer (which doesn't know about
  `CALLOUT_OPEN`) grabbed the next callout first — caught by a synthetic
  regression test after a full real-data sweep had already gone clean,
  which is its own lesson: real data covers what the vault happens to
  contain, not every shape the code allows.

  Verified against all 3,073 sections across both books (0 render
  errors, 0 unstyled `[!type]`/block-id leaks); 307 of 309 kind-tagged
  sections box cleanly, the other 2 fall through to plain, unleaked text
  because the vault drops the callout's own `>` mid-paragraph before any
  real content follows it (`03 - Playing the Game`'s DEFEND, `02 -
Getting Started`'s "Making corrections") — flagging for Chris rather
  than papering over with a heuristic. This sandbox's `vitest` remains
  unrunnable (see the environment note below); checked with `tsc
--noEmit`, `eslint`, `prettier`, and the same kind of sed-stubbed
  `tsx` scripts used for commit 91, run against every test case in
  `render.test.ts`/`search.test.ts` by hand.

- **Chapters are the reference's spine** (commit 92). The rules landing page
  now lists each book's actual chapters (commit 90's `chapters` list, in
  reading order — a card per source file, like the book's own contents page)
  instead of a filtered slice of level-1 sections, which broke down before
  the vault cleanup once OCR turned every stray `#` into a spurious "chapter."
  The sidebar's disclosure tree is now chapter-shaped too: one collapsible
  entry per chapter, capped at its own h2 children — a section's `chapter` id
  (commit 90) picks which chapter owns it and which one auto-expands, no more
  ancestor-walking `level`/`path`. Deeper headings (h3+) stay reachable from
  the section page itself (its existing "In this section" child list), not
  listed in the sidebar — a nav that lists every h5 is a list, not a map.
  `TocSection`/`TocDocument` (`$lib/reference/load`) grow `chapter`/`chapters`
  to carry this through from the trees.

- **Book I & II reimported from the cleaned vault** (commit 91). `rules/book-i.json`
  goes from 1421 to 1309 sections (29 chapters), `book-ii.json` from 2003 to 1764
  (58 chapters) — the drop is moves and monsters consolidating into their own
  callout-tagged sections rather than being smeared across stray sub-headings.
  Page anchors are gone from every section (`pages` was already optional; the
  vault links headings directly now, so the `^pNNN` remap is a no-op). Search
  index and both derived move files rebuilt to match.

  `tools/build_moves.ts` broke on the new content and needed a real fix, not
  just a rerun: a move's body now lives inside a `[!move]` callout, which
  `build_srd.py` deliberately leaves as raw blockquote markdown (`> text`,
  trailing `^move-id`) for the reference renderer (commit 93) to style. This
  script wants the plain text underneath for play-sheet data, so it now
  de-quotes each callout body before extracting it. Diffed against the
  pre-reimport shipped JSON: byte-identical except the wikilink anchors
  (`#AID` → `#^aid`, matching the vault's new stable block-id links) — one
  case (`muster`) legitimately lost a second cross-reference the vault cleanup
  itself removed. Spot-verified `movesRollStats` and the basic/steading move
  ids by hand (this sandbox's vitest is currently unrunnable — see the
  environment note below); all matched what the existing tests assert.

  Two stray output files with no vault source anymore (`20 - Index.md`,
  `59 - Index.md` — already excluded from both books' document trees) were
  flooding `build_rules.py`'s link verifier with hundreds of false positives
  from their pre-cleanup content. Emptied rather than deleted: this sandbox's
  mount can't unlink existing files. **Chris: `git rm` both once you're back
  on the real filesystem.** One pre-existing gap remains out of scope, same as
  commit 89 — `11 - Sites` still links a `.canvas` embed `build_rules.py`
  doesn't resolve.

- **Chapters in the document tree** (commit 90). `build_srd.py` now emits a
  document-ordered `chapters` list — one node per source file, `id` (the
  file-slug prefix its section ids are built from), `title`, and an optional
  `number`, both parsed from the filename (`03 - Playing the Game.md` →
  number 3, title "Playing the Game"; an unnumbered file, e.g. a
  `Playbooks/*.md` entry, is still its own chapter). Every emitted section now
  carries a matching `chapter` id. `documentTreeSchema` grows both fields —
  `chapters` on the tree, `chapter` on each section, both optional so
  yesterday's committed trees (regenerated in commit 91) still validate — plus
  a cross-check that a section's `chapter` names a chapter that actually
  exists. Previously file identity was smeared into section-id prefixes and
  lost to the UI; this makes it a first-class node the reference browser can
  key its chapter list off (commit 92).

- **Callout-aware rules pipeline** (commit 89). `build_rules.py` and
  `build_srd.py` now recognize an Obsidian callout that opens with a heading
  (`> [!move] ## **CLASH**`) as a section, the same as a plain `#…` heading —
  it's linkable, and its callout type travels onto the section as
  `documentSectionSchema`'s new optional `kind` field (`"move"`, `"monster"`,
  `"box"`, …) for future styling/filtering. Same-note links (`[[#CLASH|…]]`,
  no filename prefix) now resolve too, in both the page-anchor remap and the
  verifier — previously only `[[File#Heading]]` was checked. Verified
  end-to-end against the cleaned Stonetop vault: 0 callout/heading-related
  link problems (2 pre-existing, unrelated gaps remain — a missing `20 -
Index` note and a `.canvas` embed, neither in scope here).

### Fixed

- **The reference search page crashed kit's client on any visit with `?q=`
  in the URL.** The effect that keeps `?q=` shareable compared rebuilt-URL
  hrefs against `page.url`, and the two can disagree over encoding alone
  (`%20` in the incoming URL vs the `+` URLSearchParams serialises) — so on
  a direct visit to a search URL the effect called `replaceState` _during
  hydration_, before kit's router had initialised. In dev that's the
  "Cannot call replaceState(...) before router is initialized" guard; in
  prod the guard is compiled out and the call crashed mid-start
  (`root.$set` on undefined), wedging every later shallow-routing and
  `invalidate` call on the page — which is why opting into Book II spoilers
  from such a URL saved the preference, re-ran the load, updated the TOC,
  and still never refreshed the page's own data or loaded the GM index
  (`reference-spoilers.spec.ts`, diagnosed from the CI trace's pageError
  events). The effect now compares decoded param values against `location`
  (always current, unlike `page.url`, which never updates on shallow
  routing) and simply doesn't write when the query hasn't changed — which
  is also the only case that could fire before interactivity.

- **Play-sheet tabs never switched in the browser.** `activeTab` was derived
  from `page.url.searchParams`, but SvelteKit's `replaceState` (shallow
  routing) updates `page.state` reactively while deliberately leaving
  `page.url` at its load-time value — so `selectTab` changed the address bar
  and nothing else; every tab click was a silent no-op (verified against
  kit 2.69.2's client source: `replaceState` assigns `page.state` and
  re-notifies, never touches `page.url`). Caught by the e2e suite's first
  ever run against a real browser — seven specs failing on "heading not
  found" right after a tab click, plus the Seeker golden path. The live tab
  now rides in `page.state.tab` (typed via `App.PageState` in `app.d.ts`);
  the URL write stays, but only for a shareable, reload-surviving `?tab=`.

- **Finishing the character wizard duplicated the character on the next
  page load.** `finish()` saved the entity and navigated to the sheet
  without clearing the wizard's localStorage autosave; the root layout's
  `migrateLocalDrafts` — whose once-per-account guard (`migratedFor`) is
  component state, reset by any full page load — then pushed the leftover
  draft up as a second character row. Surfaced as
  `campaign-arcana-gm.spec.ts`'s strict-mode failure: two identical "Attach"
  buttons, because the campaign page listed two copies of the character.
  The builder (both route trees) now clears the draft immediately after a
  successful save; the signed-out path still keeps it, deliberately — the
  local sheet reads it.

- **e2e triage after the suite's first real-browser run** (15/24 failing).
  Beyond the two app bugs above: `smoke.spec.ts` still used the pre-commit-95
  `/g/` URLs; `dice-panel.spec.ts` asserted text that legitimately renders
  twice (roll surface + recent-rolls list — the surface now carries
  `aria-label="Roll result"` and the assertion scopes to it);
  `playbook-golden-paths.spec.ts` registered the Marshal's `waitForResponse`
  after the click that triggers the fetch (now `Promise.all`) and matched the
  Ranger's Animal Companion with an unanchored regex that also hit a disabled
  button naming it as a prerequisite; `miss-marks-xp.spec.ts` built its
  character blind-Next, which leaves `stats` empty — and the play sheet only
  renders a "Roll +STAT" button for an assigned stat, so the spec now spends
  the stat array on the way through; `reference-spoilers.spec.ts` asserted
  absence against the SSR shell (the result list only exists client-side) and
  could click the opt-in checkbox before hydration, a click Svelte silently
  undoes when it claims the DOM — it now waits for the results line first.

- **Vault: `[!monster]` callouts weren't linkable.** Today's statblock-boxing
  pass (vault-side, not this repo) opened each with `> [!monster] **Name**` —
  bold, no heading marker — which broke every existing anchor link that
  targeted a monster by name. Added `## ` to match `[!move]`'s convention.

- **Privacy policy and terms of service** (`/privacy`, `/terms`, linked from the
  footer). Google's OAuth consent screen will not leave Testing mode without both
  URLs, and it fetches them to check they resolve — so the public site could not
  admit anyone beyond a hand-listed set of test users until these existed. Written
  to be true rather than boilerplate: they claim no analytics and no third-party
  tracking, which is currently the case. **If a migration ever adds a table holding
  personal data, or a tracking script lands, `/privacy` must change with it.**
- **The Cloudflare/D1 deployment path.** The database is now resolved **per
  request** (`event.locals.db`) — D1 through `platform.env.DB` on Cloudflare, the
  SQLite file on node/atlas — because the Workers runtime has no long-lived
  process to hold a connection and cannot bundle `better-sqlite3` at all. Auth.js
  is likewise built per request, since its Drizzle adapter needs a database that
  doesn't exist until a request arrives. No module imports a `db` singleton any
  more. Verified end to end against a real Workers runtime with local D1.

## [2.1.0] - 2026-07-11

Table-ready polish, drafted from a round of play-testing after v2.0. No new
phases of the framework promise — this is Ringwall becoming pleasant to actually
sit down and run: themed, self-explanatory front to back, with a character and a
steading you can roll from and a session you can close.

### Added

- **Tri-state theme (commit 70).** The theme control cycles system → light →
  dark instead of a sticky binary. "System" is the default and stays live,
  tracking the OS through a `matchMedia` listener; the pre-paint script honours
  the same stored value.
- **A real landing page (commit 71).** Home is a front door rather than an
  "under construction" notice: what Splatbook is, a card per registered game
  (build / reference / run) generated from the registry, and a sign-in prompt
  that says what an account buys you.
- **Stonetop's own skin (commit 72).** EB Garamond (self-hosted, OFL),
  uncoated-paper backgrounds, near-black ink, a Great Wood green, and a dark
  variant for the table at night. The game themes itself under
  `html[data-game="stonetop"]`; the shell's only contribution is stamping the
  attribute (server-side, so it's right on the first paint).
- **Campaigns on the game landing (commit 73).**
- **The wizard's choices-so-far rail (commits 74–75).** A summary panel beside
  every step — sticky on desktop, a drawer on mobile — that updates as you
  choose and links each row back to the step that owns it. Fed by a generic
  `summary(draft)` hook on the entity type; Stonetop resolves ids to the names on
  the page by reading its pack.
- **Review jumps to its sections (commit 76).** Every row and every validation
  error on the review screen is a link back to the step that fixes it.
- **Stat taps roll; debilities get their own control (commit 77).** Tapping a
  stat rolls +that stat — the thing you do a hundred times a session — and the
  debility moves to its own toggle, labelled with its name from the pack.
- **Solo rolling and a result surface (commit 78).** Rolling no longer depends on
  being in a campaign, and the result floats over the sheet instead of hiding in
  a panel you've scrolled past. Fronted by the character's name.
- **Rolls fronted by the character (commit 79).** The roll surface and the shared
  log lead with the character; the account name is small print. Stored with the
  roll, so the log still reads right after a rename.
- **XP banks past the level threshold (commit 80).** You earn the point that
  levels you mid-session and keep playing; there is now somewhere to put it, and
  the surplus carries over the level-up.
- **Overload warning at load 10+ (commit 81).** Past the heaviest band the sheet
  says so, instead of showing a dash.
- **Moves on the sheet (commit 82).** Your moves first, then the basic ones, each
  rollable where its text says what it rolls. Adds `data/basic-moves.json` to the
  pack, lifted out of the rules prose by `tools/build_moves.ts`.
- **Character sheet PDF export (commit 83).** Completes the export deferred in
  commit 34: a print stylesheet that _is_ the PDF's design, with a button on the
  sheet and play views. No headless browser, so it works on every deploy target.
- **The steading is named Stonetop (commit 84),** and is still editable.
- **A steading play sheet with steading rolls (commit 85).** Tap its stats, turn
  the season, mark its debilities, and roll its own moves — the change of seasons
  (+Fortunes) first. Adds `data/steading-moves.json`.
- **End of session (commits 86–87).** The GM runs the move: the table answers the
  two personal prompts per character and the four group questions, and the XP is
  marked on every sheet at once. Notable events are kept, and if the season
  turned, the steading rolls its Fortunes and advances. Engine is pure and
  tested; an e2e test drives the whole loop and asserts the XP that lands on the
  sheet.

### Changed

- **Dice moved from the game to the entity type.** A roll belongs to the thing
  being played: a character rolls its stats, a steading rolls its own moves and
  no longer offers "Roll +STR".
- **`registerGame` replaces a repeat id rather than throwing,** the same contract
  `registerPackSchemas` already had — the dev server re-evaluates SSR modules and
  must survive it. Two different games claiming one id is still a bug, now caught
  where it can originate (`BUILT_IN_GAMES`, asserted unique).
- The campaign's steading link says "Open tracker", not "Edit steading".

### Fixed

- **The dev server served every page as a client-side 500.** Game modules call
  `registerPackSchemas` on import, which dragged the node-only pack `fs-loader`
  into the client bundle, where Vite externalises `node:fs/promises` and
  hydration died. Production builds tree-shook it away, which is why only `npm
run dev` showed it. The loader is now imported lazily, inside the one function
  that needs it and never runs in a browser.
- **"Roll +DEX" rolled a flat `2d6`,** silently throwing the stat away: the
  modifier lives inside the character, which the shell holds opaquely and could
  not read. The dice module gained a `resolve` hook; Stonetop resolves against
  `effectiveStat`, so a marked debility is priced in and the dice can't disagree
  with the sheet.
- **Printing hid the character's name.** The print rule hid `header` by element,
  which matched the _sheet's_ header too.
- Session notes said "yours to keep" and kept nothing.

## [2.0.0] - 2026-07-11

Shared play — **campaigns and dice**. A GM starts a campaign and invites players
by link; characters attach to it, the party sees each other at a glance, and a
GM-owned steading and the reference GM gate come with the seat. On top of that, a
generic dice engine with per-game presets, a roller on the play sheet, and a live
shared roll log the whole table watches.

### Added

- **Campaigns — tables & membership (phase 9, commit 58).** Two new shell tables,
  generic like `entities`: `campaigns` (a game-tagged table a group gathers
  around, with an `ownerId` and a rotatable, unguessable `inviteToken`) and
  `campaign_members` (one seat per (campaign, user) with a `gm`/`player` role,
  enforced by a composite primary key). Both foreign keys cascade on account
  deletion. Migration `0002` and round-trip schema tests included.
- **Campaign create + invite (phase 9, commit 59).** A `/campaigns` area: list
  the campaigns you're seated in (with your GM/player role) and start a new one
  (which seats you as GM). Each campaign page carries a copyable invite link
  built from an unguessable token; the GM can rotate the token to revoke
  outstanding invites. Campaign access is membership-gated in the service layer —
  a non-member gets a 404, not a peek. New `campaigns` service (create, lookups,
  per-user listing, token rotation) with unit tests, plus a Campaigns nav link.
- **Join flow + attach characters (phase 9, commit 60).** Opening an invite link
  (`/campaigns/join/<token>`) shows a join confirmation and seats you as a
  player; it's idempotent (the GM opening their own link isn't demoted) and
  prompts sign-in first when needed, returning to the same link. Entities gained
  an optional `campaign_id` (migration `0003`, `set null` on campaign delete), so
  a character belongs to at most one campaign by construction — the campaign page
  lists your characters for that game with attach / move-here / remove controls.
  New service functions (`joinCampaign`, `setEntityCampaign`, `listCampaignEntities`)
  with unit tests.
- **Campaign dashboard (phase 9, commit 61).** The campaign page now leads with
  party-at-a-glance: every member (GM-first) with the characters they've attached
  to the campaign, plus a campaign-steading slot. Your own characters link to
  their sheets; teammates' show as read-only names (sheets stay owner-scoped).
  New `listCampaignMembers` roster query with a test.
- **Reference GM gate (phase 9, commit 62).** The phase-2 hardcoded
  `GM_CONTENT_VISIBLE = false` is now a real permission: GM-only rules (Book II)
  appear in the table of contents, section pages, and search **only** for a
  viewer who GMs a campaign in that game (`isGmOfAnyCampaign`, computed
  server-side and threaded to the reference loads as `gmContentVisible`). Search
  gained a separate GM-only index (`search-index-gm.json`), built alongside the
  player index and loaded only when the gate is open; GM hits are tagged in
  results. `isVisible` now fails closed (hidden unless explicitly granted).
- **Campaign-owned steading (phase 9, commit 63).** A GM can create a steading
  the whole party shares; it's an ordinary steading entity attached to the
  campaign, so it also appears on the GM's dashboard. Every member sees it at
  `/campaigns/<id>/steading` — read-only, rendered by the game's own steading
  sheet — while the owner gets an Edit link to the normal editor. The shell
  creates it game-agnostically via the module's `newDraft`/`entityMeta`.
- **Invite/join e2e + polish (phase 9, commit 64).** A Playwright spec drives the
  whole loop across two accounts: a GM creates a campaign, a second person opens
  the invite link, signs in, joins as a player, and then appears in the GM's
  party roster — plus a check that running a campaign opens the reference GM gate.
- **Dice engine (phase 10, commit 65).** A generic, game-agnostic dice core in
  the shell (`$lib/dice`): a notation parser for `XdY±mod` (multiple dice terms,
  signed flat modifiers, whitespace/case tolerant, malformed input rejected) and a
  `roll` function with an injectable rng — so every result is deterministically
  testable — that also does advantage/disadvantage the way that generalises the
  d20 rule: roll one extra die per term and drop the lowest (advantage) or highest
  (disadvantage), keeping dropped dice in the result for display. No game
  vocabulary lives in the core. Games contribute only **presets** through a new
  optional `GameModule.dice` slot — named, ready-to-roll expressions
  (`{ id, label, notation, mode?, meta? }`) the shell can list and roll without
  learning the game's rules; the game-specific bits (which stat a roll adds) ride
  in an opaque `meta` bag. Stonetop registers its PbtA move rolls — a plain `2d6`
  and one `Roll +STAT` per stat, the stats drawn from the engine's `STAT_KEYS` so
  they can't drift. Pure and unit-tested; the per-campaign roll log and the sheet's
  roll UI (commits 66–68) build on this core. `docs/architecture.md` and
  `docs/content-packs.md` document the slot.
- **Roll log (phase 10, commit 66).** A new shell table, `rolls`, records every
  dice roll made in a campaign as shared history: keyed by campaign (not by
  roller), with the roller (`actorId`), the game-supplied `label` (e.g.
  `Roll +DEX`), and the dice engine's `RollResult` stored whole — a shape the
  shell owns and reads back, unlike a game's opaque entity `data`. Both foreign
  keys cascade (a roll dies with its campaign or its roller's account). The new
  `rolls` service appends (member-guarded — you can only add to a table you sit
  at) and lists a campaign's log newest-first with each roller's name, breaking
  same-millisecond ties on the monotonic rowid so insertion order is preserved.
  Migration `0004`, with service and cascade tests. The roll UI (commit 67) and
  the live polling view (commit 68) build on this.
- **Dice UI on the sheet (phase 10, commit 67).** Play mode now carries a dice
  roller: a generic shell component (`DiceRoller`) driven by the game's `dice`
  presets — so it holds no game vocabulary, the labels and notation come from the
  module. It rolls with the shell engine, has a normal / advantage / disadvantage
  switch, and shows recent results inline (dropped dice struck through). Rolling
  always shows a local result; when the character is attached to a campaign the
  roll is also POSTed to the shared log (`/api/campaigns/[id]/rolls`, session- and
  membership-guarded, with the browser-supplied `RollResult` validated by
  `rollResultSchema` before storage), while a character in no campaign just rolls
  locally. No `PlayProps` change — the roller is shell furniture beside the game's
  play component. The live shared-log view lands in commit 68.
- **Live roll log (phase 10, commit 68).** The campaign page now shows the shared
  roll log — every member's rolls, newest first, with the roller, the label, the
  dice (dropped ones struck through) and total, and a relative timestamp. It's
  seeded server-side from the page load and kept live by a small `RollLog`
  component that polls a session- and membership-guarded `GET` endpoint
  (`/api/campaigns/[id]/rolls`) every few seconds; polling pauses while the tab is
  hidden and never overlaps a slow response. A short poll is deliberate — plenty
  for a table, with SSE/Durable Objects reserved for if it ever feels laggy. The
  wire shape (`RollLogEntry`) is shared by the endpoint and the page load.

## [1.0.0] - 2026-07-11

Public **v1.0.0** — the Stonetop companion, complete: build a character through
the wizard and print the sheet; play, mark trackers, and level up with the rules
enforced; run a steading across the seasons; read and roll the GM guide and track
threats; sign in to save everything. Plus a searchable rules reference, a
credits/licensing page, and a deployment that runs on atlas (adapter-node) today
and Cloudflare Pages + D1 when it goes public. Built inside the framework boundary
from day one, so game #2 is "write a module and a pack," not a refactor.

### Added

- **Credits & licensing page (phase 8, commit 53).** A public `/credits` page,
  linked from the footer (alongside a Support link). Three parts: the
  application's own licence (GPL-3.0-or-later) with a link to the source and
  credits to the prior art it's modelled on (guild-book, the Registrar); each
  game's _text_ licence and attribution, pulled live from the pack manifests
  (`license` / `attribution`), so a new game appears automatically with its
  CC BY-SA share-alike notice and "independent production" disclaimer; and this
  deployment's support links — a Ko-fi tip jar and a DriveThruRPG affiliate link
  with a plain-spoken disclosure (costs the buyer nothing extra, creators are
  paid in full). The SPDX→label/link/share-alike mapping is a small unit-tested
  helper (`$lib/credits`); operator links live in `$lib/support`.
- **GM guide (phase 7).** Stonetop's GM playbook is now an in-app reference
  guide at `/g/stonetop/gm` — read-only, so it's not an entity type. The GM pack
  schema (`the-gm.json`) is now fully validated (typed `GmPlaybook`) rather than
  a loose envelope, and the guide renders from it across nine sections: the
  agenda/principles/core loop, GM moves & harm, threats and their type move
  lists, expeditions & travel (with the Die-of-Fate and weather tables), sites &
  discoveries, monster & follower build procedures, NPCs, home/downtime/
  aftermath, and the flow of play (commit 49). A game opts in through one
  optional `gmGuide` slot on its `GameModule` (`packFile` + `sections` +
  `component`); the shell serves and navigates it generically without inspecting
  the pack shape. `docs/content-packs.md` documents the slot.
- GM guide **interactive tables** (commit 50): the Die-of-Fate tables (When the
  Way is Perilous, Make Camp) and the six seasonal weather tables are rollable —
  tap to roll a d6 and the matching row lights up. The eight threat types are a
  picker with a "Suggest a move" random-portent button, and travel times gained
  a live place filter. The range-parsing and die-roll logic is a small pure
  module (`gm/roll.ts`) with unit tests; the components are thin shells over it.
- GM guide **flow diagrams** (commit 51): the flow of play renders as a node/edge
  diagram — the six campaign phases on a ring with curved, labelled, arrowed
  transitions — and the core loop as a numbered cycle with a "repeat" arc. Both
  are dependency-free SVG built from the pack's nodes/edges (and step) data; the
  ring layout and edge routing are a pure, unit-tested geometry module
  (`gm/diagram.ts`). The labelled transition list and step text remain beneath
  each diagram as the text-equivalent.
- **Threat worksheets (phase 7, commit 52).** Stonetop's _third_ entity type — a
  GM worksheet for a lingering threat: its type, tracker (Homefront / Nearby /
  Distant), instinct, description, impending doom with markable grim portents,
  and optional stakes and moves. Editor-first like a steading (no wizard); a
  chosen type offers its GM-move list to drop into the worksheet, and there's a
  read-only print sheet. Threats save to the database and appear in the dashboard
  alongside characters and steadings — the entity-type map absorbed the third
  type with no shell changes, only a new `threat` entry and its pure engine
  model (`engine/threat.ts`, unit-tested). Reachable from the game home, the
  dashboard, and a link in the GM guide's Threats section.

- **Steading builder (phase 6).** Stonetop's second entity type. A
  steading has no build wizard — it's an editable tracker sheet from creation,
  reached via "Create a steading" on the game home or a fresh draft in the
  editor. The engine model covers the five numeric stats
  (Fortunes/Surplus/Population/Prosperity/Defenses) with their printed ranges,
  the Size ladder, the four-season cycle, and the three debilities, all as pure
  clamped functions. The editor (commit 44) steps stats, walks Size, picks the
  season, and toggles debilities, autosaving as you go. The steading pack schema
  (`the-steading.json`) is now fully validated rather than a loose envelope.
  Improvements (commit 45) render as collapsible cards: the engine normalises
  each Improvement's `requires` tree — `all`, choose-N, either-or, nested
  "establish" picks, sequenced follow-ups, and multi-box "Pull Together"
  requirements — into checklist groups, decides when requirements are met, and
  drives a Mark-complete toggle. Ticking a requirement is a pure engine op; the
  stat bumps an Improvement grants stay manual on the tracker.
- Steading **lists** (commit 46): editable Resources, Fortifications, Assets
  (with silver/gold treasure tallies) and Places of Interest (marker + name,
  suggesting the next map marker). A fresh steading is seeded once from the
  pack's printed starting entries and marked `seeded`, so lists you empty aren't
  refilled. Write-ins are just added rows.
- Steading **residents & neighbours** (commit 47): NPC tables. Residents are
  name / occupation / notes rows with `<datalist>` pickers drawn from the pack's
  Welsh name list, prefilled occupations, and NPC trait list; neighbours add a
  home select over the pack's places, with each place's own name list offered
  for the name field.
- Steading **print sheet & dashboard** (commit 48): a read-only, print-friendly
  steading sheet (stats, marked debilities, lists, completed Improvements,
  rosters) in the `sheetComponent` slot. Signed-in steadings now save to the
  database and appear in the dashboard alongside characters — an editor-first
  type creates its DB row on first edit and adopts the id, so there's no
  "Finish" step. The dashboard is now entity-type-agnostic (each row shows its
  type) and titled "Your sheets".

### Changed

- **`GameModule` now carries an `entityTypes` map** instead of a single flat set
  of character slots. Each entity type (`character`, `steading`, …) is keyed by
  its persisted `entityType` and owns its own optional
  `label` / `newDraft` / `entityMeta` / `wizardSteps` / `sheetComponent` /
  `playComponent`. The shell iterates the map rather than hard-coding
  `character`: routes moved from `/g/[game]/{build,play,sheet}` to
  `/g/[game]/[type]/{build,play,sheet}`, and the landing page, dashboard, and
  save/load read the type from the map key. Editor-first types (no wizard) route
  their "create" action straight to the editor (`playComponent`) and seed a fresh
  draft there. This is the phase-6 boundary generalization — the second entity
  type (steading) forced it; `entityMeta` no longer self-reports `entityType`
  (it's the map key). `docs/architecture.md` and `docs/content-packs.md` updated
  to match.

### Fixed

- `validate:packs` runs again: pack-schema registration moved to a UI-free
  module (`src/lib/games/schemas.ts`) so the tool no longer drags Svelte
  components through tsx. `registerGame` still wires schemas for the app shell;
  new games must register in both places.
- Playwright smoke: the fresh-database reset now runs inside the
  `webServer.command` chain (`e2e/reset-db.ts`) instead of `globalSetup`, which
  fired after the server had already opened (and kept a handle to) the old
  database file — every CI run failed with "no such table: users".
- CI workflow: `actions/checkout` and `actions/setup-node` bumped to v5,
  clearing the Node 20 runner deprecation warning.

## [0.2.0] - 2026-07-10

A character survives a whole campaign arc — the phase-5 milestone. Everything
since v0.1.0: accounts and persistence (phase 4), then play mode, advancement,
and the inventory sheet (phase 5).

### Added

- Inventory / Outfit view in play mode, driven by `insert-inventory.json` (whose
  insert schema is now firmed up from the loose envelope). Mark the gear and
  small items you're carrying; the total ◇ load shows your band (light / normal
  / heavy) and its tags. "Undefined" ◇ pools model marks reserved during Outfit
  but not yet assigned, and a per-item "← assign" action implements _Have What
  You Need_ — spending undefined marks onto a specific item. Inventory state
  lives on the character model (filled by the migration); all the load maths and
  transfers are pure engine functions with unit tests.
- Advancement log: the character sheet and play mode now show, in order, when
  each move (and stat bump) was gained — "Level N: <Move>", annotated with the
  raised stat or the move it replaced. The sheet's move list now reflects the
  character's current holdings (creation moves plus advancement, minus retired
  moves) and shows the character's level in the header.
- Advancement special cases (rules-as-data + engine + play UI):
  - **Improved / Superior Stat** now raise a stat. Both moves carry a
    data-driven `statBump` cap (Improved +2, Superior +3); the level-up flow
    prompts for which stat, offers only stats below the cap, and the engine
    applies the capped +1 and records which stat was raised.
  - **Potential for Greatness → Superior Stat gate.** The Would-be Hero's
    Potential for Greatness is now a 6-box tracker, and its Superior Stat is
    gated (via a new `requires.tracker` in the pack) on all 6 marks rather than
    a level — enforced in the legal-choices engine.
  - **Would-be Hero's asterisk rule.** Once the character holds an asterisk move
    (the level-6 replacements), play mode offers a "cross off Would-be" action;
    doing so flags the character a Hero (a new generic `flags` map on the model,
    filled by the migration).
- Level-up flow in play mode: once banked XP clears the threshold, a "Level Up"
  button opens a panel of only the legal moves (per the engine's gates,
  prerequisites, caps, and replacements), each shown with its rules text. Pick
  one and confirm; the engine spends the XP, raises the level, records the pick,
  and the change autosaves. Cancel backs out. Multiple level-ups in a row are
  supported — the button reappears while enough XP remains.
- Level-up legality in the engine (pure, heavily unit-tested): given a character
  and its playbook, which moves are legal to take on Level Up, and applying the
  chosen one. Level gates (a `requires.level` move opens as you reach that
  level), prerequisite moves (`requires.moves` / `childOf` must be held),
  repeat caps (`maxTakes` — Improved Stat ×3, etc.), and replacements (a move
  with `replaces` retires the named move and is only offered while it's still
  held). `applyLevelUp` spends the XP cost (6 + twice the current level), gains
  a level, records the pick in an advancement log, and re-syncs move-trackers so
  a newly-gained tracker move appears. The character model gains an
  `advancement[]` log (schema v2) with a tolerant `migrateCharacter` that
  upgrades older blobs on load.
- Play mode: an editable, at-the-table view of a finished character at
  `/g/<game>/play`, reached from the character sheet. Tap-to-mark HP, XP, and
  move-trackers; tap a stat to toggle its debility (which shows the reduced
  effective value and the playbook's debility name). A "Ready to Level Up" cue
  appears once banked XP clears the threshold (the level-up flow itself lands
  next). Every edit runs a pure engine function and autosaves — to the database
  when playing a saved entity, else to the same local draft slot the sheet
  reads. The shell gained a generic `playComponent` slot alongside the sheet
  slot; the route stays game-agnostic and persists whatever the game returns.
- Play-mode state model (engine, pure + unit-tested): the rules over a character
  _in play_. Vitals seed from the playbook the first time a finished character
  enters play (HP fills to max, base damage recorded; re-entry preserves current
  HP, only re-clamping). Move-trackers (Boon, Resolve, Piety…) reconcile against
  the moves a character currently holds — a tracker appears when its move is
  gained and vanishes when it's retired, marks preserved and re-clamped.
  XP/level helpers implement Stonetop's threshold (Level Up at XP ≥ 6 + twice
  your level); stat debilities drop a stat's effective value by 1 until treated.
  `enterPlay` seeds vitals + trackers idempotently, so characters built before
  play mode gain them without a migration.
- Playwright end-to-end smoke: sign in with dev-login, build a character in the
  wizard, finish (saving it), reload the saved sheet from the database, and
  confirm the print view drops the app chrome. Runs against the production build
  on a freshly-migrated throwaway SQLite database; kept in `e2e/` (separate from
  the vitest suite) as `npm run test:e2e`, with a dedicated CI job that installs
  the browser and runs it.
- Stonetop character export to JSON and Obsidian-flavoured Markdown, from the
  sheet (screen-only buttons, hidden when printing). JSON wraps the character in
  an identifying, re-importable envelope; Markdown emits YAML frontmatter
  (name, playbook, stats, tags) plus sectioned body (stats, moves with text,
  background notes, possessions, introductions), rendering by name/text when the
  playbook is loaded and falling back to ids otherwise. Serializers are pure and
  unit-tested; PDF export stays deferred until the sheet design settles.
- Dashboard at `/dashboard` — the signed-in user's saved characters grouped by
  game, each row opening its saved sheet or offering duplicate, archive/
  unarchive, and delete. A "Characters" header link appears when signed in; an
  archived-toggle reveals archived entries; signed-out shows a sign-in prompt.
  Backed by new item endpoints (`PATCH`/`DELETE /api/entities/<id>` and
  `POST /api/entities/<id>/duplicate`) over the existing ownership-scoped
  service; the grouping/formatting helpers are unit-tested.
- Save and load characters to the database. A `userId`-scoped entity service
  (create/update/get/list/status/delete/duplicate — ownership enforced in every
  query) backs a REST endpoint: `GET/POST /api/entities` and
  `GET /api/entities/<id>`, both session-guarded. Finishing the builder while
  signed in persists the character and opens its saved sheet (`?id=`); the sheet
  loads a saved entity by id, else the local autosave. Drafts built while logged
  out migrate to the database on sign-in (best-effort, once per account). The
  shell never parses the blob — a new `GameModule.entityMeta` hook has the game
  supply name/entityType/schemaVersion. Service, client helpers, and migration
  logic are unit-tested; ownership isolation is covered explicitly.
- Authentication via Auth.js (`@auth/sveltekit` + Drizzle adapter). A zero-config
  **dev-login** provider is on by default so local work needs no OAuth setup;
  Google and Discord switch on automatically when their id/secret env vars are
  set (and `AUTH_DEV_LOGIN=false` retires dev-login for production). Credentials
  forces the JWT session strategy, so the user id is threaded token → session
  (`session.user.id` typed via augmentation); the adapter still persists
  users/accounts. Added the adapter tables (accounts/sessions/verification
  tokens, second migration), the server hooks handle, a root layout load
  exposing the session, and a header sign-in/out control. Provider gating and
  the id plumbing are unit-tested.
- Database schema for accounts and saved entities (phase 4). `users` carries the
  Auth.js Drizzle-adapter column shape so the coming auth wiring drops straight
  onto it. `entities` is the one universal persistence model: a saved
  character/steading is a single opaque JSON `data` blob per row, tagged with
  `gameId` / `entityType` / `schemaVersion` and a `draft`/`ready`/`archived`
  status, owned by a user (cascade delete), indexed for the dashboard's
  by-owner/by-game queries. The shell never parses `data`; the owning game
  module does. First generated migration under `drizzle/`; round-trip tests run
  it against in-memory SQLite (blob survives write/read, defaults populate, FK
  cascade and enforcement hold).

## [0.1.0] - 2026-07-10

Build any Stonetop character end to end and print it — the phase-3 milestone.

### Added

- Character sheet and print view: `/g/<game>/sheet` renders the finished
  character (chosen options only, laid out like the printed playbook — header,
  stats, moves with text, background notes, possessions, introductions) from the
  autosaved draft, via the game module's new `sheetComponent` slot (typed
  `SheetProps`; wired with the same contained cast as wizard steps). A toolbar
  offers Print and a link back to the builder; print CSS drops the app chrome so
  the sheet prints clean. The builder's Finish now opens the sheet.
- Introductions and review wizard steps. Introductions renders the playbook's
  numbered round-the-table ritual with optional free-text notes per step. Review
  summarizes every choice (name, playbook, background, instinct, origin,
  appearance, stats, moves, possessions) and runs the full validator, listing
  anything still missing so the player can jump back — or confirming the
  character is ready to finish.
- Extras wizard step: the playbook-specific back-page sections (sacred pouch,
  tall tales, war stories, fear & anger, collection…), fully data-driven from
  the pack — intro text, pick-one-per-line lists, nested choices, and free-text
  prompts. New typed `ExtrasSectionState` on the character model; the validator
  requires each line and nested pick (prompts stay optional). Playbooks with no
  extras skip the step cleanly.
- Possessions wizard step: fixed gear is listed, then the player picks the
  allowed number from the options — some carrying sub-choices (rendered with the
  shared `ChoiceGroup`) or a free-text write-in slot. The engine validator
  enforces the exact pick count, filled write-ins, and each item's own nested
  picks (shared `possessionChoiceKey`/`isWriteInPossession` helpers).
- Starting-moves wizard step — the rules-lawyer core. Shows what the playbook
  and background grant, resolves each "choose one" group, and gates free picks
  to the count allowed, with level-2+ moves excluded and prerequisite/`childOf`
  moves disabled until their parent is taken. Engine gains pure, test-first move
  logic (`startingMovesPlan`, `pickOneSelections`, `freeChosenMoves`,
  `fullMoveSet`, `isStartable`, `prerequisitesMet`, `choosableMoves`) and a moves
  validator enforcing one-per-group, the exact choose count, and legality of
  every chosen move.
- Stats wizard step: distribute the playbook's fixed six-number array across
  STR/DEX/CON/INT/WIS/CHA, each value used once, with values disabling as they're
  spent and live "all assigned" feedback. Engine gains pure, test-first stat
  helpers (`assignStat`, `clearStat`, `assignedValues`, `remainingValues` with
  multiset arithmetic, `isStatArrayComplete` permutation check) and a stats
  validator gating on a complete assignment.
- Instinct, appearance, and origin/name wizard steps. Instinct picks one of the
  playbook's drives, with a write-in option that reveals a text field (new
  `instinctWriteIn` on the character model). Appearance picks one descriptor per
  printed line. Origin chooses where you're from and names the character, with
  suggested names from the chosen origin as one-tap fills. Engine validators for
  all three replace their stubs (instinct chosen + write-in text when needed,
  one pick per appearance line, origin chosen and character named).
- Background wizard step: choose a background, see what it grants (moves, notes,
  a tracker), and resolve any nested "choose N" picks (e.g. the Blessed's
  initiates, with a free-text write-in). Adds shared wizard components —
  `Markdown` (trusted pack markdown), `OptionButton` (selectable card), and
  `ChoiceGroup` (a controlled sub-choice picker) — and a memoised
  `fetchPlaybook` so every step downstream of playbook-select shares one fetch.
  Engine gains pure, unit-tested sub-choice logic (`selectionCount`,
  `isSelectionValid`, `canPickMore`, `toggleOption`) and real validators for the
  playbook and background steps (replacing their stubs): a character now needs a
  playbook, a background, and each background pick within range.
- Playbook-select step and the character builder route: `/g/<game>/build`
  renders a game's wizard from the registry (steps + a `newDraft` factory, the
  new generic `GameModule` slot for seeding a draft) without importing game
  code, so any game that registers a wizard gets a builder for free. Stonetop's
  first step lists the nine playbooks with their flavor text (fetched from the
  pack via `fetchPlaybookSummaries`, which projects id/name/flavor and skips the
  steading/GM sheets); picking one records it on the draft and the shell
  autosaves. A "Build a character" link joins "Rules reference" on the game
  landing page. Loader unit-tested (file filtering, projection, fetch-error).
- Generic wizard shell (`src/lib/wizard/`): a game-agnostic step runner that
  renders a game module's ordered `WizardStep`s one at a time with a progress
  bar and Back/Next, and autosaves the working draft to localStorage so a
  half-built character survives a reload. The shell never inspects the draft's
  shape — steps read the content pack, the shell just navigates. Pure,
  unit-tested logic (`navigation`: index clamping, next/prev, progress fraction;
  `autosave`: namespaced `draftKey`, save/load round-trip over an injected
  storage, corrupt-JSON tolerance) sits behind a thin `Wizard.svelte`. Steps are
  registered with `defineWizardStep` (the single contained cast around Svelte's
  contravariant component props); `GameModule.wizardSteps` is now typed
  `readonly WizardStep[]`. Stonetop registers no steps yet — those land next.
- Stonetop engine skeleton (`src/lib/games/stonetop/engine/`): the game's pure
  rules layer, attached to the module's `engine` slot and opaque to the shell. A
  Stonetop-specific character model (playbook/background/instinct/appearance/
  origin/stats/moves/possessions/extras/introductions plus box trackers, HP, and
  advancement), stamped with a `SCHEMA_VERSION` the module will migrate against.
  Pure helpers (`createCharacter`, `setTrackerMarks` clamping to `[0, boxes]`,
  `statValue`) and a validation framework: one `Validator` per wizard step keyed
  by `StepId`, composed by `validateCharacter` into severity-tagged `Issue`s with
  `isComplete` gating on errors. Only the schema-version check has teeth today;
  the per-step validators are empty stubs that firm up as their steps land
  (21–28). No UI/DB/SvelteKit imports; unit-tested.
- GM-only visibility flag and Book II ingest: Stonetop's Book II (The Wider World,
  2,003 sections) is now built into the pack as `rules/book-ii.json`, flagged
  `gm`. A single gate (`GM_CONTENT_VISIBLE` in `$lib/reference/load`, `false` for
  now) drops GM content from the table of contents, returns 404 for GM sections
  addressed directly, resolves wikilinks only against visible content, and
  excludes GM text from the public search index. `build_srd.py` now writes an
  explicit `visibility` on every section. This is an application-level hide, not
  access control — phase 9 (campaigns) makes it a real GM gate.
- Expandable search snippets (`$lib/reference/snippet`): each result now shows the
  first sentence that mentions a query term with the terms highlighted (`<mark>`,
  apostrophe-flexible), a "more" control that expands the snippet in place to its
  surrounding sentences, and the title still links to the full section — the
  snippet → context → full-section progression lifted from Chris's Obsidian rules
  tool. Keystrokes are debounced. The search index now stores each section's
  plain-text body so snippets work offline; unit tests cover tokenizing,
  highlighting (with HTML escaping), and snippet windowing.
- Client-side rules search (`/g/<game>/reference/search`): a MiniSearch index is
  built at build time from the document trees (`tools/build_search.ts`, `npm run
build:search`) and served as a static `search-index.json`, so search runs
  entirely in the browser — no server cost, works offline once cached. Live
  prefix + fuzzy matching over titles, breadcrumbs, and body text with title
  boosting; results link to sections; a search box sits in the reference sidebar
  and the query syncs to a shareable `?q=`. Shared index config and markdown→text
  prep (`$lib/reference/search-fields`) keep the builder and client in agreement;
  unit-tested including a serialize→load round-trip. Adds `minisearch`.
- Rules reference section browser (`/g/<game>/reference`): a table-of-contents
  sidebar (nested from heading levels, auto-expanding the active branch), section
  pages with breadcrumb ancestors, in-section child lists, and document-order
  prev/next. Every heading is its own page with a shareable deep link. Section
  bodies render from markdown via `marked`, with Obsidian wikilinks resolved to
  in-app reference links where their target is identifiable and falling back to
  plain label text otherwise. Loading/navigation helpers (`$lib/reference/load`)
  and the renderer (`$lib/reference/render`) are unit-tested; `buildSectionTree`
  is now generic so the lightweight TOC nests the same way full sections do.
  Adds `marked` as a dependency.
- SRD build script (`tools/build_srd.py` + `tools/srd.config.json`): the second
  stage of the content pipeline, turning the generated rules markdown into
  document-tree JSON in the pack (`rules/*.json`). Each heading becomes a section;
  over-long OCR-artifact headings are demoted to body text; back-matter (index,
  acknowledgements) is excluded via config. Book I ingested as `rules/book-i.json`
  (1,421 sections), wired into the Stonetop manifest and `schemaFor` resolver, and
  validated by `npm run validate:packs`. Regenerate with `python3 tools/build_srd.py`.
- Document-tree format (`$lib/reference/document-tree`): the generic shape any
  game's rules/SRD text takes in a content pack. A flat, document-ordered list of
  sections (stable `id`, `title`, heading `level`, ancestor `path`, `body`
  markdown, optional print `pages`, `player`/`gm` `visibility`); hierarchy is
  rebuilt from `level` by `buildSectionTree` while search stays linear. Section
  ids are validated unique within a tree. Round-trip tests cover defaults, strict
  keys, level bounds, tree-building, and duplicate detection.
- `docs/content-packs.md`: pack format reference (envelope, validation, strictness
  policy) and the first draft of the "adding a new game" walkthrough. Kept current
  with any commit touching the pack boundary.
- Round-trip tests for the Stonetop pack: every manifest file parses into its typed
  structure through the harness; playbook/background/instinct/move/insert ids are
  snapshotted so accidental renames fail CI; move references (starting, grants,
  requires, childOf, replaces) are checked to resolve within their playbook.
- Stonetop content pack (`static/content-packs/stonetop/`): 9 character playbooks,
  9 inserts, the steading, and the GM playbook (2nd printing text, CC BY-SA 4.0,
  attribution Jeremy Strandberg / Lampblack & Brimstone; pack-level LICENSE note).
  Stonetop Zod schemas written from the pack's SCHEMA.md — playbooks validate
  strictly; insert/steading/GM interiors stay loose until their phases consume
  them. First registered game module: `/g/stonetop` resolves.
- `GameModule` interface and registry — the only door between shell and game code
  (`id`, `name`, `packSchemas` now; engine/wizard/sheet slots firm up in phase 3).
  Registering a game wires its pack schemas into the validation harness. Game routes
  live under `/g/[game]`; header nav links registered games (no picker until game #2).
- Pack validation harness: Zod schemas for the generic envelope (manifest, document
  tree); game modules register per-file schemas via `registerPackSchemas()`, and
  `npm run validate:packs` checks every pack on disk — unregistered games and
  unrecognised files are errors, not warnings. CI-friendly (non-zero exit).
- Content-pack envelope: `PackManifest` type (`id`, `name`, `version`, `license`,
  `attribution`, `files`) and a node-side loader (`$lib/packs/fs-loader`) that checks
  the envelope contract — id matches folder, listed files exist — for build tooling
  and validation. Packs live under `static/content-packs/<gameId>/`.
- SvelteKit 2 scaffold: Svelte 5 (runes forced), TypeScript strict, Vitest.
- GPL-3.0-or-later license for the application source.
- Tailwind CSS v4 with semantic theme tokens (`--sb-*` custom properties) that game
  modules can override per `data-game` scope; light/dark mode with pre-paint script.
- App shell layout: header, nav placeholder, footer, theme toggle.
- ESLint (flat config, typescript-eslint + eslint-plugin-svelte), Prettier with svelte
  and tailwind plugins, and a GitHub Actions CI running lint/check/test/build.
- Drizzle ORM + better-sqlite3 with an (intentionally) empty schema, `db:push` /
  `db:generate` / `db:migrate` / `db:studio` scripts, and a `/api/health` endpoint
  that pings the database.
- Multi-stage Dockerfile (adapter-node) and docker-compose with a SQLite volume
  for the atlas deployment; container healthcheck hits `/api/health`.
- `docs/architecture.md`: the three layers, the GameModule boundary rules, the
  entity blob model, theming and naming conventions.
