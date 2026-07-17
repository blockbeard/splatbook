/**
 * The pdf engine (commit 119) — a generic document module games hang layouts
 * on: `PdfBuilder` (fonts, wrapped text, boxes/checkboxes/rules, top-down page
 * management), the pure layout math (`wrapText`, `flowBlocks`), and the
 * server-endpoint helper (`pdfResponse`). Shell code, game-agnostic; the first
 * consumer is Stonetop's character-sheet PDF (commit 120).
 */

export { PdfBuilder, pdfResponse, PAGE_SIZES } from './builder';
export { StandardFonts } from 'pdf-lib';
export type { EmbeddedFont, TextOptions } from './builder';
export { wrapText, textHeight, flowBlocks, pageCount } from './layout';
export type { MeasureFn, FlowPosition, FlowOptions } from './layout';
