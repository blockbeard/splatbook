# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- SvelteKit 2 scaffold: Svelte 5 (runes forced), TypeScript strict, Vitest.
- GPL-3.0-or-later license for the application source.
- Tailwind CSS v4 with semantic theme tokens (`--sb-*` custom properties) that game
  modules can override per `data-game` scope; light/dark mode with pre-paint script.
- App shell layout: header, nav placeholder, footer, theme toggle.
- ESLint (flat config, typescript-eslint + eslint-plugin-svelte), Prettier with svelte
  and tailwind plugins, and a GitHub Actions CI running lint/check/test/build.
