/**
 * Round-trip tests for the His Majesty the Worm content pack (phase 22).
 *
 * A rules-reference pack: two generated document trees (the book, and the
 * pack-authored GM-note interstitial). The chapter spine and the GM gating
 * are snapshotted so a pipeline change that renames ids or un-gates a GM
 * chapter fails CI instead of silently breaking deep links or leaking
 * spoilers.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadManifest, loadPackFile } from '../../packs/fs-loader';
import { validatePack } from '../../packs/harness';
import type { PackManifest } from '../../packs/types';
import { documentTreeSchema, type DocumentTree } from '../../reference/document-tree';
import '../index'; // register game modules (wires hmtw schemas into the harness)
import { hmtw } from './index';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

let manifest: PackManifest;
let book: DocumentTree;
let gmNote: DocumentTree;
beforeAll(async () => {
	manifest = await loadManifest(packRoot);
	book = documentTreeSchema.parse(await loadPackFile(packRoot, 'rules/book.json'));
	gmNote = documentTreeSchema.parse(await loadPackFile(packRoot, 'rules/gm-note.json'));
});

describe('hmtw pack round-trip', () => {
	it('has the expected inventory of files', () => {
		expect(manifest.files.sort()).toEqual(['landing.json', 'rules/book.json', 'rules/gm-note.json']);
		expect(manifest.license).toBe('LicenseRef-HMtW');
	});

	it('validates through the shared harness', async () => {
		const result = await validatePack(packRoot);
		expect(result.errors).toEqual([]);
	});

	it('carries the book’s chapter spine, appendices unnumbered', () => {
		expect(book.chapters?.map((c) => [c.id, c.number ?? null, c.title])).toEqual([
			['00-introduction', null, 'Introduction'],
			['01-chapter-1-the-basics', 1, 'The Basics'],
			['02-chapter-2-the-adventurer', 2, 'The Adventurer'],
			['03-chapter-3-the-guild', 3, 'The Guild'],
			['04-chapter-4-kith-and-kin', 4, 'Kith and Kin'],
			['05-chapter-5-the-four-paths', 5, 'The Four Paths'],
			['06-chapter-6-the-crawl-phase', 6, 'The Crawl Phase'],
			['07-chapter-7-the-challenge-phase', 7, 'The Challenge Phase'],
			['08-chapter-8-the-camp-phase', 8, 'The Camp Phase'],
			['09-chapter-9-the-city-phase', 9, 'The City Phase'],
			['10-chapter-10-the-worm-turns-gamemastering', 10, 'The Worm Turns: Gamemastering'],
			['11-appendix-a-sorcery', null, 'Appendix A: Sorcery'],
			['12-appendix-b-alchemy', null, 'Appendix B: Alchemy'],
			['13-appendix-c-dungeon-denizens', null, 'Appendix C: Dungeon Denizens'],
			['14-appendix-d-city-creation', null, 'Appendix D: City Creation'],
			['15-appendix-e-underworld-creation', null, 'Appendix E: Underworld Creation'],
			['16-index', null, 'Index']
		]);
	});

	it('gates exactly chapter 10 and appendices C/D/E as GM', () => {
		const byChapter = new Map<string, Set<string>>();
		for (const s of book.sections) {
			const set = byChapter.get(s.chapter ?? '') ?? new Set();
			set.add(s.visibility);
			byChapter.set(s.chapter ?? '', set);
		}
		const gmChapters = [...byChapter.entries()]
			.filter(([, vis]) => vis.has('gm'))
			.map(([id]) => id)
			.sort();
		expect(gmChapters).toEqual([
			'10-chapter-10-the-worm-turns-gamemastering',
			'13-appendix-c-dungeon-denizens',
			'14-appendix-d-city-creation',
			'15-appendix-e-underworld-creation'
		]);
		// No chapter mixes visibilities — gating is per source file.
		for (const [id, vis] of byChapter) expect(vis.size, id).toBe(1);
	});

	it('keeps the Tomb of Golden Ghosts out, replacement note in', () => {
		const appendixE = book.sections.filter(
			(s) => s.chapter === '15-appendix-e-underworld-creation'
		);
		expect(appendixE.some((s) => s.title.includes('Tomb of Golden Ghosts'))).toBe(false);
		expect(appendixE.some((s) => s.title === 'Building the Tutorial Dungeon')).toBe(false);
		expect(appendixE.some((s) => s.body.includes('dungeons.hismajestytheworm.games'))).toBe(true);
	});

	it('anchors deep links the reader depends on', () => {
		const ids = new Set(book.sections.map((s) => s.id));
		for (const id of [
			'07-chapter-7-the-challenge-phase--gming-the-challenge',
			'07-chapter-7-the-challenge-phase--1-draw-challenge-cards-3',
			'06-chapter-6-the-crawl-phase--meatgrinder'
		]) {
			expect(ids.has(id), id).toBe(true);
		}
	});

	it('ships the spoiler interstitial the module points at, gated GM', () => {
		const id = hmtw.referenceSpoilers?.interstitialSectionId;
		expect(id).toBeTruthy();
		const section = gmNote.sections.find((s) => s.id === id);
		expect(section?.visibility).toBe('gm');
		expect(section?.body).toContain('opt in');
	});
});
