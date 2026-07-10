# Stonetop Companion App — Implementation Plan

*Drafted 2026-07-10. Target: character builder, steading builder, GM reference, rules search; campaigns and shared dice later.*

> [!note] Superseded
> The commit-by-commit plan now lives in [[App Implementation Plan]] (fresh repo, game-agnostic framework with Stonetop as the first module — not a guild-book fork). The hosting section below still applies.

## Reuse decision: fork guild-book

Fork Arrowed's **guild-book**, not start from scratch, and not the Registrar (guild-book is the newer distillation of the same codebase and already has the two hardest pieces: a content-pack-driven creation wizard and a rules reference with search).

What comes for free: SvelteKit 2 / Svelte 5 / TypeScript / Tailwind v4 scaffold, content-pack architecture (game data as JSON in `static/content-packs/`, zero rules in code), Zod pack validation, wizard framework, rules reference UI, Auth.js sign-in (Google/Discord + zero-click dev login), Drizzle ORM with local SQLite and Cloudflare D1 for production, saved-character dashboard, PDF/Markdown export (in the Registrar; port as needed), Docker + Cloudflare deployment configs, Vitest/Playwright test rigs.

What's genuinely new work: the Stonetop content pack (already 80% done — the vault `data/` JSONs), leveling-up, the steading builder, the GM reference, and later campaigns/dice.

Licensing is clean: guild-book is GPL-3.0-or-later (your fork stays GPL), Stonetop text is CC BY-SA 4.0 (rules text in the app must carry attribution and stay share-alike — one credits/license page covers it).

## Architecture (inherited, keep it)

Three strictly separated layers:

1. **Content pack** — `static/content-packs/stonetop/`: playbooks, inserts, steading, and the SRD section tree as JSON. Sourced from the vault's `Book I Stonetop/Playbooks/data/` plus a build script that converts the vault markdown into sections.
2. **Engine** — pure functions: character validation (requires.level, maxTakes, replaces, tracker state), level-up legality, steading improvement requirements, dice. Unit-tested, no UI or DB imports.
3. **App** — routes, wizard UI, persistence. Characters and steadings stored as one JSON blob per row with a `schemaVersion` field.

## Chunks

Each chunk ends with something usable. Order matters for 0–3; after that 4–7 can be shuffled.

### Chunk 0 — Fork and scaffold (small)
Fork guild-book → `stonetop-companion` (pick a name). Strip the HMtW placeholder pack, run locally with dev login, confirm build, CI, and Docker still work. Rename branding. Deliverable: empty app running on your Mac and on atlas via Docker.

### Chunk 1 — Stonetop content pack (medium)
Convert the 19 vault JSONs into the app's pack format with Zod schemas: 9 character playbooks, 9 inserts, the steading. Write the **SRD build script**: parse the vault's Book I (and Book II) markdown into a section tree — id, heading path, body markdown, print-page anchor — so the same source feeds both the reference browser and search. Keep the script in the repo; regenerating after vault errata is one command. Deliverable: validated pack, `npm run build:srd`.

### Chunk 2 — Character builder MVP (large)
The wizard: playbook pick → background (with nested choices) → instinct → appearance/origin/name → stat assignment → starting moves (fixed + granted + choose-N, enforcing requirements) → special possessions → playbook extras (sacred pouch, destiny, crew…) → introductions. Then a **character sheet view**: only what was chosen, print-friendly CSS, matching the playbook's structure. localStorage autosave between steps (inherited). No accounts yet. Deliverable: build any of the 9 playbooks end-to-end and print the sheet.

### Chunk 3 — Accounts and persistence (small–medium)
Turn on Auth.js, wire the characters table (JSON blob + schemaVersion), dashboard with open/duplicate/archive. Mostly inherited; the work is adapting the schema to Stonetop characters. Deliverable: sign in, save, reopen.

### Chunk 4 — Play mode and leveling (medium)
In-play trackers: HP, XP, debilities, move trackers (Resolve, Omens, Boon…), inventory marks. **Level-up flow**: spend XP, pick a new move with gates enforced (level 2+/6+, prerequisite moves, maxTakes, "replaces X" retiring the old move, Would-be Hero's asterisk rule), stat improvements. Record a small advancement log so a sheet shows how it got where it is. Deliverable: a character survives a campaign arc in the app.

### Chunk 5 — Steading builder (medium)
From `the-steading.json`: stats with season tracking (Fortunes, Surplus, Population, Prosperity, Defenses), debilities, resources/fortifications lists with write-ins, **improvements** as requirement checklists (all/either/pick-N/multi-box "Pull Together ×4") that apply their effects when complete, assets, residents and neighbors tables with the name/trait pickers. Saved like characters. Deliverable: track Stonetop across seasons.

### Chunk 6 — Rules reference and search (medium)
The HMtW-style tool, rebuilt on the SRD tree from chunk 1: search box → ranked snippet results → each expands in place (snippet → subsection → full section) rather than dumping an SRD. Client-side index (MiniSearch/FlexSearch — no server cost, works offline). Browsable table of contents as the fallback. Book I only in the public index; Book II behind a feature flag for later GM gating. When we build this, connect the HMtW vault folder to this session so I can lift what made that version work well. Deliverable: search "Defy Danger" and expand to the full move.

### Chunk 7 — GM reference (small–medium)
The GM playbook as structured pages: agenda, principles, GM moves, session/seasons-change checklists, the prep tables. Data-driven like everything else (transcribe `The GM.md` → pack JSON — same job as the playbooks, I can do this in the vault first). Deliverable: usable at the table instead of the PDF.

### Chunk 8 — Public deployment v1 (small)
Ship chunks 0–7. Credits/licensing page (CC BY-SA attribution for Stonetop text, GPL source link, "not affiliated with Lampblack & Brimstone" disclaimer — check their fan policy before going public). Deliverable: a URL you can hand your table.

### Chunk 9 — Campaigns (v2, medium–large)
Campaign entity: a GM creates one, invites players via tokenised link, characters and the steading attach to it. GM role unlocks Book II in search. Campaign dashboard showing the party and steading at a glance.

### Chunk 10 — Shared dice (v2, medium)
Per-campaign roll log: 2d6+stat, advantage/disadvantage, move-aware labels. Realtime by polling first (simple, works everywhere), upgrade to SSE/Durable Objects if it feels laggy. Stonetop's dice are simple enough that this is mostly UI.

## Hosting

Your instinct about the domestic connection is half right — the real issues with serving from home are exposure and uptime more than bandwidth (this is a text-and-JSON app; realistic traffic is trivial). Options:

1. **Cloudflare Pages + D1** *(recommended for public v1)* — guild-book is already wired for it (`wrangler.toml`, adapter-cloudflare, D1 support in Drizzle). Free tier easily covers a hobby TTRPG site, nothing runs on your network, custom domain and TLS included. The constraint: it's Cloudflare's serverless runtime, so long-lived websockets need Durable Objects (paid, ~$5/mo) — fine, since dice can start with polling.
2. **Atlas + Cloudflare Tunnel** — Docker on atlas, exposed via `cloudflared` so no ports open and your home IP stays hidden; Cloudflare caches the static assets. Perfectly good for a private table-only deployment, and it's your dev/staging box either way. Downside: your uptime is your uptime.
3. **Small VPS** (Hetzner/Fly, ~€4/mo) — the middle path if you outgrow the CF free tier or want plain Node + SQLite with no serverless quirks.

Suggested path: develop locally with SQLite → run on atlas via Docker for your own table (tunnel if remote players need it) → Cloudflare Pages + D1 when you make it public. The codebase supports all three from the same repo via the `ADAPTER` env var, so nothing is locked in.

## Prep work I can do in the vault before you start coding

1. Transcribe `The GM.md` to structured JSON (same treatment as the playbooks) — feeds chunk 7.
2. Prototype the SRD build script against the vault markdown — feeds chunks 1 and 6.
3. Normalise the existing 19 JSONs against whatever Zod schema the fork lands on, once chunk 0 exists.
