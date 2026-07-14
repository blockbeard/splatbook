# Splatbook

A game-agnostic framework for TTRPG companion apps: character builders, campaign
and steading trackers, GM references, searchable rules, and shared dice — driven
entirely by per-game content packs. The first game module is a companion for
[Stonetop](https://www.lampblack-and-brimstone.com/) by Jeremy Strandberg /
Lampblack & Brimstone, served at `/stonetop`.

> "Splat" is the old typesetter's slang for the asterisk in "the \* book."
> The framework is named after a wildcard, which is the point.

## Status

**v2.0.0** — see [CHANGELOG.md](CHANGELOG.md). What works today:

- **Reference** — the full rules text, searchable, with resolving cross-links;
  GM-only content (Book II) is gated to campaign GMs.
- **Characters** — a step-by-step builder for every playbook, and a play-mode
  sheet: moves, vitals, inventory/Outfit with load tracking, print view.
- **Steading** — the Stonetop tracker: improvements, fortunes, lists, residents
  and neighbors, GM-editable when campaign-owned.
- **GM tools** — agenda/principles/procedures reference, rollable tables (Die of
  Fate, weather), flow diagrams, threat worksheets saved as entities.
- **Campaigns** — create, invite by tokenised link, join as player; party
  dashboard; characters attach to at most one campaign.
- **Dice** — a generic engine with per-game presets, move-aware rolling from the
  sheet, and a per-campaign roll log the whole table watches (polling).

Remaining plan lives in `docs/App Implementation Plan.md`.

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

Deployment (Docker/adapter-node now, Cloudflare Pages + D1 later) is documented
in [docs/deployment.md](docs/deployment.md).

## Layout

- `src/lib/` — the shell: game-agnostic engine and app code
- `src/lib/games/<gameId>/` — game modules, registered via the `GameModule`
  registry; the shell touches game code only through it
- `static/content-packs/<gameId>/` — content packs: JSON data + markdown rules,
  no code, each with its own license (see [docs/content-packs.md](docs/content-packs.md))
- `content/stonetop/` — pack authoring sources
- `docs/` — architecture, pack format, `adding-a-game.md` walkthrough, deployment,
  and the implementation plan
- `tools/` — content pipeline and validation scripts

Three layers, strictly: content packs → engine (pure TS) → app. No game rules or
game strings in app code. To add a game, see
[docs/adding-a-game.md](docs/adding-a-game.md).

## Content pipeline

The Stonetop rules text is maintained in an Obsidian vault (the source of truth)
and converted here by:

```
python3 tools/build_rules.py --vault /path/to/StonetopVault --out content/stonetop/rules
```

The conversion strips art and PDF embeds (not covered by the text license), remaps
print page-number anchors to section links, and verifies that every cross-reference
resolves. The search index is rebuilt with `npm run build:search`.

## Licensing

- Application source: [GPL-3.0-or-later](LICENSE).
- Stonetop text (`content/stonetop/`, `static/content-packs/stonetop/`):
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  © Jeremy Strandberg / Lampblack & Brimstone. Splatbook is an independent
  production and is not affiliated with Lampblack & Brimstone. No Stonetop
  artwork is reproduced.

Architecture inspired by Arrowed's [guild-book](https://github.com/arrowedisgaming/guild-book)
and [Miskatonic University Registrar](https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar).
