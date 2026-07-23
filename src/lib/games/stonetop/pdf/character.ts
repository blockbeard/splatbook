/**
 * The character sheet as a real PDF (commit 120) — the printed-playbook
 * layout, chosen options only, from the same character blob the sheet
 * renders. Runs server-side in the shell's generic `/[game]/[type]/pdf`
 * endpoint; everything it needs beyond the blob (playbook pack, the book
 * font) arrives through the event's `fetch`, the same way the sheet loads
 * pack data in the browser — so it runs identically on node and Workers.
 *
 * Loaded via dynamic import from the game module's `pdf` slot so pdf-lib
 * never rides into the client bundle.
 */

import { base } from '$app/paths';
import { PdfBuilder, StandardFonts, type Cursor, type EmbeddedFont } from '$lib/pdf';
import type { Move, Playbook } from '../pack-schemas';
import {
	STAT_KEYS,
	heldMoveIds,
	isStatDebilitated,
	isWriteInPossession,
	migrateCharacter,
	type StonetopCharacter
} from '../engine';
import { exportFilename } from '../export';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Pack markdown → printable plain text: emphasis marks off, links to their
 * labels, list dashes kept (they read as bullets on paper too). */
function plain(md: string): string {
	return md
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/_([^_]+)_/g, '$1')
		.replace(/^>\s?/gm, '')
		.trim();
}

const A5 = { w: 419.53, h: 595.28 };
const MARGIN = 34;
const CONTENT_W = A5.w - MARGIN * 2;

export async function characterPdf(
	entity: object,
	fetchFn: Fetcher
): Promise<{ bytes: Uint8Array; filename: string }> {
	const c = migrateCharacter(entity as StonetopCharacter);

	// The playbook brings names and move text; the sheet is unreadable without
	// it, so a missing playbook is a real error, not a degraded render.
	const pbRes = await fetchFn(`${base}/content-packs/stonetop/data/${c.playbookId}.json`);
	if (!pbRes.ok) throw new Error(`stonetop: no playbook pack for "${c.playbookId}"`);
	const playbook = (await pbRes.json()) as Playbook;

	const b = await PdfBuilder.create('a5');
	const body = await b.standardFont();
	const bold = await b.standardFont(StandardFonts.HelveticaBold);
	// The book's own face for the title line — same font family the web sheet
	// uses, but the .ttf sibling, not the .woff2 the browser loads: pdf-lib
	// embeds font bytes as-is rather than unpacking a woff2 container, and
	// (separately) its subsetter corrupts this font, so both `.ttf` and
	// `{ subset: false }` matter here — see the comment on `embedFont`.
	// Fall back to bold if the font can't be fetched (a PDF beats no PDF).
	let display: EmbeddedFont = bold;
	try {
		const fontRes = await fetchFn(`${base}/fonts/avara-700.ttf`);
		if (fontRes.ok) display = await b.embedFont(await fontRes.arrayBuffer(), { subset: false });
	} catch {
		/* keep the fallback */
	}

	// A top-down cursor (page + y). Short, one-shot pieces (headings, the
	// stat row) call `ensure` first so they move to a fresh page whole
	// instead of splitting awkwardly; anything that can run long — any
	// `paragraph` — flows through `PdfBuilder.flowText`, which continues a
	// block onto a fresh page instead of drawing past the bottom margin (see
	// the doc comment on `flowText`: plain `text` has no such limit and will
	// silently draw a tall block off the page).
	const PAGE_BOTTOM = A5.h - MARGIN;
	let cursor: Cursor = { page: b.addPage(), y: MARGIN };

	const ensure = (height: number): void => {
		if (cursor.y + height > PAGE_BOTTOM) {
			cursor = { page: cursor.page + 1, y: MARGIN };
		}
	};

	const flow = (text: string, font: EmbeddedFont, size: number): void => {
		cursor = b.flowText(cursor, text, {
			x: MARGIN,
			font,
			size,
			maxWidth: CONTENT_W,
			pageBottom: PAGE_BOTTOM,
			pageTop: MARGIN
		});
	};

	const heading = (text: string): void => {
		ensure(30);
		cursor.y += 8;
		flow(text, display, 13);
		b.rule(cursor.page, MARGIN, cursor.y + 2, CONTENT_W);
		cursor.y += 8;
	};

	const paragraph = (text: string, opts: { font?: EmbeddedFont; size?: number } = {}): void => {
		const font = opts.font ?? body;
		const size = opts.size ?? 8.5;
		// Measure first so a paragraph that would split awkwardly close to the
		// page edge moves whole when it can; `flow` (flowText) handles the
		// general case of a paragraph too long for one page either way.
		const lines = b.measureLines(text, font, size, CONTENT_W);
		const height = lines * size * 1.25;
		if (height <= A5.h - MARGIN * 2) ensure(height);
		flow(text, font, size);
	};

	// ---- header -----------------------------------------------------------
	const name = c.name?.trim() || 'Unnamed hero';
	flow(name, display, 22);

	const background = playbook.backgrounds.find((bg) => bg.id === c.backgroundId) ?? null;
	const instinct = playbook.instincts.find((i) => i.id === c.instinctId);
	const instinctLabel = instinct?.custom ? (c.instinctWriteIn ?? '') : (instinct?.name ?? '');

	const subtitle = [playbook.name, background?.name, `Level ${c.level}`]
		.filter(Boolean)
		.join(' · ');
	cursor.y += 2;
	flow(subtitle, bold, 10);
	cursor.y += 6;

	const metaLines: string[] = [];
	if (instinctLabel) metaLines.push(`Instinct: ${instinctLabel}`);
	if (c.origin.option) metaLines.push(`Origin: ${c.origin.option}`);
	const appearance = c.appearance.filter(Boolean);
	if (appearance.length) metaLines.push(`Appearance: ${appearance.join(', ')}`);
	for (const line of metaLines) paragraph(line, { size: 9 });
	cursor.y += 4;

	// ---- stats row ---------------------------------------------------------
	// Never taller than one row, so plain `text`/`box` at a fixed page are
	// fine here — `ensure` already guaranteed the whole row fits above.
	const statW = CONTENT_W / STAT_KEYS.length;
	const statH = 34;
	ensure(statH + 14);
	STAT_KEYS.forEach((stat, i) => {
		const x = MARGIN + i * statW;
		b.box(cursor.page, x, cursor.y, statW, statH);
		const s = c.stats[stat];
		const value = s === undefined ? '—' : s.value >= 0 ? `+${s.value}` : `${s.value}`;
		const label = isStatDebilitated(c, stat) ? `${stat} ✕` : stat;
		const vw = bold.measure(value, 13);
		b.text(cursor.page, value, { x: x + (statW - vw) / 2, y: cursor.y + 5, font: bold, size: 13 });
		const lw = body.measure(label, 7);
		b.text(cursor.page, label, { x: x + (statW - lw) / 2, y: cursor.y + 23, font: body, size: 7 });
	});
	cursor.y += statH + 8;

	// ---- vitals line --------------------------------------------------------
	const vitals = [
		`HP ${c.hp.current} / ${c.hp.max}`,
		`XP ${c.xp}`,
		`Damage ${playbook.base.damage}`
	].join('      ');
	paragraph(vitals, { font: bold, size: 10 });
	cursor.y += 4;

	// ---- moves --------------------------------------------------------------
	const moveById = new Map<string, Move>(playbook.moves.list.map((m) => [m.id, m]));
	const moves = [...heldMoveIds(c, playbook)]
		.map((id) => moveById.get(id))
		.filter((m): m is Move => Boolean(m));
	if (moves.length) {
		heading('Moves');
		for (const move of moves) {
			// Keep a move's name with at least a couple of lines of its text.
			ensure(34);
			flow(move.name, bold, 9.5);
			cursor.y += 1;
			paragraph(plain(move.text));
			cursor.y += 6;
		}
	}

	// ---- background notes ----------------------------------------------------
	if (background?.grants?.notes?.length) {
		heading(background.name);
		for (const note of background.grants.notes) {
			paragraph(`- ${plain(note)}`);
			cursor.y += 2;
		}
	}

	// ---- possessions ----------------------------------------------------------
	const chosen = c.possessions.map((id) =>
		isWriteInPossession(id) ? (c.possessionChoices[id]?.writeIn ?? '—') : id
	);
	const fixed = (playbook.possessions.fixed ?? []).map((p) => p.name);
	if (fixed.length || chosen.length) {
		heading('Possessions');
		for (const item of [...fixed, ...chosen]) {
			paragraph(`- ${plain(item)}`);
			cursor.y += 2;
		}
	}

	// ---- inventory -------------------------------------------------------------
	const carriedGear = c.inventory?.gear ?? [];
	const carriedSmall = c.inventory?.smallItems ?? [];
	if (carriedGear.length || carriedSmall.length) {
		heading('Carried');
		if (carriedGear.length) paragraph(`Gear: ${carriedGear.join(', ')}`, { size: 9 });
		if (carriedSmall.length) {
			cursor.y += 2;
			paragraph(`Small items: ${carriedSmall.join(', ')}`, { size: 9 });
		}
	}

	// ---- introductions -----------------------------------------------------------
	const intros = Object.values(c.introductions ?? {}).filter((v): v is string => !!v?.trim());
	if (intros.length) {
		heading('Introductions');
		for (const note of intros) {
			paragraph(`- ${plain(note)}`);
			cursor.y += 2;
		}
	}

	b.meta({ title: `${name} — Stonetop`, author: 'Splatbook' });
	return { bytes: await b.save(), filename: exportFilename(c, 'pdf') };
}
