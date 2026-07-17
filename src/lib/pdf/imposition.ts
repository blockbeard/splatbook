/**
 * Booklet imposition (commit 121) — rendered page → position on sheet.
 *
 * The pure half is `saddleStitchOrder`: which source pages land on which face
 * of which sheet, in fold order. Print the output duplex (flip on short
 * edge), fold the stack in half, staple the spine — page 1 is the cover and
 * the count reads straight through, matching the physical playbooks.
 *
 * The imposing half is `imposeSaddleStitch`: takes any finished PDF (the 1-up
 * A5 character sheet is the first customer), pairs its pages two-up onto
 * landscape sheets twice the page width. Generic on purpose — the helper
 * neither knows nor cares what a "character" is, so 3-up (three panels on a
 * landscape sheet, table-flat) is a small follow-up, not a rewrite.
 */

import { PDFDocument } from 'pdf-lib';

/** One printed face: the source page for its left and right half. `null` is a
 * deliberate blank (padding to the next multiple of four). Pages are 0-based. */
export interface BookletFace {
	left: number | null;
	right: number | null;
}

/** Round up to the multiple of four a folded booklet needs. */
export function padToSignature(pageCount: number): number {
	return Math.max(4, Math.ceil(pageCount / 4) * 4);
}

/**
 * Fold order for a saddle-stitch booklet of `pageCount` pages (0-based source
 * indices; indices at/after `pageCount` come back as `null` blanks). Faces
 * alternate front, back, front, back — duplex, flip on short edge.
 *
 * With pages 1..n (n a multiple of 4): sheet k's front is [n−2k+2, 2k−1], its
 * back [2k, n−2k+1] — the classic printer's imposition, here 0-based.
 */
export function saddleStitchOrder(pageCount: number): BookletFace[] {
	const n = padToSignature(pageCount);
	const page = (oneBased: number): number | null => (oneBased <= pageCount ? oneBased - 1 : null);

	const faces: BookletFace[] = [];
	for (let k = 1; k <= n / 4; k++) {
		faces.push({ left: page(n - 2 * k + 2), right: page(2 * k - 1) }); // front
		faces.push({ left: page(2 * k), right: page(n - 2 * k + 1) }); // back
	}
	return faces;
}

/**
 * Impose a finished PDF as a saddle-stitch booklet: every pair of source
 * pages lands two-up on a sheet twice the first page's width (A5 portrait in
 * → A4 landscape out). Returns a new document's bytes; the source is not
 * modified.
 */
export async function imposeSaddleStitch(sourceBytes: Uint8Array): Promise<Uint8Array> {
	const source = await PDFDocument.load(sourceBytes);
	const out = await PDFDocument.create();

	const first = source.getPage(0);
	const w = first.getWidth();
	const h = first.getHeight();

	const faces = saddleStitchOrder(source.getPageCount());
	// Embed each source page once, even when it appears on no face (blanks).
	const embedded = await out.embedPdf(source, source.getPageIndices());

	for (const face of faces) {
		const sheet = out.addPage([w * 2, h]);
		if (face.left !== null) sheet.drawPage(embedded[face.left], { x: 0, y: 0 });
		if (face.right !== null) sheet.drawPage(embedded[face.right], { x: w, y: 0 });
	}

	out.setProducer('Splatbook');
	const title = source.getTitle();
	if (title) out.setTitle(`${title} (booklet)`);
	return out.save();
}
