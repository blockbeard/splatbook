# Manual test checklist — v2.2.0 + follow-ups

*Written 2026-07-17 for the binder release (commits 110–122) plus the review
follow-ups (private GM notes, undo coalescing, LocalDate). Everything below
passed unit/e2e where covered, but none of it has met a human in a real
browser yet. Work top to bottom — the order builds its own test data. Tick as
you go; jot UI gripes inline and turn anything real into a GitHub issue.*

**Setup:** `npm run dev` with `AUTH_DEV_LOGIN=true`. You'll want **two browser
profiles** (or one normal + one private window): one signed in as **GM**, one
as **Player** — several of the new features are about what the player must
*not* see. Do a mobile-width pass (devtools, ~390px) wherever marked 📱.

## 1. Shell & landing

- [ ] `/stonetop` landing shows: Create a character / Create a steading /
      Create a threat, Rules reference, **Moves & gear** (new), GM guide,
      Campaigns. All navigate.
- [ ] Footer: **Feedback** link opens the GitHub issues page in a usable state.
- [ ] `/privacy` reads correctly — the analytics disclosure paragraph is there,
      dated 17 July 2026, and no longer claims "no analytics of any kind".
- [ ] View page source in dev: **no** Cloudflare beacon `<script>` (it should
      only render in production with `PUBLIC_CF_BEACON_TOKEN` set).
- [ ] Theme toggle still works on the new pages (Moves & gear, session log).

## 2. Moves & gear page (commit 113) — `/stonetop/table`

- [ ] Basic moves: all ten, correct text, no stray `>` marks or `^anchor`
      litter from the vault.
- [ ] Special moves: Advantage/Disadvantage, Burn Brightly, End of Session,
      **Death's Door** — and Death's Door ends at the move (no "discussed in
      detail…" trailer).
- [ ] Move names deep-link to the right reference section (commit 115) — spot
      check Clash → Player Moves chapter, and use Back to return.
- [ ] Gear list: slots render as ◇, tags/uses/notes legible, nothing overflows.
- [ ] Small items and Prosperity render; write-in blank lines are *absent*.
- [ ] 📱 The gear rows wrap acceptably at phone width.

## 3. Character: wizard → sheet → PDF

- [ ] Golden-path a character through the wizard (any playbook — try one you
      haven't lately; the Seeker or Would-be Hero exercise the odd corners).
- [ ] Sheet view: **Download PDF** button appears (saved characters only) and
      downloads `<name>.pdf`.
- [ ] Open the PDF: name in Avara, subtitle playbook · background · level,
      stat row (mark a debility first — it should show an `x`), vitals line,
      every held move with full text, possessions, inventory, introductions.
- [ ] PDF quality pass: text doesn't overflow the page edge, no `?` characters
      scattered in move text (that would be the sanitiser flattening something
      it shouldn't), page breaks don't orphan a move name from its text.
- [ ] **Booklet** button: downloads `<name>-booklet.pdf`, landscape pages,
      two panels per page. If you're feeling thorough: print duplex
      (flip on short edge), fold, and check the page order reads through.
- [ ] Print / Save as PDF (the old path) still works from sheet and play views.
- [ ] A **draft** (unsaved) character shows no Download PDF button.

## 4. Play mode

- [ ] Tabs: Sheet · Moves · Inventory (+ inserts). Switch, reload — the tab
      survives. Switch tab on an **unsaved draft**, make an edit, wait for the
      autosave to adopt an id — the tab should **not** snap back to Sheet
      (the commit-114 fix; this was broken before).
- [ ] **Undo**: tap HP down — toast bottom-left "Change saved. Undo". Undo
      restores it; reload and confirm the server agrees.
- [ ] Undo depth: make 3 separate edits (pause ~2s between), undo all three,
      one at a time.
- [ ] Undo coalescing: type a sentence into a text field (steading editor's
      notes or a follower name) — the toast should sit quietly and **one**
      undo reverts the whole burst of typing, not one letter.
- [ ] 📱 Undo toast vs roll surface: roll a miss (repeat until ≤6), tap Mark
      XP — the undo toast and the roll card should both be visible/usable,
      not stacked on top of each other.
- [ ] Move cards on the Moves tab: names are links to the full rules
      (playbook moves are *not* links — only basic moves are; check both).
- [ ] Dice panel, damage buttons, miss-marks-XP: quick regression roll-through.
- [ ] Header: **Download PDF** (saved only) + **Print** + Moves & gear link all
      present and not crowding each other. 📱 check the header wraps sanely.

## 5. Steading

- [ ] Steading editor: moves list renders, each move name links to its
      Homefront rules section, Roll +stat buttons still roll.
- [ ] Steading sheet/print view unaffected.

## 6. Campaign setup (GM + Player windows)

- [ ] GM: create campaign, copy invite, create campaign steading.
- [ ] Player: join via invite, attach a character.
- [ ] GM: "Can edit the steading" toggle on the player row (phase 16). Grant →
      player can open the tracker and edit; changes persist. Revoke → player
      is read-only again (reload their window).
- [ ] Roll log: rolls from play mode appear for both windows within a few
      seconds; timestamps hover-tooltip shows a sensible full date.

## 7. End of session (GM window)

- [ ] Run the move: check personal prompts + group questions, XP total math
      reads right.
- [ ] Notable events box now says **"everyone in the campaign can read
      these"** — visible before you type, not buried.
- [ ] **Private notes** box below it, clearly GM-only. Fill both.
- [ ] Mark XP on every sheet → "Marked." XP landed on the character
      (check the sheet).
- [ ] Type notes, reload the page *without* marking — both drafts survived
      (localStorage). Then mark — drafts clear (revisit the page: boxes empty).
- [ ] Turn the season / Roll +Fortunes still work and hit the roll log.

## 8. Session log (dashboard)

- [ ] GM window: Session 1 with date, "N XP across the party", per-character
      award lines, shared notes, and the bordered **Private notes (GM only)**
      block.
- [ ] Date reads in your locale after load (it may render as `2026-07-17` for
      a blink on slow connections — that's the LocalDate upgrade, acceptable;
      anything uglier is a bug).
- [ ] GM: **Edit notes** → two labelled boxes (shared + private) → save →
      both stick. Cancel works.
- [ ] **Player window**: sees the session, date, XP, shared notes — and
      **no private notes block, no Edit notes button**. Also check the network
      tab on the player's page load: the JSON must not contain the private
      text anywhere (it's stripped server-side — verify the claim).
- [ ] Run a second end-of-session → Session 2 numbers correctly, newest first.

## 9. Reference regressions

- [ ] Search works; Book II stays behind the spoiler opt-in; a gated hit shows
      the Setting badge; the interstitial appears for a first-time deep link.
- [ ] A move deep-link from the play sheet lands on a section with the
      callout styled (not raw `[!move]` text).

## 10. Odds and ends

- [ ] Arcana authoring (GM) and play-side arcana cards: quick open, no errors.
- [ ] Dashboard lists characters/steadings/threats as before.
- [ ] Sign out / sign back in: nothing above broke.
- [ ] Console: no errors anywhere along the way (warnings worth noting too).

---

*Found something? UI nits → jot them here or straight into GitHub issues
(the footer link works now — commit 116 says so, prove it).*
