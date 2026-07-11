/**
 * Central game-module registration.
 *
 * Importing this module (for its side effects) registers every built-in game
 * for the app shell. Build tooling (`validate:packs`) imports the UI-free
 * `./schemas.ts` instead — tsx cannot load the .svelte components bundled
 * here — so keep the two registration lists in sync when adding a game.
 */

import { registerGame } from './registry';
import { stonetop } from './stonetop';
import type { GameModule } from './types';

/** The built-in games, in registration order. Ids must be unique across this
 * list — asserted in `index.test.ts`, since the registry itself now replaces
 * rather than rejects a repeat id (see `registerGame`). */
export const BUILT_IN_GAMES: readonly GameModule[] = [stonetop];

for (const game of BUILT_IN_GAMES) registerGame(game);

export { getGame, listGames, registerGame } from './registry';
export type { GameModule } from './types';
