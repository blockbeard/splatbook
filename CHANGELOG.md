# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
