# Splatbook — session orientation

Game-agnostic TTRPG companion framework. First game module: **Ringwall** (Stonetop).
Domain: splatbook.app (owned). License: GPL-3.0-or-later (app), CC BY-SA 4.0 (Stonetop text).

## Start here

1. `docs/App Implementation Plan.md` — the commit-by-commit plan. Find the next unbuilt
   commit; that's the work. Announce which commit(s) this session targets.
2. `docs/App Plan.md` — background: reuse analysis, hosting strategy.
3. `git log --oneline` — what's actually done (trust this over memory or chat history).

## Hard rules (from the plan — do not drift)

- Three layers, strictly: content packs (`content/`, later `static/content-packs/`) →
  engine (pure TS, no UI/DB imports) → app. No game rules or game strings in app code.
- Shell touches game code only via the GameModule registry; game modules never import
  each other. No universal character model — abstract only when a second game forces it.
- Every commit builds, type-checks, and passes tests. Conventional commit messages.
- Keep `CHANGELOG.md` and the content-pack docs current as part of any commit that
  touches the boundary.

## Content pipeline

- `content/stonetop/rules/` is **generated** — never hand-edit. Source of truth is the
  Obsidian vault at `~/Documents/RPG Vaults/Stonetop` (connect it only when regenerating).
- Regenerate: `python3 tools/build_rules.py --vault <vault> --out content/stonetop/rules`
  (strips art/PDF embeds, remaps `^pNNN` page anchors to section links, verifies links).
- `content/stonetop/data/` — structured game data; schema documented in `SCHEMA.md` there.

## Environment quirks

- The sandbox mount can't unlink files: before any git write, move stale locks aside
  (`for f in .git/*.lock; do mv "$f" ".git/stale_lk_$(date +%s%N)"; done`) and ignore
  "unable to unlink" warnings. Tell Chris to occasionally `rm .git/stale_lk_*` natively.
- **Linux sandbox (cowork) — shadow `node_modules` before any npm/build/test command.**
  The project folder is a macOS share: its `node_modules` holds mac-arm64 native
  binaries (better-sqlite3, rolldown, tailwind oxide) that cannot load on Linux, and
  the no-unlink mount means you can never `rm -rf node_modules` or `npm ci` over it
  in place. At session start, if `uname` is `Linux`:
  1. Probe: `node -e "require('better-sqlite3')"` — if it loads, the shadow is
     already up; skip the rest.
  2. Shadow the mount point: `sudo mount -t tmpfs -o size=2g tmpfs "$PWD/node_modules"`
     (try without `sudo` if it's missing). This overlays a Linux-local tmpfs on top
     of the directory; the mac copy underneath is untouched.
  3. `npm ci` to fill it. For e2e also `npx playwright install --with-deps chromium`.
  4. The shadow evaporates with the sandbox — redo this each session.
  If the mount is denied (no root in this sandbox), do NOT try to reinstall in
  place; say so, skip local test runs, and rely on CI (push → GitHub Actions runs
  the full suite on Linux) as the verification path.
- Stack (fixed): SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, Drizzle +
  SQLite/D1, Auth.js, Zod, Vitest + Playwright. Reference implementations: Arrowed's
  guild-book and MiskatonicUniversityRegistrar on GitHub.
