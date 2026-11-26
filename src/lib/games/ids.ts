/**
 * The built-in games' ids, and nothing else.
 *
 * For the `[game=game]` param matcher, which SvelteKit loads on the first
 * request an isolate serves, whatever the route. Asking the registry instead
 * (`listGames()`) imported every game module, zod and all, so a fresh Worker
 * paid for all of it inside its first request, `/api/health` included
 * (phase 33). `index.test.ts` keeps this list equal to `BUILT_IN_GAMES`.
 */
export const BUILT_IN_GAME_IDS: readonly string[] = ['stonetop', 'hmtw'];
