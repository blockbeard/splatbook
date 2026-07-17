/**
 * The special-moves pack file, round-tripped (commit 113): the shipped JSON
 * parses against the schema the app reads it with, and it carries exactly the
 * four moves the Moves & Gear handout prints. `tools/build_moves.ts` lifts the
 * run from the playing-the-game chapter and Death's Door from the Player Moves
 * chapter (callout only), so these tests are what keep a regeneration honest.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { specialMovesSchema } from '../pack-schemas';

const raw: unknown = JSON.parse(
	readFileSync(
		join(process.cwd(), 'static', 'content-packs', 'stonetop', 'data', 'special-moves.json'),
		'utf8'
	)
);

describe('special-moves.json', () => {
	it('parses against the schema the app loads it with', () => {
		expect(() => specialMovesSchema.parse(raw)).not.toThrow();
	});

	const pack = specialMovesSchema.parse(raw);

	it('carries the handout’s four special moves, in print order', () => {
		expect(pack.moves.map((m) => m.id)).toEqual([
			'advantage-disadvantage',
			'burn-brightly',
			'end-of-session',
			'death-s-door'
		]);
	});

	it('keeps Death’s Door to the move itself — no reference-chapter trailer', () => {
		const dd = pack.moves.find((m) => m.id === 'death-s-door')!;
		expect(dd.text).toMatch(/Last Door and the Lady of Crows/);
		// The Player Moves chapter follows the callout with "This move is
		// discussed in detail on …" — commentary for the reference, not a card.
		expect(dd.text).not.toMatch(/discussed in detail/i);
		// And no unconverted vault wikilinks ride along.
		expect(dd.text).not.toMatch(/\[\[/);
	});
});
