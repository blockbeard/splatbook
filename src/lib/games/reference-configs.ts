/**
 * Per-game reference layout config — the UI-free slice, for build tooling.
 *
 * `tools/build_pages.ts` decides which sections become their own page file
 * from `pageDepth`, and must reach that value without importing a game module
 * (those bundle `.svelte` components; tsx can't load them). Same split as
 * `schemas.ts` vs `index.ts`.
 *
 * When adding a game: add it here if its reference caps page depth, and keep
 * the value in the game's own `reference-config.ts` so `index.ts` and this
 * table can't disagree.
 */

import { referencePageDepth as hmtwPageDepth } from './hmtw/reference-config';

export interface ReferenceLayoutConfig {
	/**
	 * Deepest heading level that gets its own page. Sections deeper than this
	 * render inline on their nearest page ancestor, under an anchor. Absent
	 * means every heading is its own page (Stonetop).
	 */
	pageDepth?: number;
}

export const REFERENCE_LAYOUT: Record<string, ReferenceLayoutConfig> = {
	hmtw: { pageDepth: hmtwPageDepth },
	stonetop: {}
};

/** The nav spine's heading cap. `ReferenceToc` renders chapters with their h2s
 * and h3s and stops there — deeper headings are reached from a section page's
 * own "In this section" tree — so shipping more than h3 in the sidebar
 * artifact would be shipping something nothing renders. */
export const NAV_DEPTH = 3;
