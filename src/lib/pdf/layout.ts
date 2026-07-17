/**
 * PDF layout math (commit 119) — the half of the pdf engine that is pure
 * functions: wrapping text into lines against a measurer, and flowing block
 * heights onto pages. Deliberately free of pdf-lib so the unit tests exercise
 * the arithmetic (wrapping, pagination) without touching font files or PDF
 * bytes — the builder in `./builder` supplies a real measurer from an embedded
 * font, but these functions only ever see `(text, size) => width`.
 */

/** Measures a string's rendered width at a font size, in points. */
export type MeasureFn = (text: string, size: number) => number;

/**
 * Greedy word-wrap: pack words onto a line while they fit, break, repeat. A
 * single word wider than `maxWidth` is hard-broken by characters rather than
 * overflowing the box — an unbreakable overlong token is content's problem,
 * but clipping it silently would be the layout's.
 */
export function wrapText(
	text: string,
	maxWidth: number,
	size: number,
	measure: MeasureFn
): string[] {
	const lines: string[] = [];

	// Respect authored line breaks; wrap each paragraph line independently.
	for (const paragraph of text.split('\n')) {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			lines.push('');
			continue;
		}

		let line = '';
		for (const word of words) {
			const candidate = line ? `${line} ${word}` : word;
			if (measure(candidate, size) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			// The word alone may still overflow — hard-break it.
			if (measure(word, size) <= maxWidth) {
				line = word;
			} else {
				let chunk = '';
				for (const ch of word) {
					if (measure(chunk + ch, size) <= maxWidth || chunk === '') chunk += ch;
					else {
						lines.push(chunk);
						chunk = ch;
					}
				}
				line = chunk;
			}
		}
		lines.push(line);
	}
	return lines;
}

/** The height a wrapped run of text will occupy. */
export function textHeight(lineCount: number, size: number, lineHeight = 1.25): number {
	return lineCount * size * lineHeight;
}

/** Where one block landed: which page (0-based), and the y of its *top* edge
 * measured from the page's top margin line (PDF-space conversion is the
 * builder's job — layout stays top-down, the way humans reason about pages). */
export interface FlowPosition {
	page: number;
	top: number;
}

export interface FlowOptions {
	/** Usable height of a page (page height minus both margins). */
	pageHeight: number;
	/** Vertical gap between consecutive blocks. */
	gap?: number;
}

/**
 * Flow a sequence of block heights onto pages, top-down: each block lands on
 * the current page if it fits below the previous one, else at the top of the
 * next. A block taller than the page still gets a page of its own (and will
 * clip) — the caller chose the heights; pagination's job is placement, not
 * censorship. Returns one position per block, in order.
 */
export function flowBlocks(heights: number[], opts: FlowOptions): FlowPosition[] {
	const gap = opts.gap ?? 0;
	const positions: FlowPosition[] = [];
	let page = 0;
	let cursor = 0; // distance from the top margin line

	for (const height of heights) {
		const y = cursor === 0 ? 0 : cursor + gap;
		if (y + height > opts.pageHeight && y !== 0) {
			page += 1;
			cursor = height;
			positions.push({ page, top: 0 });
		} else {
			positions.push({ page, top: y });
			cursor = y + height;
		}
	}
	return positions;
}

/** How many pages a flow occupies (0 blocks still means 1 page — a PDF with
 * no pages is not a document any viewer will open). */
export function pageCount(positions: FlowPosition[]): number {
	return positions.length === 0 ? 1 : positions[positions.length - 1].page + 1;
}
