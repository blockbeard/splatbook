/**
 * Chapter 7's worked example, played through the table.
 *
 * The Steel-Clad Snakes meet six goblins and a pendulum blade in the Castle of
 * Crossed Destinies. The book prints every card dealt and played, which makes it
 * the closest thing to a specification this feature has: if the table can carry
 * the example end to end, its vocabulary is sufficient for a real round, and if
 * it cannot, something is missing rather than merely untested.
 *
 * Everything here goes through `reduce`, the same path a command from a browser
 * takes. Hands are placed directly rather than dealt, because the book fixes
 * which cards each player holds and a shuffle would not oblige.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPackFile } from '../../packs/fs-loader';
import { hmtwCardTable } from './card-table';
import { seededRng, type CardTable } from './engine';
import { buildFaces, type FaceIndex } from './table/faces';
import { suggestGmHandSize } from './engine/round';

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

let pack: Record<string, unknown>;
let faces: FaceIndex;
let gmConfig: Parameters<typeof suggestGmHandSize>[0];

beforeAll(async () => {
	const deck = await loadPackFile(packRoot, 'data/deck.json');
	const challenge = (await loadPackFile(packRoot, 'data/challenge.json')) as {
		handSizes: { gm: Parameters<typeof suggestGmHandSize>[0] };
	};
	pack = { 'data/deck.json': deck, 'data/challenge.json': challenge };
	faces = buildFaces(deck as never);
	gmConfig = challenge.handSizes.gm;
});

/** The guild, and the GM. */
const SEATS = [
	{ id: 'daria', isGm: false },
	{ id: 'fergus', isGm: false },
	{ id: 'chirm', isGm: false },
	{ id: 'gm', isGm: true }
];

/** The cards the book deals, by seat. */
const HANDS: Record<string, string[]> = {
	daria: ['swords-ii', 'wands-vii', 'wands-ix', 'pentacles-king'],
	fergus: ['cups-x', 'swords-x', 'wands-page', 'fool'],
	chirm: ['swords-v', 'wands-v', 'cups-ace', 'pentacles-page'],
	gm: ['emperor', 'lovers', 'chariot', 'justice', 'death', 'moon', 'sun']
};

function run(table: CardTable, command: unknown, actor: string): CardTable {
	const out = hmtwCardTable.reduce(table, command, { actorSeatId: actor, rng: seededRng(1) });
	if (!out.ok) throw new Error(`${JSON.stringify(command)} refused: ${out.reason}`);
	return out.state as CardTable;
}

/** Deal the book's exact hands by moving named cards out of the decks. */
function dealTheExample(): CardTable {
	let table = hmtwCardTable.syncSeats(
		hmtwCardTable.create(pack, seededRng(1)).state,
		SEATS
	) as CardTable;
	table = run(table, { type: 'set-mode', mode: 'challenge' }, 'gm');

	// Placed rather than dealt: the book fixes the hands, and a shuffle would not
	// oblige. Every other step below goes through the real command path.
	const zones = { ...table.zones };
	const dealt = new Set(Object.values(HANDS).flat());
	zones['deck:player'] = {
		...zones['deck:player'],
		cards: zones['deck:player'].cards.filter((c) => !dealt.has(c))
	};
	zones['deck:gm'] = {
		...zones['deck:gm'],
		cards: zones['deck:gm'].cards.filter((c) => !dealt.has(c))
	};
	for (const [seat, cards] of Object.entries(HANDS)) {
		zones[`seat:${seat}:hand`] = { ...zones[`seat:${seat}:hand`], cards: [...cards] };
	}
	// Round one, at initiative: what dealing would have left.
	return { ...table, zones, round: { ...table.round, number: 1, step: 'initiative' } };
}

const cards = (t: CardTable, zone: string) => t.zones[zone].cards;

describe('Chapter 7’s example Challenge', () => {
	it('step 1 — the GM’s draw comes to seven, as the book counts it', () => {
		// "the 3 default cards, +1 card for each enemy (+2 cards total), +1 card
		// because the enemies outnumber the adventurers, and +1 card because
		// there are twice as many enemies as adventurers"
		expect(suggestGmHandSize(gmConfig, { 'enemy-type': 2, outnumber: true, double: true })).toBe(7);
		expect(HANDS.gm).toHaveLength(7);
	});

	it('step 1 — the GM’s hand splits where the book splits it', () => {
		// "The Emperor [IV], The Lovers [VI], The Chariot [VII], Justice [XI], and
		// Death [XIII] are lesser dooms, whereas The Moon [XVIII] and The Sun
		// [XIX] are greater dooms."
		const lesser = HANDS.gm.filter((c) => !faces[c].greaterDoom);
		const greater = HANDS.gm.filter((c) => faces[c].greaterDoom);
		expect(lesser).toEqual(['emperor', 'lovers', 'chariot', 'justice', 'death']);
		expect(greater).toEqual(['moon', 'sun']);
	});

	it('plays the whole example through', () => {
		let t = dealTheExample();
		t = run(t, { type: 'add-opponent', id: 'goblins', name: 'Goblin raiders', count: 6 }, 'gm');
		t = run(t, { type: 'add-opponent', id: 'pendulum', name: 'Pendulum blade', count: 1 }, 'gm');

		/* -- Step 2: initiative, facedown ---------------------------------- */

		// "Daria plays the King of Pentacles… Fergus the Page of Wands… Chirm a
		// V of Wands." Each names a card in their own hand, which is the one
		// private zone a player may name a card in.
		const initiative = (holder: string, seat: string, card: string) =>
			run(t, { type: 'play-initiative', holder, from: { zone: `seat:${seat}:hand`, card } }, seat);
		t = initiative('daria', 'daria', 'pentacles-king');
		t = initiative('fergus', 'fergus', 'wands-page');
		t = initiative('chirm', 'chirm', 'wands-v');
		// "The GM plays 1 card for Initiative per enemy" — the Emperor for the
		// goblins, and (below) the Chariot for the pendulum.
		t = initiative('goblins', 'gm', 'emperor');
		expect(t.round.step).toBe('initiative');

		// Nobody may read anybody else's initiative yet. "No peeking!"
		const dariaSees = hmtwCardTable.project(t, 'daria') as {
			zones: Record<string, { cards?: string[] }>;
		};
		expect(dariaSees.zones['seat:daria:initiative'].cards).toEqual(['pentacles-king']);
		expect(dariaSees.zones['seat:fergus:initiative'].cards).toBeUndefined();
		expect(dariaSees.zones['opponent:goblins:initiative'].cards).toBeUndefined();
		// The GM sees their enemies' cards, and no player's.
		const gmSees = hmtwCardTable.project(t, 'gm') as {
			zones: Record<string, { cards?: string[] }>;
		};
		expect(gmSees.zones['opponent:goblins:initiative'].cards).toEqual(['emperor']);
		expect(gmSees.zones['seat:daria:initiative'].cards).toBeUndefined();

		/* -- Step 3: the last card down starts the count, and it reaches four -- */

		t = initiative('pendulum', 'gm', 'chariot');
		// "1… 2… 3… 4…" — said by the table now, which jumps to the lowest card.
		expect(t.round.count).toBe(4);
		expect(t.round.step).toBe('turn');
		const up = hmtwCardTable.project(t, 'daria') as {
			upNow: string[];
			zones: Record<string, { cards?: string[] }>;
		};
		expect(up.upNow).toEqual(['goblins']);
		// The goblins' initiative turns over for everyone.
		expect(up.zones['opponent:goblins:initiative'].cards).toEqual(['emperor']);

		// They Attack with Justice [XI], at Fergus.
		t = run(
			t,
			{
				type: 'play-turn',
				holder: 'goblins',
				from: { zone: 'seat:gm:hand', card: 'justice' },
				action: 'Attack',
				target: 'fergus',
				mode: 'play'
			},
			'gm'
		);
		expect(faces['justice'].value).toBe(11); // + the goblins' Swords 4 = 15
		expect(t.plays['justice']).toMatchObject({ by: 'goblins', action: 'Attack' });

		// "Now that they've been attacked, each player flips over their Initiative
		// cards" — King 14, Page 11, V 5. Fergus's turned over as the target;
		// the others show theirs.
		expect(t.round.shown).toContain('fergus');
		t = run(t, { type: 'show-initiative', holder: 'daria' }, 'daria');
		t = run(t, { type: 'show-initiative', holder: 'chirm' }, 'chirm');
		const shown = hmtwCardTable.project(t, 'chirm') as {
			zones: Record<string, { cards?: string[] }>;
		};
		expect(faces[shown.zones['seat:daria:initiative'].cards![0]].value).toBe(14);
		expect(faces[shown.zones['seat:fergus:initiative'].cards![0]].value).toBe(11);
		expect(faces[shown.zones['seat:chirm:initiative'].cards![0]].value).toBe(5);

		/* -- Step 4: minor actions ----------------------------------------- */

		expect(t.round.step).toBe('minor');

		// Fergus Uses an Item with the X of Cups; Chirm Avoids with the Page of
		// Pentacles; Daria Attacks with the VII of Wands. Face down until the
		// last of them answers.
		const minor = (seat: string, card: string, label: string) =>
			run(
				t,
				{
					type: 'declare-minor',
					holder: seat,
					from: { zone: `seat:${seat}:hand`, card },
					label
				},
				seat
			);
		t = minor('fergus', 'cups-x', 'Use Item');
		t = minor('chirm', 'pentacles-page', 'Avoid');
		expect(
			(hmtwCardTable.project(t, 'daria') as { zones: Record<string, { cards?: string[] }> }).zones[
				'seat:chirm:minor'
			].cards
		).toBeUndefined();
		t = minor('daria', 'wands-vii', 'Attack');
		// The pendulum, which did not just act, passes.
		t = run(t, { type: 'pass-minor', holders: ['pendulum'] }, 'gm');

		// Everyone has answered, so the cards are face up together.
		expect(t.round.step).toBe('resolve');
		expect(cards(t, 'seat:fergus:played')).toEqual(['cups-x']);
		expect(t.plays['pentacles-page']).toMatchObject({
			by: 'chirm',
			action: 'Avoid',
			kind: 'minor'
		});

		// "a minor action's total value equals the card's face value" — 10 and 11
		// before the GM's disfavour, which is the table's arithmetic, not ours.
		expect(faces['cups-x'].value).toBe(10);
		expect(faces['pentacles-page'].value).toBe(11);
		expect(faces['wands-vii'].value).toBe(7);

		/* -- Back to step 3: "I was on 4. 5… 6… 7…" ------------------------ */

		t = run(t, { type: 'step-on' }, 'gm');
		// Chirm's V is next; the table jumps there, past nobody.
		expect(t.round.count).toBe(5);
		expect(cards(t, 'seat:fergus:played')).toEqual([]);
		t = run(t, { type: 'skip-turn', holder: 'chirm' }, 'chirm');
		// The pendulum's initiative turns over: a VII.
		expect(t.round.count).toBe(7);
		expect(t.round.shown).toContain('pendulum');
		expect(faces[cards(t, 'opponent:pendulum:initiative')[0]].value).toBe(7);

		/* -- The state the book leaves the table in ------------------------ */

		// Fergus still holds the Fool and the X of Swords; Chirm the V of Swords
		// and the Ace of Cups; Daria the II of Swords and the IX of Wands.
		expect(cards(t, 'seat:fergus:hand').sort()).toEqual(['fool', 'swords-x']);
		expect(cards(t, 'seat:chirm:hand').sort()).toEqual(['cups-ace', 'swords-v']);
		expect(cards(t, 'seat:daria:hand').sort()).toEqual(['swords-ii', 'wands-ix']);
		// The GM has spent three of seven: Emperor, Chariot, Justice.
		expect(cards(t, 'seat:gm:hand').sort()).toEqual(['death', 'lovers', 'moon', 'sun']);

		// Nothing was lost or duplicated along the way.
		const all = Object.values(t.zones).flatMap((z) => z.cards);
		expect(all).toHaveLength(78);
		expect(new Set(all).size).toBe(78);
	});

	it('ends the round the way ch.7 step 5 says to', () => {
		let t = dealTheExample();
		t = run(
			t,
			{
				type: 'move',
				from: { zone: 'seat:daria:hand', card: 'pentacles-king' },
				to: 'seat:daria:initiative'
			},
			'daria'
		);
		// Chirm readies a Dodge, as a turn would (placed here directly).
		t = {
			...t,
			zones: {
				...t.zones,
				'seat:chirm:hand': {
					...t.zones['seat:chirm:hand'],
					cards: t.zones['seat:chirm:hand'].cards.filter((c) => c !== 'swords-v')
				},
				'seat:chirm:facedown': { ...t.zones['seat:chirm:facedown'], cards: ['swords-v'] }
			},
			facedown: { 'seat:chirm:facedown': { position: 'turn', label: 'Dodge' } }
		};

		t = run(t, { type: 'end-round' }, 'gm');

		// "Everybody discards any unused Challenge cards… and their current
		// Initiative card. Facedown cards remain in play."
		expect(cards(t, 'seat:daria:hand')).toEqual([]);
		expect(cards(t, 'seat:daria:initiative')).toEqual([]);
		expect(cards(t, 'seat:chirm:facedown')).toEqual(['swords-v']);
		// Fergus's unused cards go to the discard, the Fool among them.
		//
		// Note what this does *not* prove: the both-decks reshuffle. These hands
		// are placed rather than drawn, so nothing ever came off a deck and the
		// Fool-was-drawn flag was never set. Asserting the Fool is in the discard
		// here would look like the reshuffle rule passing when it had not been
		// exercised at all — that rule is covered in round.test.ts, where the
		// cards are genuinely dealt.
		expect(cards(t, 'discard:player')).toContain('fool');
		expect(t.round.foolDrawn).toBe(false);
	});
});
