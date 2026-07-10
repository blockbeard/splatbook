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

registerGame(stonetop);

export { getGame, listGames, registerGame } from './registry';
export type { GameModule } from './types';
