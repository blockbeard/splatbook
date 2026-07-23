/**
 * The character-sheet PDF (commit 120), built from the same blob the sheet
 * renders, against the real shipped pack — a fake fetch serves `static/` from
 * disk, standing in for the event fetch that serves it in deployment. Not
 * pixel tests (the engine's layout math has its own); this asserts the
 * document exists, opens, and carries the filename the character's name earns.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { characterPdf } from './character';
import { SCHEMA_VERSION, type StonetopCharacter } from '../engine';

/** Serve /content-packs/* and /fonts/* from static/, like any deployment. */
const fakeFetch = (async (input: string) => {
	const path = String(input).replace(/^[a-z]+:\/\/[^/]+/, '');
	const file = join(process.cwd(), 'static', path.replace(/^\//, ''));
	try {
		const bytes = readFileSync(file);
		return new Response(new Uint8Array(bytes), { status: 200 });
	} catch {
		return new Response('not found', { status: 404 });
	}
}) as typeof fetch;

function fixture(overrides: Partial<StonetopCharacter> = {}): StonetopCharacter {
	return {
		schemaVersion: SCHEMA_VERSION,
		name: 'Ryn',
		playbookId: 'the-blessed',
		level: 2,
		xp: 3,
		hp: { current: 16, max: 18 },
		backgroundId: '',
		instinctId: '',
		stats: {
			STR: { value: 0 },
			DEX: { value: 2 },
			CON: { value: 1 },
			INT: { value: -1 },
			WIS: { value: 1 },
			CHA: { value: 0 }
		},
		// Miserable marks CON and CHA with the ✕ on the stat row.
		debilities: { weakened: false, dazed: false, miserable: true },
		moves: [],
		possessions: [],
		possessionChoices: {},
		trackers: {},
		appearance: ['wild hair', 'crow feathers'],
		origin: {},
		advancement: [],
		inventory: {
			gear: ['Supplies', 'Bedroll'],
			smallItems: ['Chalk'],
			undefinedGear: 0,
			undefinedSmall: 0
		},
		introductions: {},
		...overrides
	} as StonetopCharacter;
}

describe('characterPdf', () => {
	it('builds a document that opens, from the shipped pack', async () => {
		const { bytes, filename } = await characterPdf(fixture(), fakeFetch);
		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
		expect(filename).toBe('ryn.pdf');
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		expect(doc.getTitle()).toBe('Ryn — Stonetop');
	});

	it('falls back to a sensible filename for the unnamed', async () => {
		const { filename } = await characterPdf(fixture({ name: '' }), fakeFetch);
		expect(filename).toBe('stonetop-character.pdf');
	});

	it('refuses a character whose playbook pack is missing', async () => {
		await expect(
			characterPdf(fixture({ playbookId: 'the-nobody' } as Partial<StonetopCharacter>), fakeFetch)
		).rejects.toThrow(/no playbook pack/);
	});

	it('spreads a long introduction across as many pages as it needs, instead of drawing it off the page', async () => {
		// A body paragraph taller than what's left of the page used to draw
		// straight past the bottom margin with nothing to stop it — invisible
		// (and, past a point, dropped from the content stream outright) rather
		// than continuing onto a fresh page. A short-introduction character is
		// one page; a much longer one, all else equal, must be several.
		const short = await characterPdf(fixture({ introductions: { 0: 'A short one.' } }), fakeFetch);
		const longIntro = Array.from(
			{ length: 250 },
			(_, i) => `Sentence number ${i + 1} of a long introduction.`
		).join(' ');
		const long = await characterPdf(fixture({ introductions: { 0: longIntro } }), fakeFetch);

		const shortPages = (await PDFDocument.load(short.bytes)).getPageCount();
		const longPages = (await PDFDocument.load(long.bytes)).getPageCount();
		expect(longPages).toBeGreaterThan(shortPages);
		expect(longPages).toBeGreaterThan(3);
	});
});
