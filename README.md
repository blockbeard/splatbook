# Splatbook

A game-agnostic framework for TTRPG companion apps: character builders, campaign
and steading trackers, GM references, searchable rules, and shared dice — driven
entirely by per-game content packs. Two game modules are live: a full companion
for [Stonetop](https://www.lampblackandbrimstone.com/) by Jeremy Strandberg /
Lampblack & Brimstone at `/stonetop`, and a rules reference for
[His Majesty the Worm](https://www.hismajestytheworm.games/) by Josh McCrowell
at `/hmtw`.

> "Splat" is the old typesetter's slang for the asterisk in "the \* book."
> The framework is named after a wildcard, which is the point.

## Status

**v2.3.2 released** — see [CHANGELOG.md](CHANGELOG.md) for the precise state.
What works today:

- **Reference** — the cleaned rules text, chapters as the spine, searchable,
  with resolving cross-links and the book's own theme; Book II (setting
  spoilers) opens per reader via a remembered opt-in.
- **Characters** — a step-by-step builder for every playbook (with a
  choices-so-far rail), and a tabbed play sheet: Sheet · Moves · Inventory
  plus a tab per attached insert — followers, class inserts, the undead
  trio, free-form arcana cards with GM-authored mysteries.
- **Steading** — the Stonetop tracker: improvements, fortunes, lists,
  residents and neighbors, a play sheet with steading rolls, GM-editable when
  campaign-owned.
- **GM tools** — agenda/principles/procedures reference, rollable tables (Die
  of Fate, weather), flow diagrams, threat worksheets saved as entities.
- **Campaigns** — create, invite by tokenised link, join as player; party
  dashboard; per-campaign settings; end-of-session flow that awards XP and
  rolls the steading's season.
- **Dice** — the full polyhedral panel with a one-shot bonus box, move-aware
  and damage rolls from the sheet, "a miss marks XP", and a per-campaign roll
  log the whole table watches (polling).
- **His Majesty the Worm** — the framework promise walked twice: the book's
  full open game text as a reference-only second game, searchable with
  curated pinned index terms, GM chapters behind a per-game spoiler opt-in,
  margin sidebars and the book's own monochrome look, and a chrome-less
  `?embed=1` mode built for reading inside a Zoom Whiteboard.

Production runs at [splatbook.app](https://splatbook.app) (Cloudflare Pages +
D1); staging soaks on atlas. Unbuilt work lives in
`docs/App Implementation Plan.md`; completed phases with their decision
history in `docs/App Implementation History.md`.

## Development

```
npm install
npm run dev            # dev server
npm run check          # svelte-check, TypeScript strict
npm run lint           # prettier + eslint (also enforced by a pre-push hook)
npm test               # vitest unit suite
npm run test:e2e       # Playwright end-to-end suite
npm run validate:packs # content-pack schema validation
npm run build          # production build
```

Deployment (Cloudflare Pages + D1 in production, Docker/adapter-node on
staging) is documented in [docs/deployment.md](docs/deployment.md).

## Layout

- `src/lib/` — the shell: game-agnostic engine and app code
- `src/lib/games/<gameId>/` — game modules, registered via the `GameModule`
  registry; the shell touches game code only through it
- `static/content-packs/<gameId>/` — content packs: JSON data + markdown rules,
  no code, each with its own license (see [docs/content-packs.md](docs/content-packs.md))
- `content/<gameId>/` — pack authoring sources (`rules/` is generated from the
  game's Obsidian vault; everything beside it is hand-authored)
- `docs/` — architecture, pack format, `adding-a-game.md` walkthrough, deployment,
  and the implementation plan
- `tools/` — content pipeline and validation scripts

Three layers, strictly: content packs → engine (pure TS) → app. No game rules or
game strings in app code. To add a game, see
[docs/adding-a-game.md](docs/adding-a-game.md).

## Content pipeline

Each game's rules text is maintained in an Obsidian vault (the source of truth)
and converted here — `content/<gameId>/rules/` is generated output, never edited
by hand:

```
python3 tools/build_rules.py --vault /path/to/StonetopVault --out content/stonetop/rules --config tools/rules.stonetop.json
python3 tools/build_rules.py --vault "/path/to/His Majesty the Worm" --out content/hmtw/rules --config tools/rules.hmtw.json
```

The conversion strips art and PDF embeds (not covered by the text licenses), remaps
print page-number anchors to section links, and verifies that every cross-reference
resolves. Per-corpus behaviour — callout stripping and hoisting, insertions, owned-art
allowlists, heading demotion — is configured per game in `tools/rules.<gameId>.json`;
anything Splatbook adds lives in that config's `insertions` rather than in the vault.

Then, in order: `python3 tools/build_srd.py` projects the notes into the packs'
document trees, `npm run build:search` builds the search and link indexes, and
`npm run build:pages` emits the reference's nav spine and per-page artifacts
(wired into `prebuild`/`predev`, and gitignored — they are derived).

Two pieces of HMtW's pack are deliberately hand-authored, not generated:
`content/hmtw/gm-note/` (the Gamemaster-content opt-in page) and
`content/hmtw/index-terms.json` (the curated pinned index terms, a fork of the
vault's copy so term fixes survive a reimport).

## Licensing

Each content pack is licensed separately from the application, and from each
other.

- Application source: [GPL-3.0-or-later](LICENSE).
- Stonetop text (`content/stonetop/`, `static/content-packs/stonetop/`):
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  © Jeremy Strandberg / Lampblack & Brimstone. Splatbook is an independent
  production and is not affiliated with Lampblack & Brimstone. No Stonetop
  artwork is reproduced.
- His Majesty the Worm text (`content/hmtw/`, `static/content-packs/hmtw/`):
  © 2023 Joshua McCrowell, published by Exalted Funeral Press. Used under the
  book's own reuse grant, which permits free reuse of its mechanics and game
  text and welcomes third-party compatible works — the grant, what the pack
  omits and why, and the required compatibility statement are in
  [the pack's LICENSE.md](static/content-packs/hmtw/LICENSE.md). No art from
  the book is reproduced; all artists retain copyright of their work.

  **Splatbook is an independent production by Chris Wilson and is not
  affiliated with Joshua McCrowell or Exalted Funeral.**

Architecture inspired by Arrowed's [guild-book](https://github.com/arrowedisgaming/guild-book)
and [Miskatonic University Registrar](https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar).
