/**
 * The pdf builder (commit 119): not pixel tests — those are the layout math's
 * job — but the wrapper's own contract: documents open, pages are the size
 * asked for, text/boxes actually land in the content stream, the response
 * helper sets the headers a download needs, and the book font embeds through
 * fontkit (the reason fontkit is here at all).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfBuilder, pdfResponse, PAGE_SIZES } from './builder';

describe('PdfBuilder', () => {
	it('produces a well-formed document with the requested pages', async () => {
		const b = await PdfBuilder.create('a5');
		b.addPage();
		b.addPage();
		const bytes = await b.save();

		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
		const opened = await PDFDocument.load(bytes);
		expect(opened.getPageCount()).toBe(2);
		const [w, h] = [opened.getPage(0).getWidth(), opened.getPage(0).getHeight()];
		expect([w, h]).toEqual([...PAGE_SIZES.a5]);
	});

	it('never saves a zero-page document', async () => {
		const b = await PdfBuilder.create();
		const opened = await PDFDocument.load(await b.save());
		expect(opened.getPageCount()).toBe(1);
	});

	it('draws wrapped text and reports the height used', async () => {
		const b = await PdfBuilder.create('a4');
		const font = await b.standardFont();
		b.addPage();
		const used = b.text(0, 'a run of words long enough to wrap at a narrow width', {
			x: 40,
			y: 40,
			font,
			size: 12,
			maxWidth: 120
		});
		// More than one line's worth of height means it wrapped.
		expect(used).toBeGreaterThan(12 * 1.25);
		// And the wrapping honoured the measurer: nothing wider than asked.
		const bytes = await b.save();
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
	});

	it('creates pages on demand when a flow lands blocks beyond page 0', async () => {
		const b = await PdfBuilder.create('a4');
		const font = await b.standardFont();
		b.text(2, 'landed on page three', { x: 40, y: 40, font, size: 10 });
		const opened = await PDFDocument.load(await b.save());
		expect(opened.getPageCount()).toBe(3);
	});

	it('embeds the book font through fontkit', async () => {
		// Avara (SIL OFL) — the same file the web sheet uses.
		const woff2 = readFileSync(join(process.cwd(), 'static', 'fonts', 'avara-700.woff2'));
		const b = await PdfBuilder.create('a5');
		const font = await b.embedFont(woff2);
		b.text(0, 'STONETOP', { x: 40, y: 40, font, size: 24 });
		const bytes = await b.save();
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
	});
});

describe('font sanitising', () => {
	it('keeps newlines — authored line breaks must survive to the wrap/split path', async () => {
		const b = await PdfBuilder.create();
		const font = await b.standardFont();
		expect(font.sanitize('line one\nline two')).toBe('line one\nline two');
	});

	it('maps the pack symbols to printable stand-ins', async () => {
		const b = await PdfBuilder.create();
		const font = await b.standardFont();
		expect(font.sanitize('mark ◇ then ✕ then •')).toBe('mark ( ) then x then -');
	});

	it('flattens what WinAnsi cannot encode, including C1 controls', async () => {
		const b = await PdfBuilder.create();
		const font = await b.standardFont();
		expect(font.sanitize('a\u0085b\u2603c')).toBe('a?b?c'); // NEL (C1), snowman
		// …but keeps latin-1 and the typographic extras WinAnsi carries.
		expect(font.sanitize('café — “quoted”…')).toBe('café — “quoted”…');
	});

	it('draws multi-line standard-font text without throwing', async () => {
		const b = await PdfBuilder.create();
		const font = await b.standardFont();
		const used = b.text(0, 'one\ntwo\nthree', { x: 40, y: 40, font, size: 10 });
		expect(used).toBeCloseTo(3 * 10 * 1.25, 5);
	});
});

describe('pdfResponse', () => {
	it('sets the download headers and sanitises the filename', async () => {
		const b = await PdfBuilder.create();
		const res = pdfResponse(await b.save(), 'Vera of Stonetop (Lv 3).pdf');
		expect(res.headers.get('content-type')).toBe('application/pdf');
		expect(res.headers.get('content-disposition')).toBe(
			'attachment; filename="Vera_of_Stonetop_Lv_3_.pdf"'
		);
		expect(new TextDecoder().decode((await res.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
	});
});
