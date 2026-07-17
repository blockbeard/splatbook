/**
 * The pdf engine's layout math (commit 119) — the tests are on the arithmetic
 * (wrapping, pagination), not pixels: a fixed-width fake measurer makes every
 * expectation exact.
 */

import { describe, expect, it } from 'vitest';
import { wrapText, textHeight, flowBlocks, pageCount } from './layout';

/** Every character 5pt wide at size 10, scaling linearly with size. */
const mono = (text: string, size: number) => text.length * (size / 2);

describe('wrapText', () => {
	it('packs words greedily and breaks where the width runs out', () => {
		// 20 chars fit at size 10 (width 100).
		expect(wrapText('one two three four five', 100, 10, mono)).toEqual([
			'one two three four', // 18 chars — "five" would make 23
			'five'
		]);
	});

	it('keeps text that fits on a single line', () => {
		expect(wrapText('short', 100, 10, mono)).toEqual(['short']);
	});

	it('respects authored line breaks and preserves blank lines', () => {
		expect(wrapText('a\n\nb', 100, 10, mono)).toEqual(['a', '', 'b']);
	});

	it('hard-breaks a single word wider than the box instead of overflowing', () => {
		// 10 chars per line at width 50.
		expect(wrapText('abcdefghijklmnop', 50, 10, mono)).toEqual(['abcdefghij', 'klmnop']);
	});

	it('scales with font size', () => {
		// Same text, double size → twice as wide → wraps sooner (10 chars/line).
		expect(wrapText('one two three four', 100, 20, mono)).toEqual(['one two', 'three four']);
	});

	it('collapses runs of whitespace like a typesetter, not a diff tool', () => {
		expect(wrapText('a   b', 100, 10, mono)).toEqual(['a b']);
	});
});

describe('textHeight', () => {
	it('is lines × size × lineHeight', () => {
		expect(textHeight(3, 10, 1.25)).toBe(37.5);
		expect(textHeight(1, 12)).toBe(15);
	});
});

describe('flowBlocks', () => {
	it('stacks blocks down one page while they fit', () => {
		expect(flowBlocks([100, 100, 100], { pageHeight: 400, gap: 10 })).toEqual([
			{ page: 0, top: 0 },
			{ page: 0, top: 110 },
			{ page: 0, top: 220 }
		]);
	});

	it('starts a new page when the next block would overflow', () => {
		const positions = flowBlocks([300, 300], { pageHeight: 400, gap: 10 });
		expect(positions).toEqual([
			{ page: 0, top: 0 },
			{ page: 1, top: 0 }
		]);
	});

	it('fills exactly to the edge without a phantom page', () => {
		// 190 + 10 + 200 = 400 — a perfect fit stays on one page.
		expect(flowBlocks([190, 200], { pageHeight: 400, gap: 10 })).toEqual([
			{ page: 0, top: 0 },
			{ page: 0, top: 200 }
		]);
	});

	it('gives an over-tall block a page of its own rather than losing it', () => {
		const positions = flowBlocks([100, 900, 100], { pageHeight: 400, gap: 10 });
		expect(positions.map((p) => p.page)).toEqual([0, 1, 2]);
	});
});

describe('pageCount', () => {
	it('counts the pages a flow used', () => {
		expect(pageCount(flowBlocks([300, 300, 300], { pageHeight: 400 }))).toBe(3);
	});

	it('is 1 for an empty flow — a PDF always has a page', () => {
		expect(pageCount([])).toBe(1);
	});
});
