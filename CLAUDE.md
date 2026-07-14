# Splatbook — session orientation

Game-agnostic TTRPG companion framework. First game module: **Stonetop**, served at `/stonetop`.
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
- **`svelte-kit sync`/`vite build`/`vitest` fail with `EPERM: unlink` on
  `.svelte-kit/types/route_meta_data.json` or `node_modules/.vite/…`** even
  after the `node_modules` shadow above — these are two more directories the
  no-unlink mount can't clear on its own, unrelated to native binaries.
  Route around it with an unprivileged mount namespace (no `sudo` needed —
  `unshare --mount --map-root-user` works inside this sandbox even when the
  real `sudo mount` above is denied), shadowing just those two directories
  with tmpfs for the one command:
  ```
  unshare --mount --map-root-user bash -c '
    mount -t tmpfs -o size=200m tmpfs .svelte-kit
    mkdir -p node_modules/.vite && mount -t tmpfs -o size=1g tmpfs node_modules/.vite
    npx svelte-kit sync && npx tsc --noEmit -p . && npx vitest run
  '
  ```
  The mount only exists inside that subprocess's namespace and is gone when
  it exits — redo it per command, same as the `node_modules` shadow. This
  gets a real `vitest`/`tsc`/`vite build` running in this sandbox (confirmed
  commit 95); `better-sqlite3`'s mac-arm64 binary still fails to load
  (`invalid ELF header`) inside it, since that's the native-binary problem
  the `node_modules` shadow (npm reinstall) fixes, not this one — the two
  workarounds solve different problems and are both needed together. `vite
  build`'s very last step (adapter-node clearing `build/` before writing)
  can still trip the same unlink limit on a stray file already inside
  `build/`; shadow `build/` too if that specific step matters.
- Stack (fixed): SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, Drizzle +
  SQLite/D1, Auth.js, Zod, Vitest + Playwright. Reference implementations: Arrowed's
  guild-book and MiskatonicUniversityRegistrar on GitHub.
