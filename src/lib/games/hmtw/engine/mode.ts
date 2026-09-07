/**
 * Which view of the table you are looking at, and what happens between them.
 *
 * The deck is table state, not mode state: the two modes are two views onto one
 * pair of decks, so moving between them never resets a pile. That was the whole
 * of the requirement, and it is the reason `mode` is a single field rather than
 * two separate tables.
 *
 * The exception is leaving a Challenge, which is not a view change but the end
 * of something. Crawlspace clears everything to the discard, and the book agrees
 * — a Challenge's cards are spent when it ends — with one carve-out: durable
 * slots survive, because an inspiration card "lasts until used or until the end
 * of the session", not the end of a fight.
 */

import { emptyInto } from './moves';
import { newRound } from './round';
import type { CardTable } from './table';
import { discardZone, opponentZone, seatZone } from './zones';

export type TableMode = 'decks' | 'challenge';

/**
 * Switch modes. Entering a Challenge changes nothing but the view; leaving one
 * sweeps the table to the discards and forgets the round.
 *
 * The caller confirms first — this is the one action here that destroys work,
 * and a misclick costing a readied Dodge and five hands is exactly the sort of
 * thing that makes people stop trusting an app.
 */
export function setMode(table: CardTable, mode: TableMode): CardTable {
	if (table.mode === mode) return table;
	if (mode === 'challenge') return { ...table, mode };

	let next = table;
	for (const seat of table.seats) {
		const deck = seat === table.gmSeat ? 'gm' : 'player';
		for (const kind of ['hand', 'initiative', 'played', 'facedown'] as const) {
			next = emptyInto(next, seatZone(seat, kind), discardZone(deck));
		}
		// Not `durable`. An inspiration card outlives the fight it was carried
		// into — ch.5 gives it until it is used or the session ends.
	}
	for (const opponent of table.opponents) {
		for (const kind of ['initiative', 'played', 'facedown'] as const) {
			next = emptyInto(next, opponentZone(opponent.id, kind), discardZone('gm'));
		}
	}

	return {
		...next,
		mode,
		opponents: [],
		facedown: {},
		round: newRound()
	};
}
