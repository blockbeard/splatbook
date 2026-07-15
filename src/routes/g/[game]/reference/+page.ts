import type { PageLoad } from './$types';

/**
 * This leaf's own `+page.server.ts` always redirects (see `legacyRedirect`),
 * so its inferred return type is `never` — left alone, that poisons `PageData`
 * for the whole page (every property access becomes a type error), since
 * SvelteKit derives `PageData` from `+page.ts` when present but otherwise
 * falls back to `+page.server.ts`. A `+page.ts` that simply forwards the
 * layout's own load data (gameId/gameName/toc/gmContentVisible — everything
 * this page's template reads) rescues the type without refetching anything.
 * Mirrors the sibling `[section]/+page.ts`, which already does this by
 * necessity (it needs `parent()` for `gmContentVisible` anyway).
 */
export const load: PageLoad = async ({ parent }) => parent();
