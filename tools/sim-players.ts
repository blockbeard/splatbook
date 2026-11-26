/**
 * Random but legal players for a card table: the GM and adventurers who play
 * initiative, take turns (play, ready, Guard, skip, now and then the Fool),
 * answer minor actions, and a GM who steps on, ends rounds, turns over Tests
 * of Fate and starts a new fight every eight rounds.
 *
 * Shared by `cpu-sim.test.ts` (the service in node) and `tools/profile-commands.ts`
 * (the built Worker in workerd), so both play the same game (phase 33).
 */

import {
	facedownZoneOf,
	seededRng,
	upAt,
	waitingForInitiative,
	waitingForMinor,
	type CardTable
} from '../src/lib/games/hmtw/engine';

/** A seat as a simulated client holds it. `id` is the seat id the engine uses. */
export interface Seat {
	id: string;
	claim: { seatId: string; secret: string };
	isGm: boolean;
	/** The client's cursor: what it last saw. */
	version: number;
	stamp?: string;
}

export const GROUPS = [
	{ id: 'aspirants', name: 'Aspirant', count: 3 },
	{ id: 'lion', name: 'Lion', count: 1 },
	{ id: 'hounds', name: 'Hound', count: 2 }
];

/* ---- The players ------------------------------------------------------------ */

export type Command = Record<string, unknown> & { type: string };

export function chooser(seed: number) {
	const rng = seededRng(seed);
	return {
		chance: (p: number) => rng() < p,
		pick: <T>(xs: readonly T[]): T | undefined =>
			xs.length === 0 ? undefined : xs[Math.floor(rng() * xs.length)]
	};
}

/**
 * The next thing somebody at the table does, read off the engine's own state.
 * Returns the command and who sends it.
 */
export function nextMove(
	t: CardTable,
	seats: Seat[],
	choose: ReturnType<typeof chooser>,
	state: { round: number; fights: number }
): { by: Seat; command: Command } | null {
	const gm = seats[0];
	const players = seats.slice(1);
	const handOf = (holder: string) =>
		players.some((p) => p.id === holder) ? `seat:${holder}:hand` : `seat:${gm.id}:hand`;
	const cardsIn = (zone: string) => t.zones[zone]?.cards ?? [];
	const seatFor = (holder: string) => players.find((p) => p.id === holder) ?? gm;
	const targets = [...players.map((p) => p.id), ...GROUPS.map((g) => g.id)];

	if (t.mode !== 'challenge') {
		return { by: gm, command: { type: 'set-mode', mode: 'challenge' } };
	}
	for (const group of GROUPS) {
		if (!t.opponents.some((o) => o.id === group.id)) {
			return {
				by: gm,
				command: {
					type: 'add-opponent',
					id: group.id,
					name: group.name,
					count: group.count,
					health: 6,
					defense: 2
				}
			};
		}
	}

	switch (t.round.step) {
		case 'deal':
			return { by: gm, command: { type: 'begin-round', playerHand: 4, gmHand: 5 } };

		case 'initiative': {
			const holder = waitingForInitiative(t)[0];
			const card = holder && choose.pick(cardsIn(handOf(holder)));
			if (!holder || !card) return { by: gm, command: { type: 'start-count' } };
			return {
				by: seatFor(holder),
				command: { type: 'play-initiative', holder, from: { zone: handOf(holder), card } }
			};
		}

		case 'turn': {
			// Now and then a Test of Fate, the way the session had them mid-fight.
			if (choose.chance(0.05)) {
				return {
					by: gm,
					command: { type: 'move', from: { zone: 'deck:player' }, to: 'fate' }
				};
			}
			// Now and then somebody uses a readied card on another's turn.
			const readied = players.find((p) => {
				const zone = facedownZoneOf(t, p.id);
				return zone && cardsIn(zone).length > 0;
			});
			if (readied && choose.chance(0.15)) {
				return { by: readied, command: { type: 'use-readied', holder: readied.id } };
			}
			// The Fool, with a partner, out of turn.
			const fooled = players.find((p) =>
				cardsIn(handOf(p.id)).some((c) => t.foolCards.includes(c))
			);
			if (fooled && choose.chance(0.5)) {
				const hand = cardsIn(handOf(fooled.id));
				const fool = hand.find((c) => t.foolCards.includes(c))!;
				const partner = hand.find((c) => c !== fool);
				if (partner) {
					return {
						by: fooled,
						command: {
							type: 'play-out-of-turn',
							holder: fooled.id,
							from: { zone: handOf(fooled.id), card: fool },
							extra: [{ zone: handOf(fooled.id), card: partner }],
							action: 'Attack',
							target: choose.pick(GROUPS)!.id
						}
					};
				}
			}

			const holder = upAt(t)[0];
			if (!holder) return { by: gm, command: { type: 'step-on' } };
			const card = choose.pick(cardsIn(handOf(holder)).filter((c) => !t.foolCards.includes(c)));
			if (!card || choose.chance(0.08)) {
				return { by: seatFor(holder), command: { type: 'skip-turn', holder } };
			}
			const mode = choose.chance(0.7) ? 'play' : choose.chance(0.66) ? 'ready' : 'guard';
			return {
				by: seatFor(holder),
				command: {
					type: 'play-turn',
					holder,
					from: { zone: handOf(holder), card },
					action: mode === 'ready' ? 'Dodge' : mode === 'guard' ? 'Guard' : 'Attack',
					target: choose.pick(targets.filter((x) => x !== holder)),
					mode
				}
			};
		}

		case 'minor': {
			const waiting = waitingForMinor(t);
			const groups = waiting.filter((h) => GROUPS.some((g) => g.id === h));
			const player = waiting.find((h) => players.some((p) => p.id === h));
			if (player) {
				const card = choose.pick(cardsIn(handOf(player)));
				if (card && choose.chance(0.3)) {
					return {
						by: seatFor(player),
						command: {
							type: 'declare-minor',
							holder: player,
							from: { zone: handOf(player), card },
							label: 'Attack',
							target: choose.pick(GROUPS)!.id
						}
					};
				}
				if (card && choose.chance(0.1)) {
					return {
						by: seatFor(player),
						command: {
							type: 'ready-minor',
							holder: player,
							from: { zone: handOf(player), card },
							label: 'Dodge'
						}
					};
				}
				return { by: seatFor(player), command: { type: 'pass-minor', holders: [player] } };
			}
			if (groups.length > 0) return { by: gm, command: { type: 'pass-minor', holders: groups } };
			return { by: gm, command: { type: 'step-on' } };
		}

		case 'resolve':
			return { by: gm, command: { type: 'step-on' } };

		case 'over':
			state.round++;
			if (choose.chance(0.3) && cardsIn('fate').length > 0) {
				return { by: gm, command: { type: 'clear-fate' } };
			}
			// Every eight rounds the fight ends and a new one starts: leaving the
			// Challenge sweeps the table, as between Bout I and Bout II.
			if (state.round % 8 === 0) {
				state.fights++;
				return { by: gm, command: { type: 'set-mode', mode: 'decks' } };
			}
			return { by: gm, command: { type: 'end-round' } };
	}
	return null;
}

