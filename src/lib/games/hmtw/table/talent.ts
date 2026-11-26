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

export type How = 'now' | 'ready' | 'minor' | 'out' | 'discard';

/** Where the choice is being made: your turn, your minor action, or neither. */
export type Moment = 'turn' | 'minor' | 'other';

/** What each "how" may be, by moment, in the order offered. The first is the default. */
const BY_MOMENT: Record<Moment, How[]> = {
	turn: ['now', 'ready', 'out', 'discard'],
	minor: ['minor', 'ready', 'out', 'discard'],
	other: ['out', 'discard']
};

export const howsFor = (moment: Moment): How[] => BY_MOMENT[moment];

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
	}
}

/** The button that sends it. */
export const howButton: Record<How, string> = {
	now: 'Play it',
	ready: 'Ready it',
	minor: 'Put it down',
	out: 'Play out of turn',
	discard: 'Discard it'
};

export interface TalentPlay {
	holder: string;
	from: Pick;
	extras?: Pick[];
	/** The talent's name, or whatever else was typed. Public. */
	label: string;
	target?: string;
}

/** The existing command a "how" sends. */
export function talentCommand(how: How, moment: Moment, p: TalentPlay): Record<string, unknown> {
	const extra = p.extras && p.extras.length > 0 ? { extra: p.extras } : {};
	const target = p.target ? { target: p.target } : {};
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
	}
}
