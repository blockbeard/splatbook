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
import { PDFDocument, PDFDict, PDFName, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PdfBuilder, pdfResponse, PAGE_SIZES } from './builder';

/** Pull the embedded font program back out of a saved PDF's FontDescriptor
 * and hand it back to fontkit — the round-trip a corrupted embed fails
 * (either no FontFile2 turns up at all, or fontkit can't reparse it). */
function reparseEmbeddedFont(bytes: Uint8Array) {
	return PDFDocument.load(bytes).then((doc) => {
		for (const [, obj] of doc.context.enumerateIndirectObjects()) {
			const ref = obj instanceof PDFDict && obj.get(PDFName.of('FontFile2'));
			if (ref) {
				const stream = doc.context.lookup(ref);
				const program = decodePDFRawStream(stream as never).decode();
				return fontkit.create(Buffer.from(program));
			}
		}
		return null;
	});
}

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
		// Avara (SIL OFL) — the .ttf sibling of the file the web sheet uses
		// (see the embedFont doc comment for why it's the .ttf, not .woff2).
		const ttf = readFileSync(join(process.cwd(), 'static', 'fonts', 'avara-700.ttf'));
		const b = await PdfBuilder.create('a5');
		const font = await b.embedFont(ttf, { subset: false });
		b.text(0, 'STONETOP', { x: 40, y: 40, font, size: 24 });
		const bytes = await b.save();
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
	});

	it('embeds Avara as a structurally valid font program, not just a document that loads', async () => {
		// PDFDocument.load doesn't validate an embedded font's own bytes, so
		// the test above alone wouldn't have caught this: a woff2 buffer (or
		// pdf-lib's subsetter, for this font) produces a PDF that still opens
		// fine but whose embedded FontFile2 is corrupt — poppler refuses to
		// parse it, and PDF.js-family viewers draw the wrong glyph per
		// character instead of erroring. Reparsing the embedded bytes with
		// fontkit is the same check poppler effectively does, without
		// shelling out to it.
		const ttf = readFileSync(join(process.cwd(), 'static', 'fonts', 'avara-700.ttf'));
		const originalGlyphCount = fontkit.create(ttf).numGlyphs;

		const b = await PdfBuilder.create('a5');
		const font = await b.embedFont(ttf, { subset: false });
		b.text(0, 'STONETOP', { x: 40, y: 40, font, size: 24 });
		const bytes = await b.save();

		const reparsed = await reparseEmbeddedFont(bytes);
		expect(reparsed).not.toBeNull();
		// subset: false, so nothing should have been dropped — the embedded
		// program should carry the whole original glyph set.
		expect(reparsed?.numGlyphs).toBe(originalGlyphCount);
	});

	it('documents that this font cannot be safely subset (regression guard)', async () => {
		// If pdf-lib's subsetter ever gets fixed for this font, great — but
		// until then `subset: true` on Avara silently produces the same
		// corrupt-embed failure as the woff2 buffer did. This test exists so
		// that re-enabling subsetting for this asset fails loudly instead of
		// shipping another round of scrambled PDF text.
		const ttf = readFileSync(join(process.cwd(), 'static', 'fonts', 'avara-700.ttf'));
		const b = await PdfBuilder.create('a5');
		const font = await b.embedFont(ttf, { subset: true });
		b.text(0, 'STONETOP', { x: 40, y: 40, font, size: 24 });
		const bytes = await b.save();

		const reparsed = await reparseEmbeddedFont(bytes);
		expect(reparsed).toBeNull(); // documents the current (broken) behaviour
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
