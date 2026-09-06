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
import { landingSchema } from '../../packs/landing';
import { challengeSchema, deckSchema } from './pack-schemas';
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

describe('hmtw card-table data', () => {
	it('deals a whole tarot deck, split the way the book splits it', async () => {
		const deck = deckSchema.parse(await loadPackFile(packRoot, 'data/deck.json'));
		// Ch1: fifty-six minors in four suits of fourteen, plus twenty-two majors.
		expect(deck.minors).toHaveLength(56);
		expect(deck.majors).toHaveLength(22);
		expect(new Set(deck.minors.map((c) => c.id)).size).toBe(56);

		// The Fool is borrowed into the player deck; the GM holds I–XXI.
		const player = deck.decks.find((d) => d.id === 'player')!;
		const gm = deck.decks.find((d) => d.id === 'gm')!;
		expect(player.includesMajors).toEqual(['fool']);
		expect(gm.excludesMajors).toEqual(['fool']);
	});

	it('uses the ch.7 card values, and RWS major numbering', async () => {
		const deck = deckSchema.parse(await loadPackFile(packRoot, 'data/deck.json'));
		const value = (rank: string) => deck.ranks.find((r) => r.id === rank)!.value;
		expect([value('ace'), value('page'), value('knight'), value('queen'), value('king')]).toEqual([
			1, 11, 12, 13, 14
		]);
		// The book's worked example deals "Justice [XI]" — Waite's numbering, not
		// Marseille's, so Strength is VIII.
		const major = (id: string) => deck.majors.find((m) => m.id === id)!;
		expect(major('strength').value).toBe(8);
		expect(major('justice').value).toBe(11);
		expect(major('fool').value).toBe(0);
	});

	it('splits dooms where ch.7 splits them', async () => {
		const deck = deckSchema.parse(await loadPackFile(packRoot, 'data/deck.json'));
		const lesser = deck.doomTiers.find((t) => t.id === 'lesser')!;
		const greater = deck.doomTiers.find((t) => t.id === 'greater')!;
		expect([lesser.min, lesser.max]).toEqual([1, 14]);
		expect([greater.min, greater.max]).toEqual([15, 21]);
		// Contiguous and total across the majors the GM actually holds.
		expect(greater.min).toBe(lesser.max + 1);
	});

	it('carries the GM draw rule as data, summing the book’s worked example', async () => {
		const c = challengeSchema.parse(await loadPackFile(packRoot, 'data/challenge.json'));
		expect(c.handSizes.player.default).toBe(4);
		expect(c.handSizes.gm.base).toBe(3);

		// Ch7's example: two enemy types, outnumbering, and double-outnumbering,
		// against four adventurers — the book says the GM draws 7.
		const by = (id: string) => c.handSizes.gm.modifiers.find((m) => m.id === id)!;
		const total =
			c.handSizes.gm.base +
			by('enemy-type').amount * 2 +
			by('outnumber').amount +
			by('double').amount;
		expect(total).toBe(7);
	});

	it('groups actions by the suit that pays for them', async () => {
		const c = challengeSchema.parse(await loadPackFile(packRoot, 'data/challenge.json'));
		expect(Object.keys(c.actions.bySuit).sort()).toEqual(['cups', 'pentacles', 'swords', 'wands']);
		expect(c.actions.bySuit.swords.map((a) => a.name)).toEqual(['Attack', 'Riposte']);
		// Ch7: a greater doom pays for any miscellaneous action *except* Vigilance.
		const forbidden = c.actions.anySuit.filter((a) => a.greaterDoomForbidden).map((a) => a.id);
		expect(forbidden).toEqual(['vigilance']);
	});

	it('every suit named by an action group is a real suit, and every minor maps to one', async () => {
		const deck = deckSchema.parse(await loadPackFile(packRoot, 'data/deck.json'));
		const c = challengeSchema.parse(await loadPackFile(packRoot, 'data/challenge.json'));
		const suits = new Set(deck.suits.map((s) => s.id));
		for (const suit of Object.keys(c.actions.bySuit)) expect(suits.has(suit)).toBe(true);
		for (const card of deck.minors) expect(suits.has(card.suit)).toBe(true);
	});
});

describe('hmtw pack round-trip', () => {
	it('has the expected inventory of files', () => {
		expect(manifest.files.sort()).toEqual([
			'data/challenge.json',
			'data/deck.json',
			'landing.json',
			'rules/book.json',
			'rules/gm-note.json'
		]);
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

	it('the landing names the book credits page it links, and it exists', async () => {
		// The colophon's "Full credits from the book" resolves through this id.
		// A pipeline change that renames the Introduction's headings would
		// otherwise turn the link into a 404 with nothing failing.
		const landing = landingSchema.parse(await loadPackFile(packRoot, 'landing.json'));
		expect(landing.kicker).toBe('Unofficial rules reference');
		const credits = book.sections.find((s) => s.id === landing.creditsSectionId);
		expect(credits?.title).toBe('Credits');
		expect(credits?.visibility).toBe('player');
	});

	it('ships the spoiler interstitial the module points at, player-visible', () => {
		const id = hmtw.referenceSpoilers?.interstitialSectionId;
		expect(id).toBeTruthy();
		const section = gmNote.sections.find((s) => s.id === id);
		expect(section?.body).toContain('opt in');
		// Player-visible on purpose, and the reason it exists: gated, the note
		// listed in nobody's contents but a reader who had already opted in, so
		// the sidebar checkbox was the only trace of the gate a player could
		// find. Re-gating it would restore that silently.
		expect(section?.visibility).toBe('player');
		expect(gmNote.sections.every((s) => s.visibility === 'player')).toBe(true);
	});
});
