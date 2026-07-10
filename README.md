# Splatbook

A game-agnostic framework for TTRPG companion apps: character builders, steading/campaign
trackers, GM references, and searchable rules — driven entirely by per-game content packs.
The first game module is **Ringwall**, a companion for [Stonetop](https://www.lampblack-and-brimstone.com/)
by Jeremy Strandberg / Lampblack & Brimstone.

> "Splat" is the old typesetter's slang for the asterisk in "the \* book."
> The framework is named after a wildcard, which is the point.

## Status

Phase 0 (bootstrap) in progress — see `docs/App Implementation Plan.md` for the
commit-by-commit plan.

## Development

```
npm install
npm run dev      # dev server
npm run check    # svelte-check, TypeScript strict
npm test         # vitest
npm run build    # production build
```

## Layout

- `src/` — the SvelteKit app: shell code in `src/lib/`, game modules (later) in `src/lib/games/`
- `docs/` — implementation plan and design decisions
- `content/stonetop/data/` — structured game data (playbooks, inserts, steading, GM) as JSON
- `content/stonetop/rules/` — rules text (markdown), **generated** from the source vault by
  `tools/build_rules.py`. Never hand-edit; re-run the script instead.
- `tools/` — content pipeline scripts

## Content pipeline

The Stonetop rules text is maintained in an Obsidian vault (the source of truth) and
converted here by:

```
python3 tools/build_rules.py --vault /path/to/StonetopVault --out content/stonetop/rules
```

The conversion strips art and PDF embeds (not covered by the text license), remaps print
page-number anchors to section links, and verifies that every cross-reference resolves.

## Licensing

- Application source: [GPL-3.0-or-later](LICENSE).
- Stonetop text (`content/stonetop/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  © Jeremy Strandberg / Lampblack & Brimstone. Splatbook is an independent production and is
  not affiliated with Lampblack & Brimstone. No Stonetop artwork is reproduced.

Architecture inspired by Arrowed's [guild-book](https://github.com/arrowedisgaming/guild-book)
and [Miskatonic University Registrar](https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar).
