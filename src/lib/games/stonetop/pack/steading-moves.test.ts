/**
 * The steading-moves pack file, round-tripped: the shipped JSON parses against
 * the schema the app reads it with, it carries only moves the *steading* rolls,
 * and each one names the steading stat the rules print. `tools/build_moves.ts`
 * lifts this file out of the rules prose, so these tests are what keep a
 * regeneration honest.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { steadingMovesSchema } from '../pack-schemas';
import { steadingRollStat } from '../engine/steading';

const raw: unknown = JSON.parse(
	readFileSync(
		join(process.cwd(), 'static', 'content-packs', 'stonetop', 'data', 'steading-moves.json'),
		'utf8'
	)
);

describe('steading-moves.json', () => {
	it('parses against the schema the app loads it with', () => {
		expect(() => steadingMovesSchema.parse(raw)).not.toThrow();
	});

	const pack = steadingMovesSchema.parse(raw);
	const by = (id: string) => pack.moves.find((m) => m.id === id)!;

	it('carries the change of seasons, which is the roll the table makes together', () => {
		expect(steadingRollStat(by('seasons-change'))).toBe('fortunes');
	});

	it('names the steading stat each move rolls', () => {
		expect(steadingRollStat(by('deploy'))).toBe('defenses');
		expect(steadingRollStat(by('muster'))).toBe('population');
	});

	// The homefront moves in the book include things a *character* does at home.
	// A steading does not Convalesce, and it does not Level Up.
	it('excludes homefront moves that roll nothing of the steading’s', () => {
		const ids = pack.moves.map((m) => m.id);
		expect(ids).not.toContain('convalesce');
		expect(ids).not.toContain('level-up');
		expect(ids).not.toContain('make-a-plan');
	});

	it('rolls a steading stat for every move it carries — no character stats', () => {
		for (const move of pack.moves) {
			expect(steadingRollStat(move), move.id).not.toBeNull();
			expect(move.text).not.toMatch(/rolls?\s*\+(STR|DEX|CON|INT|WIS|CHA)\b/);
		}
	});
});

describe('steadingRollStat', () => {
	// Seasons Change hands out Population as an outcome ("Increase Population by
	// 1") but rolls +Fortunes. Reading the roll, not the mentions, is the point.
	it('reads what a move rolls, not every stat it mentions', () => {
		expect(steadingRollStat({ text: 'rolls +Fortunes: on a 10+, increase Population by 1' })).toBe(
			'fortunes'
		);
		expect(steadingRollStat({ text: 'reduce Fortunes by 1 (min -1)' })).toBeNull();
	});
});
