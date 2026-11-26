import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { clearPackSchemas, validatePack } from '../packs/harness';
import { clearGames, getGame, listGames, registerGame } from './registry';
import type { GameModule } from './types';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'packs', 'fixtures');

const module = (id: string, name: string): GameModule => ({
	id,
	name,
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

	it('accepts a reference-only module with no entityTypes at all', () => {
		// Phase 22: a rules-reference game (HMtW) contributes no builders,
		// sheets, or trackers — entityTypes is optional, not just empty.
		const { entityTypes: _dropped, ...bare } = module('ref-only', 'Reference Only');
		registerGame(bare);
		expect(getGame('ref-only')?.name).toBe('Reference Only');
		expect(getGame('ref-only')?.entityTypes).toBeUndefined();
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

	it('leaves the pack schemas to the tooling', async () => {
		// Registering a game wires nothing into the harness: `schemas.ts` does that,
		// for `validate:packs` and the tests (phase 33).
		registerGame(module('test-pack', 'Test Pack'));
		const result = await validatePack(join(fixtures, 'test-pack'));
		expect(result.errors.join(' ')).toMatch(/no schemas registered/);
	});
});

describe('what the app loads', () => {
	/**
	 * Phase 33: building every pack schema cost a cold Worker about 20 ms of its
	 * 10 ms budget, on every route, for schemas only the tooling reads. Only
	 * `schemas.ts` may import them as values; everyone else takes types, which
	 * the build erases.
	 */
	it('imports pack schemas as values only from schemas.ts', () => {
		const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
		const files = (readdirSync(root, { recursive: true }) as string[])
			.filter((f) => /\.(ts|svelte)$/.test(f) && !/\.test\.ts$/.test(f))
			.map((f) => join(root, f));
		const valueImport = /^\s*import\s+(?!type\b)[^;]*?from\s+['"][^'"]*pack-schemas['"]/m;
		const offenders = files
			.filter((f) => valueImport.test(readFileSync(f, 'utf8')))
			.map((f) => relative(root, f));
		expect(offenders).toEqual([join('lib', 'games', 'schemas.ts')]);
	});
});
