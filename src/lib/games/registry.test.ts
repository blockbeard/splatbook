import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { clearPackSchemas, validatePack } from '../packs/harness';
import { clearGames, getGame, listGames, registerGame } from './registry';
import type { GameModule } from './types';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'packs', 'fixtures');

const module = (id: string, name: string): GameModule => ({
	id,
	name,
	packSchemas: () => z.record(z.string(), z.unknown()),
	entityTypes: {}
});

afterEach(() => {
	clearGames();
	clearPackSchemas();
});

describe('registry', () => {
	it('registers and looks up a game by id', () => {
		registerGame(module('test-pack', 'Test Pack'));
		expect(getGame('test-pack')?.name).toBe('Test Pack');
		expect(getGame('nope')).toBeUndefined();
	});

	it('lists games sorted by display name', () => {
		registerGame(module('zeta', 'Zeta'));
		registerGame(module('alpha', 'Alpha'));
		expect(listGames().map((g) => g.id)).toEqual(['alpha', 'zeta']);
	});

	// The dev server re-evaluates SSR modules and re-runs registration with a
	// fresh module object; that has to be survivable, not fatal.
	it('replaces an earlier registration of the same id', () => {
		registerGame(module('twice', 'Twice'));
		registerGame(module('twice', 'Twice Again'));
		expect(getGame('twice')?.name).toBe('Twice Again');
		expect(listGames()).toHaveLength(1);
	});

	it('wires the game pack schemas into the validation harness', async () => {
		registerGame(module('test-pack', 'Test Pack'));
		const result = await validatePack(join(fixtures, 'test-pack'));
		expect(result.errors).toEqual([]);
	});
});
