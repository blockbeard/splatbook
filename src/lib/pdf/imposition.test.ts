/**
 * Booklet imposition (commit 121). The fold order is arithmetic, so the tests
 * are exact: fold a mental 8-page zine and follow along. The imposing half is
 * checked end to end — page counts, sheet dimensions, blanks.
 */

import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { padToSignature, saddleStitchOrder, imposeSaddleStitch } from './imposition';
import { PdfBuilder } from './builder';

describe('padToSignature', () => {
	it('rounds up to the next multiple of four, minimum one sheet', () => {
		expect(padToSignature(1)).toBe(4);
		expect(padToSignature(4)).toBe(4);
		expect(padToSignature(5)).toBe(8);
		expect(padToSignature(8)).toBe(8);
		expect(padToSignature(9)).toBe(12);
	});
});

describe('saddleStitchOrder', () => {
	it('folds four pages onto one sheet', () => {
		// Front: [4, 1] — the cover reads first when folded. Back: [2, 3].
		expect(saddleStitchOrder(4)).toEqual([
			{ left: 3, right: 0 },
			{ left: 1, right: 2 }
		]);
	});

	it('folds eight pages onto two sheets in printer order', () => {
		expect(saddleStitchOrder(8)).toEqual([
			{ left: 7, right: 0 },
			{ left: 1, right: 6 },
			{ left: 5, right: 2 },
			{ left: 3, right: 4 }
		]);
	});

	it('pads a five-page document with blanks that fall at the end', () => {
		const faces = saddleStitchOrder(5);
		// 5 pages → an 8-page signature; pages 6-8 (indices 5-7) are blanks.
		expect(faces).toEqual([
			{ left: null, right: 0 },
			{ left: 1, right: null },
			{ left: null, right: 2 },
			{ left: 3, right: 4 }
		]);
	});

	it('every source page appears exactly once', () => {
		for (const n of [4, 5, 8, 12, 13]) {
			const seen = saddleStitchOrder(n)
				.flatMap((f) => [f.left, f.right])
				.filter((p): p is number => p !== null)
				.sort((a, b) => a - b);
			expect(seen).toEqual([...Array(n).keys()]);
		}
	});
});

describe('imposeSaddleStitch', () => {
	async function sourceWithPages(count: number): Promise<Uint8Array> {
		const b = await PdfBuilder.create('a5');
		const font = await b.standardFont();
		for (let i = 0; i < count; i++) {
			b.text(i, `Page ${i + 1}`, { x: 40, y: 40, font, size: 12 });
		}
		b.meta({ title: 'Ryn — Stonetop' });
		return b.save();
	}

	it('pairs A5 pages onto landscape A4 sheets in fold order', async () => {
		const out = await PDFDocument.load(await imposeSaddleStitch(await sourceWithPages(8)));
		expect(out.getPageCount()).toBe(4); // 8 pages → 2 sheets → 4 faces
		const face = out.getPage(0);
		// Twice the A5 width, same height — landscape A4 (within pdf rounding).
		expect(face.getWidth()).toBeCloseTo(419.53 * 2, 1);
		expect(face.getHeight()).toBeCloseTo(595.28, 1);
	});

	it('pads to a whole signature and keeps the title', async () => {
		const out = await PDFDocument.load(await imposeSaddleStitch(await sourceWithPages(5)));
		expect(out.getPageCount()).toBe(4); // 8-page signature → 4 faces
		expect(out.getTitle()).toBe('Ryn — Stonetop (booklet)');
	});
});
