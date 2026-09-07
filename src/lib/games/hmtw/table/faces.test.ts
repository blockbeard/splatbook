import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPackFile } from '../../../packs/fs-loader';
import { buildFaces, type FaceIndex } from './faces';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

let faces: FaceIndex;
beforeAll(async () => {
	faces = buildFaces((await loadPackFile(packRoot, 'data/deck.json')) as never);
});

describe('card faces', () => {
	it('covers every card in both decks', () => {
		expect(Object.keys(faces)).toHaveLength(78);
	});

	it('prints a minor the way the book does', () => {
		expect(faces['swords-ace']).toMatchObject({ name: 'Ace of Swords', rank: 'Ace', value: 1 });
		expect(faces['cups-x']).toMatchObject({ name: 'X of Cups', rank: 'X', value: 10 });
		expect(faces['wands-king']).toMatchObject({ rank: 'King', value: 14 });
	});

	it('knows a major by its numeral, which is what the count calls', () => {
		expect(faces['justice']).toMatchObject({ name: 'Justice', rank: 'XI', value: 11 });
		expect(faces['fool']).toMatchObject({ name: 'The Fool', rank: '0', value: 0 });
	});

	it('marks the greater dooms, and only those', () => {
		// 15 to 21, per ch.7 — the band the GM's mulligan judgement reads off.
		expect(faces['devil'].greaterDoom).toBe(true);
		expect(faces['world'].greaterDoom).toBe(true);
		expect(faces['temperance'].greaterDoom).toBe(false);
		expect(faces['swords-king'].greaterDoom).toBe(false);
	});

	it('gives a minor its suit glyph and a major none', () => {
		expect(faces['cups-v'].glyph).toBe('/content-packs/hmtw/art/suit-cups.svg');
		expect(faces['star'].glyph).toBeUndefined();
	});

	it('carries the suit itself, not only a path to a picture of it', () => {
		// The rules question — which actions a card pays for — reads this. It used
		// to read the glyph's filename, so renaming an asset would have silently
		// stopped every Swords card paying for an Attack.
		expect(faces['cups-v'].suit).toBe('cups');
		expect(faces['swords-king'].suit).toBe('swords');
		expect(faces['star'].suit).toBeUndefined();
	});
});
