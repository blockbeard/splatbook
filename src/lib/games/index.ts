/**
 * Central game-module registration.
 *
 * Importing this module (for its side effects) registers every built-in game.
 * Both the app shell and build tooling (`validate:packs`) import it, so the
 * registry and the validation harness always agree on what games exist.
 */

import { registerGame } from './registry';
import { stonetop } from './stonetop';

registerGame(stonetop);

export { getGame, listGames, registerGame } from './registry';
export type { GameModule } from './types';
