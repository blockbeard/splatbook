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

- [x] `/stonetop` landing shows: Create a character / Create a steading /
      Create a threat, Rules reference, **Moves & gear** (new), GM guide,
      Campaigns. All navigate.
- [x] Footer: **Feedback** link opens the GitHub issues page in a usable state.
- [x] `/privacy` reads correctly — the analytics disclosure paragraph is there,
      dated 17 July 2026, and no longer claims "no analytics of any kind".
- [ ] View page source in dev: **no** Cloudflare beacon `<script>` (it should
      only render in production with `PUBLIC_CF_BEACON_TOKEN` set).
      ????? nothing obvious but I don’t really know where to look
- [x] Theme toggle still works on the new pages (Moves & gear, session log).
Edit steading looks like back button

Console:
Error in parsing value for '-webkit-text-size-adjust'. Declaration dropped. [0.Db-qXaus.css:2:2746](https://splatbook.app/_app/immutable/assets/0.Db-qXaus.css "View source in Style Editor → https://splatbook.app/_app/immutable/assets/0.Db-qXaus.css:2:2746")

Elements matching selector: html, :host

NodeList [ html.cuxhszk.idc0_350 ]

## 2. Moves & gear page (commit 113) — `/stonetop/table`

- [ ] Basic moves: all ten, correct text, no stray `>` marks or `^anchor`
      litter from the vault.
      Still seeing `see [[06 - Player Moves#^aid|Aid]]` etc on the links
- [ ] Special moves: Advantage/Disadvantage, Burn Brightly, End of Session,
      **Death's Door** — and Death's Door ends at the move (no "discussed in
      detail…" trailer).
- [ ] Move names deep-link to the right reference section (commit 115) — spot
      check Clash → Player Moves chapter, and use Back to return.
link exists as markdown text, no actual link
- [x] Gear list: slots render as ◇, tags/uses/notes legible, nothing overflows.
      looks good, x piercing could link the prosperity section on the same page
- [x] Small items and Prosperity render; write-in blank lines are *absent*.
- [x] 📱 The gear rows wrap acceptably at phone width.

## 3. Character: wizard → sheet → PDF

- [ ] Golden-path a character through the wizard (any playbook — try one you
      haven't lately; the Seeker or Would-be Hero exercise the odd corners).
      Appearance - needs a write in. Can't uncheck once you make a selection. 
      Ranger - something wicked this way comes - needs an answer box for the questions
- [x] Sheet view: **Download PDF** button appears (saved characters only) and
      downloads `<name>.pdf`.
- [ ] Open the PDF: name in Avara, subtitle playbook · background · level,
      stat row (mark a debility first — it should show an `x`), vitals line,
      every held move with full text, possessions, inventory, introductions.
      Introduction text flows off the page. PDF opend fine in firefox but when I download it all the Avara text is fucked - e.g. possessions renders as `%#$$! $$&#' $`
- [ ] PDF quality pass: text doesn't overflow the page edge, no `?` characters
      scattered in move text (that would be the sanitiser flattening something
      it shouldn't), page breaks don't orphan a move name from its text.
      Long text chunks flow off the page and don't reappear. 
      Background should be white or it will be a printer nightmare. 
- [ ] **Booklet** button: downloads `<name>-booklet.pdf`, landscape pages,
      two panels per page. If you're feeling thorough: print duplex
      (flip on short edge), fold, and check the page order reads through.
- [ ] Print / Save as PDF (the old path) still works from sheet and play views.
- [ ] A **draft** (unsaved) character shows no Download PDF button.

## 4. Play mode

- [x] Tabs: Sheet · Moves · Inventory (+ inserts). Switch, reload — the tab
      survives. Switch tab on an **unsaved draft**, make an edit, wait for the
      autosave to adopt an id — the tab should **not** snap back to Sheet
      (the commit-114 fix; this was broken before).
      + inserts just show a +, no way to know which insert. Better to kep it clean and have an add insert button with a menu
        Inserts need an option to remove the inseert too.  
- [x] **Undo**: tap HP down — toast bottom-left "Change saved. Undo". Undo
      restores it; reload and confirm the server agrees.
- [x] Undo depth: make 3 separate edits (pause ~2s between), undo all three,
      one at a time.
- [x] Undo coalescing: type a sentence into a text field (steading editor's
      notes or a follower name) — the toast should sit quietly and **one**
      undo reverts the whole burst of typing, not one letter.
- [x] 📱 Undo toast vs roll surface: roll a miss (repeat until ≤6), tap Mark
      XP — the undo toast and the roll card should both be visible/usable,
      not stacked on top of each other.
- [ ] Move cards on the Moves tab: names are links to the full rules
      (playbook moves are *not* links — only basic moves are; check both).
      links are unparsed markdown
- [x] Dice panel, damage buttons, miss-marks-XP: quick regression roll-through.
- [x] Header: **Download PDF** (saved only) + **Print** + Moves & gear link all
      present and not crowding each other. 📱 check the header wraps sanely.
Stats, should have seperate toggles for weakened/miserable/dazed that apply to both stats
## 5. Steading

- [ ] Steading editor: moves list renders, each move name links to its
      Homefront rules section, Roll +stat buttons still roll.
      debiities dont apply the effects
      Links un unparsed markdown, same for horses, I assume italic isn intended not seeing the **
      Size should change with population
      Don't ned a moves and gear link on the play surface. 
      Steading sheet link to edit steading should be edit/play
      in progress improvements should be recorded on pdf 
      Should have an export to markdown option like characters
      Herd of horses says: When you _meet the requirements_, increase Fortunes by 1 and replace "a pair of sturdy draft horses" with "a herd of horses" on the Assets list. Make a note of its size. it needs to do that in the sheet ideally
- [x] Steading sheet/print view unaffected.

## 6. Campaign setup (GM + Player windows)

- [x] GM: create campaign, copy invite, create campaign steading.
- [x] Player: join via invite, attach a character.
      Characters view needs a create a character button
      When in a campaign finishing a character build needs an option to attach to campaign or leave unassigned
- [ ] GM: "Can edit the steading" toggle on the player row (phase 16). Grant →
      player can open the tracker and edit; changes persist. Revoke → player
      is read-only again (reload their window).
      Does not go back to read only after unchecking
- [ ] Roll log: rolls from play mode appear for both windows within a few
      seconds; timestamps hover-tooltip shows a sensible full date.
PLayer sheet rolls add to log, steading logs do not
GM should be able to see player shets
Cn add arcana to player sheet but only custom one. Mysteruy unlocks on a single mark. 
## 7. End of session (GM window)

- [x] Run the move: check personal prompts + group questions, XP total math
      reads right.
- [x] Notable events box now says **"everyone in the campaign can read
      these"** — visible before you type, not buried.
- [x] **Private notes** box below it, clearly GM-only. Fill both.
- [x] Mark XP on every sheet → "Marked." XP landed on the character
      (check the sheet).
      would be cool if this auto-updated the sheets
- [ ] Type notes, reload the page *without* marking — both drafts survived
      (localStorage). Then mark — drafts clear (revisit the page: boxes empty).
      Boxes stay filled, checkboxes don't 
      
- [ ] Turn the season / Roll +Fortunes still work and hit the roll log.
      turn the season works but no feedback, stays on current season until reload
      Seasons change box should show the current season info not all 4. 

## 8. Session log (dashboard)

- [ ] GM window: Session 1 with date, "N XP across the party", per-character
      award lines, shared notes, and the bordered **Private notes (GM only)**
      block.
      Notes should add at end, this will get long. 
- [x] Date reads in your locale after load (it may render as `2026-07-17` for
      a blink on slow connections — that's the LocalDate upgrade, acceptable;
      anything uglier is a bug).
- [x] GM: **Edit notes** → two labelled boxes (shared + private) → save →
      both stick. Cancel works.
- [x] **Player window**: sees the session, date, XP, shared notes — and
      **no private notes block, no Edit notes button**. Also check the network
      tab on the player's page load: the JSON must not contain the private
      text anywhere (it's stripped server-side — verify the claim).
- [x] Run a second end-of-session → Session 2 numbers correctly, newest first.

## 9. Reference regressions

- [x] Search works; Book II stays behind the spoiler opt-in; a gated hit shows
      the Setting badge; the interstitial appears for a first-time deep link.
- [ ] A move deep-link from the play sheet lands on a section with the
      callout styled (not raw `[!move]` text).
      Playshet links don't work

## 10. Odds and ends

- [x] Arcana authoring (GM) and play-side arcana cards: quick open, no errors.
      custom only, needs pre-written
- [ ] Dashboard lists characters/steadings/threats as before.
      no threats link I can see
- [x] Sign out / sign back in: nothing above broke.
- [ ] Console: no errors anywhere along the way (warnings worth noting too).
https://svelte.dev/e/hydration_mismatch DprF0_FR.js:1:3481
Error in parsing value for '-webkit-text-size-adjust'.  Declaration dropped. 0.Db-qXaus.css:2:2746
---

*Found something? UI nits → jot them here or straight into GitHub issues
(the footer link works now — commit 116 says so, prove it).*
