/**
 * Game-module registry.
 *
 * Modules register once at startup (via `./index.ts` side-effect imports);
 * the shell looks games up by id and never reaches past the `GameModule`
 * interface. Registering a game also wires its pack schemas into the
 * validation harness.
 */

import { registerPackSchemas } from '../packs/harness';
import type { GameModule } from './types';

const games = new Map<string, GameModule>();

/**
 * Register a game module, replacing any earlier registration of the same id —
 * the same no-op-replacement contract `registerPackSchemas` already has.
 *
 * Replacement rather than a duplicate-id throw because the dev server
 * re-evaluates SSR modules (a game importing its own theme CSS is enough to
 * trigger it) and re-runs registration with a freshly constructed module
 * object; throwing there would 500 every request after the first. Two
 * *different* games claiming one id is still a bug — `BUILT_IN_GAMES` is
 * asserted unique in `index.test.ts`, which is where such a collision could
 * actually originate.
 */
export function registerGame(module: GameModule): void {
	games.set(module.id, module);
	registerPackSchemas(module.id, module.packSchemas);
}

/** Look a game up by id (the `/g/[game]` URL segment). */
export function getGame(id: string): GameModule | undefined {
	return games.get(id);
}

/** All registered games, sorted by display name. */
export function listGames(): GameModule[] {
	return [...games.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Test helper — forget all registrations. */
export function clearGames(): void {
	games.clear();
}
