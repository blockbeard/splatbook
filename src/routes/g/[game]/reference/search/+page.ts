import type { PageLoad } from './$types';

/**
 * Same fix as the sibling `reference/+page.ts`: this leaf's `+page.server.ts`
 * always redirects (`never` return type), which poisons `PageData` unless a
 * `+page.ts` exists to supply it instead. Forward the layout's load data
 * (gameId/gameName/gmContentVisible — everything this page's template reads).
 */
export const load: PageLoad = async ({ parent }) => parent();
