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

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
