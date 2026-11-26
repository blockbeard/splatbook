import { BUILT_IN_GAME_IDS } from '$lib/games/ids';
import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Matches a registered game id only — `stonetop`, and whatever else joins
 * `BUILT_IN_GAMES` (`$lib/games`) and `BUILT_IN_GAME_IDS`. Games now live at the app's root
 * (`/[game=game]`, commit 95, replacing `/g/[game]`), so this is what keeps a
 * static route (`/campaigns`, `/dashboard`, `/privacy`, …) from ever being
 * shadowed: SvelteKit already gives static path segments priority over
 * dynamic ones, but a matcher makes the contract explicit rather than
 * incidental, and turns an unknown "game" segment into a clean 404 instead of
 * a route that renders and then fails deeper in its own `load`.
 *
 * Reads a plain list of ids rather than the registry: SvelteKit loads matchers
 * on an isolate's first request, and importing the registry here made every
 * route pay for every game module (phase 33).
 */
export const match: ParamMatcher = (param) => BUILT_IN_GAME_IDS.includes(param);
