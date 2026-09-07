/**
 * What the table would suggest doing next.
 *
 * **A prompter, never a gate.** Everything this returns is a suggestion with a
 * shortcut attached; every manual control stays available while it is on, and
 * nothing here refuses anything. The moment it can say no it has become the
 * enforcing engine this phase exists not to build.
 *
 * Derived from the state rather than stored beside it, so it cannot drift out
 * of step with the table it is describing. A player who ignores every prompt and
 * plays by hand leaves the guide correct rather than confused.
 */

import type { ProjectedTable } from '$lib/card-table/client-types';

export interface Suggestion {
	/** What is going on, in the table's own words. */
	text: string;
	/** The obvious next thing, if there is one. */
	action?: { label: string; command: unknown };
	/** True when only the GM can act on it. */
	gmOnly?: boolean;
}

const nameOf = (
	id: string,
	seats: { id: string; name: string }[],
	opponents: { id: string; name: string }[]
) => seats.find((s) => s.id === id)?.name ?? opponents.find((o) => o.id === id)?.name ?? 'Somebody';

/** A readable list: "Daria", "Daria and Chirm", "Daria, Chirm and the imps". */
function listOf(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function suggest(
	table: ProjectedTable,
	seats: { id: string; name: string; status: string; isGm: boolean }[]
): Suggestion {
	const playing = seats.filter((s) => s.status === 'admitted' && !s.isGm);
	const round = table.round;

	if (round.number === 0) {
		// No shortcut here on purpose: dealing needs the GM's own draw count, and
		// the checklist that decides it is a few inches below. A button that
		// guessed the number would be the guide making a ruling.
		return { text: 'Nobody has drawn yet. Set the draw and deal the round.', gmOnly: true };
	}

	// Ch.7 step 2: everyone plays one card facedown before the count begins.
	const withoutInitiative = playing.filter(
		(s) => (table.zones[`seat:${s.id}:initiative`]?.count ?? 0) === 0
	);
	const enemiesWithout = table.opponents.filter(
		(o) => (table.zones[`opponent:${o.id}:initiative`]?.count ?? 0) === 0
	);

	if (round.count === null) {
		if (withoutInitiative.length > 0 || enemiesWithout.length > 0) {
			const waiting = [
				...withoutInitiative.map((s) => s.name),
				...enemiesWithout.map((o) => o.name)
			];
			return { text: `Waiting on initiative from ${listOf(waiting)}.` };
		}
		// "Every initiative is down" is true of an empty table and reads as
		// nonsense there, so say the thing that is actually stopping you.
		if (playing.length === 0 && table.opponents.length === 0) {
			return { text: 'Nobody is at the table yet, and there is nothing to fight.' };
		}
		return {
			text: 'Every initiative is down.',
			action: { label: 'Start the count', command: { type: 'set-count', count: 1 } },
			gmOnly: true
		};
	}

	// The Fool goes first "no matter what", so it outranks the count.
	if (round.interrupt) {
		return {
			text: `${nameOf(round.interrupt, seats, table.opponents)} is interrupting — that happens before the turn.`
		};
	}

	if (round.minorActions) {
		return {
			text: 'Minor actions — anyone who wants one, play it facedown or say pass.',
			action: {
				label: 'Everyone has answered — reveal',
				command: { type: 'minor-actions', open: false }
			},
			gmOnly: true
		};
	}

	if (table.upNow.length > 0) {
		const who = listOf(table.upNow.map((id) => nameOf(id, seats, table.opponents)));
		return {
			text: `${round.count} — ${who}, that is you.`,
			action: {
				label: 'Turn resolved — any minor actions?',
				command: { type: 'minor-actions', open: true }
			},
			gmOnly: true
		};
	}

	// Nobody on this number. Ch.7's count simply carries on.
	return {
		text: `${round.count} — nobody.`,
		action: { label: 'Count on', command: { type: 'advance-count' } },
		gmOnly: true
	};
}
