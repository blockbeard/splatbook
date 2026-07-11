/**
 * The basic-moves pack file, round-tripped: the shipped JSON parses against the
 * schema the app reads it with, and the moves the sheet offers roll the stats
 * the rules actually print. `tools/build_basic_moves.ts` lifts this file out of
 * the rules prose, so these tests are what keep a regeneration honest.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { basicMovesSchema } from '../pack-schemas';
import { movesRollStats } from '../engine';

const raw: unknown = JSON.parse(
	readFileSync(
		join(process.cwd(), 'static', 'content-packs', 'stonetop', 'data', 'basic-moves.json'),
		'utf8'
	)
);

describe('basic-moves.json', () => {
	it('parses against the schema the app loads it with', () => {
		expect(() => basicMovesSchema.parse(raw)).not.toThrow();
	});

	const pack = basicMovesSchema.parse(raw);
	const by = (id: string) => pack.moves.find((m) => m.id === id)!;

	it('carries the basic moves, with unique ids', () => {
		const ids = pack.moves.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain('clash');
		expect(ids).toContain('defy-danger');
		expect(ids).toContain('seek-insight');
	});

	it('names the stat each move rolls, read from its own text', () => {
		expect(movesRollStats(by('clash'))).toEqual(['STR']); // "roll +STR"
		expect(movesRollStats(by('let-fly'))).toEqual(['DEX']);
		expect(movesRollStats(by('defend'))).toEqual(['CON']);
		expect(movesRollStats(by('know-things'))).toEqual(['INT']);
		expect(movesRollStats(by('seek-insight'))).toEqual(['WIS']);
	});

	it('offers every stat for Defy Danger, in the order the book lists them', () => {
		expect(movesRollStats(by('defy-danger'))).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
	});

	it('leaves a move with no roll in its text unrollable', () => {
		// Aid has the GM pick; there's nothing to roll.
		expect(movesRollStats(by('aid'))).toEqual([]);
	});
});
