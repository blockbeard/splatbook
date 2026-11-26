/**
 * "A talent, or something else": a name, typed, and how the card is played
 * (phase 33).
 *
 * The Discord after Session 14 asked for a way to play talents, and Chris drew
 * the line at a character sheet: the table never knows what a talent does. Going
 * through Chapter 5, what talents do with a card in a Challenge comes down to a
 * few shapes, and every one is a command the table already has: played face up
 * on your turn, readied face down, put down as a minor action, played out of
 * turn as an interrupt, or discarded for a miscellaneous action. Handing a card
 * to someone (Counsel) is the one it didn't have.
 */

import type { Pick } from '$lib/card-table/selection';

export type How = 'now' | 'ready' | 'minor' | 'out' | 'discard' | 'give';

/** A talent from the pack's `talents` (phase 33): only the card's shape. */
export interface Talent {
	id: string;
	name: string;
	/** How the book has the card played. */
	how: How;
	/** The suits the book names; empty for any card. */
	suits: string[];
	summary: string;
	rule: string;
}

/** Chapter 5's talents with a card shape in a Challenge, by path. */
export type TalentsByPath = Record<string, Talent[]>;

/** Whether a held card is one the talent names. A hint, as an action's is. */
export const talentFits = (talent: Talent, suit: string | undefined): boolean =>
	talent.suits.length === 0 || (suit !== undefined && talent.suits.includes(suit));

/** Where the path choice is remembered: on this device, for this game. */
export const TALENT_PATH_KEY = 'splatbook:hmtw:talent-path';

/** Where the choice is being made: your turn, your minor action, or neither. */
export type Moment = 'turn' | 'minor' | 'other';

/** What each "how" may be, by moment, in the order offered. The first is the default. */
const BY_MOMENT: Record<Moment, How[]> = {
	turn: ['now', 'ready', 'out', 'discard', 'give'],
	minor: ['minor', 'ready', 'out', 'discard', 'give'],
	other: ['out', 'discard', 'give']
};

/**
 * What may be chosen now. Handing a card over is an adventurer's, to another
 * adventurer, so it is offered only when there is somebody to hand it to.
 */
export const howsFor = (moment: Moment, canGive = true): How[] =>
	BY_MOMENT[moment].filter((h) => h !== 'give' || canGive);

/** The words for a "how" in the choice. Ready is above the initiative on a turn, below as a minor. */
export function howLabel(how: How, moment: Moment): string {
	switch (how) {
		case 'now':
			return 'Play it now (face up)';
		case 'ready':
			return moment === 'turn'
				? 'Ready it (face down, above your initiative)'
				: 'Ready it (face down, below your initiative)';
		case 'minor':
			return 'As a minor action (face down until the reveal)';
		case 'out':
			return 'Out of turn (an interrupt)';
		case 'discard':
			return 'Discard it (a miscellaneous action)';
		case 'give':
			return 'Hand it to someone (Counsel)';
	}
}

/** The button that sends it. */
export const howButton: Record<How, string> = {
	now: 'Play it',
	ready: 'Ready it',
	minor: 'Put it down',
	out: 'Play out of turn',
	discard: 'Discard it',
	give: 'Hand it over'
};

export interface TalentPlay {
	holder: string;
	from: Pick;
	extras?: Pick[];
	/** The talent's name, or whatever else was typed. Public. */
	label: string;
	/** Whom it is aimed at: any number of targets, and "everyone in" a zone id. */
	aim?: { targets: string[]; inZone?: string };
	/** Counsel: who to hand it to, what they should do, and whether a Resolve was spent. */
	give?: { to: string; action: string; interrupt: boolean };
}

/** An aim as a command carries it: nothing at all when nobody was named. */
export function aimFields(aim: { targets: string[]; inZone?: string } | undefined) {
	return {
		...(aim && aim.targets.length > 0 ? { targets: [...aim.targets] } : {}),
		...(aim?.inZone ? { inZone: aim.inZone } : {})
	};
}

/** The existing command a "how" sends. */
export function talentCommand(how: How, moment: Moment, p: TalentPlay): Record<string, unknown> {
	const extra = p.extras && p.extras.length > 0 ? { extra: p.extras } : {};
	const target = aimFields(p.aim);
	switch (how) {
		case 'now':
			return {
				type: 'play-turn',
				holder: p.holder,
				from: p.from,
				...extra,
				action: p.label,
				...target,
				mode: 'play'
			};
		case 'ready':
			return moment === 'turn'
				? { type: 'play-turn', holder: p.holder, from: p.from, action: p.label, mode: 'ready' }
				: { type: 'ready-minor', holder: p.holder, from: p.from, label: p.label };
		case 'minor':
			return { type: 'declare-minor', holder: p.holder, from: p.from, label: p.label, ...target };
		case 'out':
			return {
				type: 'play-out-of-turn',
				holder: p.holder,
				from: p.from,
				...extra,
				action: p.label,
				...target
			};
		case 'discard':
			return { type: 'discard-for', holder: p.holder, from: p.from, label: p.label };
		case 'give':
			return {
				type: 'give-card',
				holder: p.holder,
				from: p.from,
				to: p.give?.to ?? '',
				// The advice, or the talent's own name if none was given.
				action: (p.give?.action.trim() || p.label).slice(0, 60),
				interrupt: p.give?.interrupt ?? false
			};
	}
}
