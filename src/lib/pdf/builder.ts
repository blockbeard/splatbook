/**
 * PDF builder (commit 119) — the generic document engine games hang layouts
 * on. pdf-lib (+ fontkit for custom fonts) runs on node and Workers alike: no
 * headless browser, so it survives every deploy target this project has.
 *
 * Scope, on purpose: font embedding, wrapped text with measurement, the
 * box/checkbox/rule primitives a form-shaped character sheet needs, and page
 * management in top-down coordinates (PDF's native origin is bottom-left;
 * every human layout sketch is top-down, so the builder converts at the last
 * moment and nothing else ever thinks about it). The layout *math* lives in
 * `./layout` as pure functions with their own tests; this file is the thin
 * imperative shell around pdf-lib.
 *
 * Shell code: game-agnostic. A game module builds its sheet from these
 * primitives in its own server route (commit 120 is the first).
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { wrapText, textHeight, type MeasureFn } from './layout';

/** Page sizes in PDF points (1/72"), portrait. */
export const PAGE_SIZES = {
	a4: [595.28, 841.89],
	a5: [419.53, 595.28],
	letter: [612, 792]
} as const;

export interface TextOptions {
	x: number;
	/** Top edge of the text block, measured from the page's top. */
	y: number;
	font: EmbeddedFont;
	size: number;
	maxWidth?: number;
	lineHeight?: number;
	color?: { r: number; g: number; b: number };
}

/** An embedded font plus the measurer the layout math needs. */
export interface EmbeddedFont {
	font: PDFFont;
	measure: MeasureFn;
	/** Cap height baseline fudge: distance from a line's top to its baseline. */
	ascent: (size: number) => number;
}

const BLACK = { r: 0, g: 0, b: 0 };

export class PdfBuilder {
	private constructor(
		private doc: PDFDocument,
		private pageSize: readonly [number, number]
	) {}

	private pages: PDFPage[] = [];

	static async create(size: keyof typeof PAGE_SIZES | readonly [number, number] = 'a4') {
		const doc = await PDFDocument.create();
		// fontkit unlocks non-standard fonts (the book fonts); harmless otherwise.
		doc.registerFontkit(fontkit);
		const dims = typeof size === 'string' ? PAGE_SIZES[size] : size;
		return new PdfBuilder(doc, dims);
	}

	/** One of the 14 built-in fonts — no bytes to embed, smallest output. */
	async standardFont(name: StandardFonts = StandardFonts.Helvetica): Promise<EmbeddedFont> {
		return this.wrap(await this.doc.embedFont(name));
	}

	/** Embed font bytes (TTF/OTF — the book fonts). Subset: only the glyphs
	 * actually used ship in the file. */
	async embedFont(bytes: Uint8Array | ArrayBuffer): Promise<EmbeddedFont> {
		return this.wrap(await this.doc.embedFont(bytes, { subset: true }));
	}

	private wrap(font: PDFFont): EmbeddedFont {
		return {
			font,
			measure: (text, size) => font.widthOfTextAtSize(text, size),
			ascent: (size) => font.heightAtSize(size, { descender: false })
		};
	}

	get pageCount(): number {
		return this.pages.length;
	}

	get pageWidth(): number {
		return this.pageSize[0];
	}

	get pageHeight(): number {
		return this.pageSize[1];
	}

	/** Append a page and make it current. Returns its 0-based index. */
	addPage(): number {
		this.pages.push(this.doc.addPage([this.pageSize[0], this.pageSize[1]]));
		return this.pages.length - 1;
	}

	/** The page at `index`, creating pages up to it if needed — so a caller
	 * placing flowed blocks (`layout.flowBlocks`) never manages pages itself. */
	private page(index: number): PDFPage {
		while (this.pages.length <= index) this.addPage();
		return this.pages[index];
	}

	/** Top-down y → PDF-space y, on this builder's page size. */
	private fromTop(y: number): number {
		return this.pageSize[1] - y;
	}

	/**
	 * Draw wrapped text; returns the height used so callers can stack blocks.
	 * `y` is the block's *top* edge from the page top (drawText wants a
	 * baseline in bottom-left space — that conversion is exactly what this
	 * method exists to hide).
	 */
	text(pageIndex: number, content: string, opts: TextOptions): number {
		const page = this.page(pageIndex);
		const lineHeight = opts.lineHeight ?? 1.25;
		const color = opts.color ?? BLACK;
		const lines = opts.maxWidth
			? wrapText(content, opts.maxWidth, opts.size, opts.font.measure)
			: content.split('\n');

		const step = opts.size * lineHeight;
		lines.forEach((line, i) => {
			const baseline = this.fromTop(opts.y + i * step + opts.font.ascent(opts.size));
			page.drawText(line, {
				x: opts.x,
				y: baseline,
				size: opts.size,
				font: opts.font.font,
				color: rgb(color.r, color.g, color.b)
			});
		});
		return textHeight(lines.length, opts.size, lineHeight);
	}

	/** A rectangle; `y` is the top edge from the page top. */
	box(
		pageIndex: number,
		x: number,
		y: number,
		width: number,
		height: number,
		opts: { borderWidth?: number; fill?: boolean } = {}
	): void {
		this.page(pageIndex).drawRectangle({
			x,
			y: this.fromTop(y + height),
			width,
			height,
			borderColor: rgb(0, 0, 0),
			borderWidth: opts.borderWidth ?? 0.75,
			...(opts.fill ? { color: rgb(0.92, 0.92, 0.92) } : {})
		});
	}

	/** A checkbox: a small square, optionally with its mark. */
	checkbox(pageIndex: number, x: number, y: number, size: number, checked: boolean): void {
		this.box(pageIndex, x, y, size, size);
		if (checked) {
			const page = this.page(pageIndex);
			const pad = size * 0.22;
			// An X, not a glyph — no font dependency for a mark.
			page.drawLine({
				start: { x: x + pad, y: this.fromTop(y + pad) },
				end: { x: x + size - pad, y: this.fromTop(y + size - pad) },
				thickness: 1
			});
			page.drawLine({
				start: { x: x + size - pad, y: this.fromTop(y + pad) },
				end: { x: x + pad, y: this.fromTop(y + size - pad) },
				thickness: 1
			});
		}
	}

	/** A horizontal rule; `y` from the page top. */
	rule(pageIndex: number, x: number, y: number, width: number, thickness = 0.75): void {
		this.page(pageIndex).drawLine({
			start: { x, y: this.fromTop(y) },
			end: { x: x + width, y: this.fromTop(y) },
			thickness
		});
	}

	/** Document metadata — the file says what it is. */
	meta(info: { title?: string; author?: string }): void {
		if (info.title) this.doc.setTitle(info.title);
		if (info.author) this.doc.setAuthor(info.author);
		this.doc.setProducer('Splatbook');
	}

	/** Finish: a document always has at least one page. */
	async save(): Promise<Uint8Array> {
		if (this.pages.length === 0) this.addPage();
		return this.doc.save();
	}
}

/** The server-endpoint pattern (commit 119): a game's PDF route builds a
 * document and returns it through this — correct headers, a filename the
 * browser keeps. */
export function pdfResponse(bytes: Uint8Array, filename: string): Response {
	return new Response(bytes.slice().buffer as ArrayBuffer, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${filename.replace(/[^\w.-]+/g, '_')}"`
		}
	});
}
