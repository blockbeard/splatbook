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
- **Linux sandbox (cowork) — native binaries in `node_modules` are mac-arm64,
  not Linux.** The project folder is a macOS share; things like `esbuild`,
  `@tailwindcss/oxide`, and `better-sqlite3` ship a `Mach-O` binary that
  can't `dlopen` on Linux (`invalid ELF header`), and the no-unlink mount
  means `rm -rf node_modules && npm ci` can't fix it in place. Two things
  that do work, both confirmed working end-to-end (commit 96):
  - **Pure-JS-resolvable native deps** (esbuild, used by `tsx`): install a
    Linux build alongside the mac one with `npm install --no-save
    --ignore-scripts @esbuild/linux-arm64` (arch per `uname -m` — check
    `node -p process.arch`) — npm can ADD a new package under
    `node_modules/@esbuild/…` even though it can't unlink the old one, and
    esbuild's own resolver picks the platform-matching optional dependency
    at runtime.
  - **A binary loaded from a fixed path** (better-sqlite3, which
    `bindings.js` always resolves to `node_modules/better-sqlite3/build/
    Release/better_sqlite3.node` — a second copy elsewhere doesn't help):
    build a real Linux binary *outside* the mount, where unlink works fine
    (`$HOME` is a normal filesystem — `cd ~ && touch f && rm f` succeeds,
    unlike inside the project folder), then bind-mount it over the broken
    one for the one command that needs it:
    ```
    mkdir -p ~/bsq-build && cd ~/bsq-build
    npm pack better-sqlite3@<version matching package.json> --silent
    tar xzf better-sqlite3-*.tgz && cd package
    npm install --ignore-scripts   # pulls node-gyp etc., skips the prebuilt-binary postinstall
    npm run build-release          # compiles from source; needs gcc/g++/make/python3 (present)
    ```
    Then, inside the same `unshare --mount` session as the actual command
    (see the `.svelte-kit`/`node_modules/.vite` shadow below — this is a
    third bind alongside those two tmpfs mounts):
    ```
    mount --bind ~/bsq-build/package/build node_modules/better-sqlite3/build
    ```
    This took the full `vitest` suite from 46 failing (every `db/*.test.ts`
    file) to 431/431 passing. The compiled binary survives across bash calls
    (it lives in `$HOME`, a real filesystem) — only the bind-mount itself
    needs redoing each `unshare` session, so build it once per session, bind
    it every time.
  If none of this is available (no `unshare`, no build toolchain), say so,
  skip the affected local runs, and rely on CI (push → GitHub Actions runs
  the full suite on real Linux) as the verification path.
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
    mount --bind ~/bsq-build/package/build node_modules/better-sqlite3/build
    npx svelte-kit sync && npx tsc --noEmit -p . && npx vitest run
  '
  ```
  The mount only exists inside that subprocess's namespace and is gone when
  it exits — redo it per command. This gets a real `vitest`/`tsc`/`vite
  build` running in this sandbox with the *entire* suite passing (confirmed
  commit 96, 431/431) — the third line is the better-sqlite3 bind from
  above; drop it if that build hasn't been done yet this session, and the
  db/*.test.ts files fail on the native-binary problem instead. `vite
  build`'s very last step (adapter-node clearing `build/` before writing)
  can still trip the same unlink limit on a stray file already inside
  `build/`; shadow `build/` too if that specific step matters.
- Stack (fixed): SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, Drizzle +
  SQLite/D1, Auth.js, Zod, Vitest + Playwright. Reference implementations: Arrowed's
  guild-book and MiskatonicUniversityRegistrar on GitHub.
