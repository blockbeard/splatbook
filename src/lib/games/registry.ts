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

/** Register a game module. Ids must be unique; re-registration is a bug, not an update. */
export function registerGame(module: GameModule): void {
	if (games.has(module.id)) {
		throw new Error(`game "${module.id}" is already registered`);
	}
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
