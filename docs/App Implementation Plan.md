# Companion App — Implementation Plan (commit by commit)

*Drafted 2026-07-10; split 2026-07-16. This file holds only **unbuilt** work: the next unbuilt commit is the top of the first phase below. Completed phases (0–15, commits 1–109) live in [[App Implementation History]] — append-only, decisions preserved. **Housekeeping rule:** when a phase completes, move its section to the history file verbatim in the same commit that closes it (milestone commits already do docs work; this rides along). Anything still listed here is not built.*

*The framework is **Splatbook** (splatbook.app); the first game module is a Stonetop companion at `/stonetop`. The framework-question essay, the naming story, and the Ringwall retirement are in the history file.*

## Ground rules

- Every commit builds, type-checks (`npm run check`), and passes tests. No broken states in history.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); scopes: `shell`, `packs`, `reference`, `stonetop`, `wizard`, `play`, `steading`, `gm`, `db`, `auth` — grown since by use: `tools`, `campaigns`, `e2e`, `ci`, `cloudflare`, and `ops` (monitoring/backup). A `content:` type covers data reimports (commit 91).
- Saved blobs migrate on load. Each game module owns a `migrate*` function per entity type (`migrateCharacter`, `migrateSteading`, `migrateThreat`), called wherever a blob is read. Any commit that changes a blob's shape bumps that module's `SCHEMA_VERSION` and extends the migration **in the same commit**, with a test that loads a fixture of the old shape. A character saved at v0.1 opens in every later version; anything else is data loss on a timer.
- Keep a `CHANGELOG.md` current (Keep a Changelog format).
- Stack: SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, Drizzle + SQLite (local/staging) / D1 (prod), Auth.js, Zod, Vitest + Playwright. Same as Arrowed's — deliberate, so his code remains a reference and future collaboration stays easy.
- Characters/steadings stored as one JSON blob per row with `schemaVersion`, `gameId`, `entityType` — the one genuinely universal persistence model.
- Three rules, enforced from commit 1: the shell only touches game code through the `GameModule` registry; game modules never import each other; every game-visible string lives in a content pack, never in app code ("game-visible" means game *content* — shell chrome is app copy and exempt).

## Phase 16 — The steading has editors (commit 110)

110. `feat(campaigns): steading editors` — every member already sees the campaign steading; the GM now delegates edit per member (a `steadingEditor` flag on `campaign_members`, toggles on the campaign dashboard next to each player). Enforced server-side on the steading write path — the UI grant is honest — and the shared tracker becomes live, not read-only, for delegates.

## Phase 17 — The session ledger (commits 111–112)

*End of session already runs GM-side and marks everyone's XP; what it doesn't do is remember. Notes live in the GM's browser and the awards evaporate into the sheets.*

111. `feat(db): campaign sessions` — a sessions table (campaignId, number, date, the checked triggers, per-character XP awarded, notes); the end-of-session flow writes one record per run, and the notes textarea seeds once from the old localStorage key so nothing already jotted is lost.
112. `feat(campaigns): session log` — the campaign dashboard grows the history: session N, date, XP handed out, notes, editable by the GM after the fact. The e2e end-of-session test asserts the record too.

## Phase 18 — Moves & gear, handed out (commit 113)

113. `feat(stonetop): moves & gear page` — the app's equivalent of the Moves & Gear handout, for players at the table without a character open: the basic moves, the special moves (extend `tools/build_moves.ts` to emit `special-moves.json` — Advantage/Disadvantage, Burn Brightly, End of Session, Death's Door), and the gear/small-items/prosperity lists already in the inventory insert. Linked from the game landing and the play view.

## Phase 19 — Sanded corners, watched and backed up (commits 114–118)

*Added 2026-07-12 after a "what else would you change" review. Offline/PWA and the account-export half of the data-safety story stay deferred to open v2.3 — but the operator half moved the other way (decided 2026-07-12): monitoring and the D1 backup land here, because the site is already public and the database already holds characters people would miss.*

114. `feat(play): undo` — every play-mode edit autosaves, so every mistap persists. The engine is pure functions over blobs, which makes undo nearly free: PlayMode keeps a short stack of prior blobs and a toast after each change offers Undo for a few seconds — HP, XP, trackers, inventory, even a fat-fingered level-up, all restored by writing the previous blob back. *Fold in a nit from the 2026-07-16 e2e triage while in this file: the play page's autosave-adopt-id `replaceState` passes `{}` for state and rebuilds the query as bare `?id=`, dropping both `page.state.tab` and `?tab=` — so an unsaved-draft session snaps back to the Sheet tab on its first autosave. Carry the existing query params and `page.state` through instead.*
115. `feat(stonetop): moves link to their rules` — every move card on the play sheet deep-links to the move's full rules text. Possible because the reimport made each move its own section (commit 89's `kind: "move"`); `tools/build_moves.ts` records the section id alongside each extracted move so the link is data, not string-matching.
116. `feat(shell): feedback link + cookieless analytics` — a footer feedback link (GitHub issues), and the Cloudflare Web Analytics beacon: free, cookieless, no consent banner, nothing stored about the visitor. `/privacy` updates in the same commit, as its own text demands. If event-level questions arise later ("does anyone use the PDF export?"), self-hosted Umami on atlas is the upgrade path that keeps the no-third-party-tracking claim true.
117. `chore(ops): production on the watchdog` — **Argus** (the house watchdog) already runs Uptime Kuma watching the staging deployment on atlas; this commit is just the missing checks: production's `https://splatbook.app/api/health`, and a confirmation that notifications actually arrive. A dedicated watchdog box watching Cloudflare is exactly the right shape — the watcher shares no failure domain with either deployment. The runbook in `docs/deployment.md` gains the what-to-do-when-it-pages section.
118. `chore(ops): nightly D1 export to atlas` — a cron on atlas runs `wrangler d1 export --remote` (API token scoped to D1 read) against **production** into a dated, compressed dump under a directory the existing 3-2-1 backup already sweeps — from there the offsite copies come for free. Simple retention before the sweep (say 14 daily, 12 monthly); a **restore rehearsal** documented in the runbook (import the dump into local sqlite, open a character — an untested backup is a hope, not a backup); and a push-style check on Argus's Kuma (the cron pings it on success) that alerts when a night is missed, because silent cron death is the actual failure mode of home-grown backups.

## Phase 20 — A real PDF (commits 119–122)

*The commit-83 "export" is a print stylesheet — honest, but the browser owns the layout and the file. guild-book's bar is a generated document. `pdf-lib` (+ fontkit for the book fonts) runs on node and Workers alike — no headless browser, so it survives every deploy target.*

119. `feat(shell): pdf engine` — a generic module: font embedding, text flow with measurement, boxes/checkbox/rule primitives, page management; a server endpoint pattern games hang layouts on. Unit tests on the layout math (wrapping, pagination), not pixels.
120. `feat(stonetop): character sheet PDF, 1-up` — the printed-playbook layout, chosen options only, from the same character blob the sheet renders; Download button on sheet and play views (print stays as the quick path).
121. `feat(shell): booklet imposition` — a shared imposition helper (rendered page → position on sheet), then the saddle-stitch booklet variant: A5 pages paired onto landscape A4 in fold order, matching the physical playbooks. 3-up (three panels on a landscape sheet, table-flat) is a deliberate follow-up — the helper makes it a small commit when wanted.
122. `docs + chore: v2.2.0` — content-packs.md (typed insert schemas, `rollsDamage`, special-moves data, the prefs table, callout + chapter conventions), architecture.md (preferences, sessions, the pdf module boundary, the ops additions folded into deployment.md), changelog, tag. **Also the housekeeping rule above: phases 16–20 move to the history file here.**

**Milestone: the binder release — every insert playable, Book II open to the curious, dice for everything the game rolls, a session that remembers itself, and a PDF worth printing. `v2.2.0`.**

*Toward v2.3: offline/PWA first (precache the static reference + a web manifest, then a write queue for sheets), and the user-facing half of the data-safety story (a "download my data" JSON export on the dashboard — the operator half, the scheduled D1 export, was pulled forward into phase 19). Both were reviewed 2026-07-12 and deferred, not rejected. Also parked from the Hearthfire review: lines-and-veils safety tools (excluded / veiled / special handling) and shared "Threats" / "I wonder…" boards on the campaign dashboard — cheap, very Stonetop, and worth doing once the session ledger exists to hold them.*

## Sequencing notes

- Natural session-sized bites: a phase-boundary milestone every 5–10 commits, and each commit is small enough to finish in one sitting.
- When the itch for game #2 arrives (HMtW is the obvious candidate — Arrowed's pack data may even be importable), the test of the framework is that it touches only `content-packs/hmtw/` and `src/lib/games/hmtw/`. If it needs shell changes, that's the extraction moment — do it then, with two real games in hand, not now with one.
