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
	/** Where the book says more: a page of this game's rules reference. */
	rule?: { label: string; page: string };
}

/** The pack's words for the guide (`data/challenge.json`). */
export interface GuideWords {
	endOfRound: { text: string; rule: { label: string; page: string } };
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
	seats: { id: string; name: string; status: string; isGm: boolean }[],
	words?: GuideWords
): Suggestion {
	const round = table.round;
	const named = (ids: readonly string[]) =>
		listOf(ids.map((id) => nameOf(id, seats, table.opponents)));
	const me = table.viewer;
	const waiting = table.waitingOn ?? [];
	// What a viewer acts for: their own seat, or every group when they run the
	// table. The GM answers minor actions for the enemies.
	const runsTable = me !== null && (!table.gmSeat || table.gmSeat === me);
	const mine = (id: string) => id === me || (runsTable && table.opponents.some((o) => o.id === id));

	switch (round.step) {
		case 'deal':
			// No shortcut here on purpose: dealing needs the GM's own draw count,
			// and the checklist that decides it is a few inches below. A button
			// that guessed the number would be the guide making a ruling.
			return { text: 'Nobody has drawn yet. Set the draw and deal the round.', gmOnly: true };

		case 'initiative': {
			if (waiting.length === 0) {
				return { text: 'Nobody is at the table yet, and there is nothing to fight.' };
			}
			const yours = waiting.filter(mine);
			const others = waiting.filter((id) => !mine(id));
			const text =
				yours.length > 0
					? `Choose your initiative: pick a card, then press Play as initiative${
							yours.some((id) => id !== me)
								? ` (for ${named(yours.filter((id) => id !== me))})`
								: ''
						}.${others.length > 0 ? ` Still waiting on ${named(others)}.` : ''}`
					: `Waiting on initiative from ${named(others)}.`;
			return {
				text,
				action: { label: 'Start the count now', command: { type: 'step-on' } },
				gmOnly: true
			};
		}

		case 'turn': {
			// Said to each person, not to the room: "that is you" on every screen
			// told three players it was their turn when it was one player's
			// (first live test, 25 November 2026).
			const up = table.upNow;
			const yours = up.filter(mine);
			const others = up.filter((id) => !mine(id));
			const text =
				yours.length > 0
					? `${round.count} — your turn${
							yours.some((id) => id !== me) ? ` (${named(yours)})` : ''
						}: play a card or skip.${
							others.length > 0
								? ` ${named(others)} also ${others.length > 1 ? 'act' : 'acts'} on ${round.count}.`
								: ''
						}`
					: `${round.count} — ${named(up)} to act.`;
			return {
				text,
				action: { label: 'Skip their turn', command: { type: 'step-on' } },
				gmOnly: true
			};
		}

		case 'minor': {
			const yours = waiting.filter(mine);
			const others = waiting.filter((id) => !mine(id));
			const text =
				yours.length > 0
					? `Any minor actions? Put one down, ready one, or pass.${
							others.length > 0 ? ` Also waiting on ${named(others)}.` : ''
						}`
					: `Minor actions: waiting on ${named(others)}.`;
			return {
				text,
				action: { label: 'Turn them over now', command: { type: 'step-on' } },
				gmOnly: true
			};
		}

		case 'resolve': {
			const still = table.stillToAct ?? [];
			return {
				text: `${round.count}: everything is face up. Work it out, then the GM moves on.${
					still.length > 0 ? ` Still to act: ${named(still)}.` : ''
				}`,
				action: { label: 'Next', command: { type: 'step-on' } },
				gmOnly: true
			};
		}

		case 'over':
			// Ch.7 step 5: when everyone has had a turn, the round is over — and
			// that is the moment the book asks for a look at how the fight is
			// going. It is the check that is easiest to skip, and skipping it is
			// how one fight ran for three sessions; so it is said to everyone.
			return words
				? {
						text: words.endOfRound.text,
						action: { label: 'End the round', command: { type: 'end-round' } },
						gmOnly: true,
						rule: { ...words.endOfRound.rule }
					}
				: {
						text: 'Everyone has had a turn.',
						action: { label: 'End the round', command: { type: 'end-round' } },
						gmOnly: true
					};
	}
}
