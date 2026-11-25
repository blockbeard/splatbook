/**
 * The round, one step at a time (phase 32).
 *
 * The first live test (25 November 2026) ran a Challenge on a table where
 * anybody could put any card anywhere, the GM stepped the count by hand and
 * opened and closed minor actions by hand, and the turned-over minor actions
 * were left lying sideways. In Chris's words: "I like the idea we could touch
 * each others cards but it makes it too hard to know what is going on." So the
 * round now walks ch.7's steps:
 *
 * 1. **Initiative.** Each adventurer, and the GM for each group, plays one
 *    card face down. The last one down starts the count.
 * 2. **The count** jumps to the lowest initiative not yet acted, and those
 *    cards turn face up: "flip your Initiative card face up to declare that you
 *    are the acting player".
 * 3. **The turn.** Whoever holds the number plays a card (into the open, with
 *    what it is for), readies one (face down, sideways, kept), Guards (a new
 *    initiative), or skips. With nobody playing, nobody takes minor actions.
 * 4. **Minor actions.** Everyone else puts one down face down, readies one, or
 *    passes; the last answer turns them all over together.
 * 5. **Resolve.** The GM applies what is face up and moves on; the cards go to
 *    their own discards, and the count jumps again.
 * 6. **Over**, once everyone has acted: the end-of-round check.
 *
 * Every automatic step happens inside the command that completes it. Nothing
 * here is a rule of the game — no value, suit or target is ever checked. What
 * is checked is the table's own state: a turn played when it is not your turn
 * is refused as `not-up`, a command in the wrong step as `wrong-step`, so a
 * page a poll behind cannot put a card somewhere the round has moved on from.
 * The GM can always move the round on (`stepOn`).
 */

import { clearFacedown, facedownZoneOf, placeFacedown } from './exceptions';
import { discardAll, moveCard, type MoveFailure, type Pick } from './moves';
import { holdersWithInitiative, initiativeHolder } from './initiative';
import type { RoundStep } from './round';
import { upCount, type CardTable, type Play } from './table';
import { opponentZone, seatZone } from './zones';

export type StepFailure =
	| MoveFailure
	| 'wrong-step'
	| 'not-up'
	| 'no-such-holder'
	| 'already-answered'
	| 'nothing-to-take-back';

export type StepResult = { ok: true; table: CardTable } | { ok: false; reason: StepFailure };

const fail = (reason: StepFailure): StepResult => ({ ok: false, reason });
const ok = (table: CardTable): StepResult => ({ ok: true, table });

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

/* ---- Who is who ---------------------------------------------------------- */

const isSeat = (table: CardTable, holder: string) => table.seats.includes(holder);
const isGroup = (table: CardTable, holder: string) => table.opponents.some((o) => o.id === holder);

/** The adventurers: every seat but the GM's. */
const adventurers = (table: CardTable) => table.seats.filter((s) => s !== table.gmSeat);

/** Groups with a creature still up. A group all down needs no initiative. */
const groupsUp = (table: CardTable) =>
	table.opponents.filter((o) => upCount(o) > 0).map((o) => o.id);

const zoneOf = (table: CardTable, holder: string, kind: 'initiative' | 'played' | 'minor') =>
	isSeat(table, holder) ? seatZone(holder, kind) : opponentZone(holder, kind);

/** Where a holder's cards come from: their own hand, or the GM's for a group. */
function handOf(table: CardTable, holder: string): string | null {
	if (isSeat(table, holder)) return seatZone(holder, 'hand');
	return table.gmSeat ? seatZone(table.gmSeat, 'hand') : null;
}

function hasCards(table: CardTable, holder: string): boolean {
	const hand = handOf(table, holder);
	return hand !== null && (table.zones[hand]?.cards.length ?? 0) > 0;
}

/** A seat still at the table, or a group with a creature up. */
const isLive = (table: CardTable, holder: string) =>
	isSeat(table, holder) || groupsUp(table).includes(holder);

/** The group a target belongs to: a seat or group as itself, a creature as its group. */
function holderOfTarget(table: CardTable, target: string): string | null {
	if (isSeat(table, target) || isGroup(table, target)) return target;
	return table.opponents.find((o) => o.creatures.some((c) => c.id === target))?.id ?? null;
}

/** Whoever holds the number being called and has not yet acted. */
export function upAt(table: CardTable): string[] {
	const { count, acted } = table.round;
	if (count === null) return [];
	return holdersWithInitiative(table)
		.filter(([holder, value]) => value === count && !acted.includes(holder))
		.map(([holder]) => holder);
}

/** Everybody whose initiative is on the number, acted or not. */
function atCount(table: CardTable): string[] {
	const { count } = table.round;
	if (count === null) return [];
	return holdersWithInitiative(table)
		.filter(([holder, value]) => value === count && isLive(table, holder))
		.map(([holder]) => holder);
}

const withRound = (table: CardTable, round: Partial<CardTable['round']>): CardTable => ({
	...table,
	round: { ...table.round, ...round }
});

const inStep = (table: CardTable, ...steps: RoundStep[]) => steps.includes(table.round.step);

/* ---- Initiative ---------------------------------------------------------- */

/**
 * Who the count waits for: every adventurer holding cards, and every group with
 * a creature up. Somebody with an empty hand and no initiative is not waited
 * for — a physical table would not wait for them either.
 */
export function expectedInitiative(table: CardTable): string[] {
	const withCard = new Set(holdersWithInitiative(table).map(([h]) => h));
	return [
		...adventurers(table).filter((s) => withCard.has(s) || hasCards(table, s)),
		...groupsUp(table)
	];
}

/** Who the count is still waiting on for initiative. */
export function waitingForInitiative(table: CardTable): string[] {
	const withCard = new Set(holdersWithInitiative(table).map(([h]) => h));
	return expectedInitiative(table).filter((h) => !withCard.has(h));
}

/**
 * Play a card as initiative — "select one card and play it facedown". Before
 * the count starts it can be changed: the old card goes back to the hand it
 * came from. The last card down starts the count.
 */
export function playInitiative(
	table: CardTable,
	holder: string,
	from: Pick,
	actor?: string
): StepResult {
	if (!isSeat(table, holder) && !isGroup(table, holder)) return fail('no-such-holder');
	if (holder === table.gmSeat) return fail('no-such-holder');
	const slot = zoneOf(table, holder, 'initiative');
	const occupied = (table.zones[slot]?.cards.length ?? 0) > 0;
	// Late is allowed — a group added mid-round, a player who joined — but only
	// for someone who has not yet acted, and never over a card already counted.
	const late = inStep(table, 'turn', 'minor', 'resolve') && !table.round.acted.includes(holder);
	if (!inStep(table, 'initiative') && !(late && !occupied)) return fail('wrong-step');

	let current = table;
	if (occupied) {
		const hand = handOf(table, holder);
		if (!hand) return fail('no-such-holder');
		const back = moveCard(current, { zone: slot }, hand);
		if (!back.ok) return fail(back.reason);
		current = back.table;
	}
	const moved = moveCard(current, from, slot, actor);
	if (!moved.ok) return fail(moved.reason);
	current = moved.table;

	if (inStep(current, 'initiative') && waitingForInitiative(current).length === 0) {
		return ok(nextNumber(current));
	}
	return ok(current);
}

/** Start the count without waiting — the GM's, for a player who has gone quiet. */
export function startCount(table: CardTable): StepResult {
	if (!inStep(table, 'initiative')) return fail('wrong-step');
	return ok(nextNumber(table));
}

/* ---- The count ----------------------------------------------------------- */

/**
 * Move the count to the lowest initiative not yet acted, and turn those cards
 * face up. With nobody left, the round is over.
 *
 * Someone at the number with an empty hand is skipped at once — "if you have no
 * cards in your hand when the GM calls your Initiative number, you do not take
 * an action and nobody takes a minor action" — and if that is everyone at the
 * number, the count simply moves on again.
 */
export function nextNumber(table: CardTable): CardTable {
	const acted = new Set(table.round.acted);
	const waiting = holdersWithInitiative(table).filter(
		([holder]) => !acted.has(holder) && isLive(table, holder)
	);
	if (waiting.length === 0) {
		return withRound(table, { step: 'over', answered: [], playedHere: false });
	}
	const count = Math.min(...waiting.map(([, v]) => v));
	const at = waiting.filter(([, v]) => v === count).map(([h]) => h);
	const empty = at.filter((h) => !hasCards(table, h));
	const next = withRound(table, {
		count,
		step: 'turn',
		answered: [],
		playedHere: false,
		shown: union(table.round.shown, at),
		acted: union(table.round.acted, empty)
	});
	return empty.length === at.length ? nextNumber(next) : next;
}

/* ---- The turn ------------------------------------------------------------ */

export interface TurnPlay {
	from: Pick;
	/** More cards played with it: the GM's greater doom with its lesser, a Fool's partner. */
	extra?: Pick[];
	/** What it is for, as the player names it. */
	action: string;
	/** Who it is aimed at: a seat, a group or a creature. Their initiative turns face up. */
	target?: string;
	/**
	 * `play`: face up into the open. `ready`: face down and sideways above the
	 * initiative, kept until used (Riposte, Dodge, Aid Another, Vigilance).
	 * `guard`: the card replaces the initiative, the old one discarded.
	 */
	mode: 'play' | 'ready' | 'guard';
}

/** Lay cards face up in front of a holder, labelled with what they were for. */
function layDown(
	table: CardTable,
	holder: string,
	picks: Pick[],
	label: Omit<Play, 'by' | 'number'>,
	actor?: string
): StepResult {
	let current = table;
	const played = zoneOf(table, holder, 'played');
	const plays = { ...table.plays };
	for (const pick of picks) {
		const moved = moveCard(current, pick, played, actor);
		if (!moved.ok) return fail(moved.reason);
		current = moved.table;
		plays[moved.card] = { ...label, by: holder, number: table.round.count };
	}
	current = { ...current, plays };
	if (label.target) {
		// "When other characters attempt to perform an action against you, flip
		// your Initiative card face up."
		const target = holderOfTarget(current, label.target);
		if (target) current = withRound(current, { shown: union(current.round.shown, [target]) });
	}
	return ok(current);
}

/** Whoever holds the number takes their turn. */
export function playTurn(
	table: CardTable,
	holder: string,
	turn: TurnPlay,
	actor?: string
): StepResult {
	if (!inStep(table, 'turn')) return fail('wrong-step');
	if (!upAt(table).includes(holder)) return fail('not-up');

	let result: StepResult;
	if (turn.mode === 'ready') {
		const placed = placeFacedown(
			table,
			holder,
			turn.from,
			{ position: 'turn', label: turn.action },
			actor
		);
		result = placed.ok ? ok(placed.table) : fail(placed.reason);
	} else if (turn.mode === 'guard') {
		// Guard: "replace your Initiative with any card from your hand … Your old
		// Initiative is discarded." The new one goes down face down, as any
		// initiative does, and turns up again when someone acts against you.
		const slot = zoneOf(table, holder, 'initiative');
		const cleared = discardAll(table, slot, isSeat(table, holder) ? 'player' : 'gm');
		const moved = moveCard(cleared, turn.from, slot, actor);
		result = moved.ok
			? ok(
					withRound(moved.table, {
						shown: moved.table.round.shown.filter((h) => h !== holder)
					})
				)
			: fail(moved.reason);
	} else {
		result = layDown(
			table,
			holder,
			[turn.from, ...(turn.extra ?? [])],
			{ action: turn.action, target: turn.target, kind: 'turn' },
			actor
		);
	}
	if (!result.ok) return result;
	const acted = withRound(result.table, {
		acted: union(result.table.round.acted, [holder]),
		playedHere: true
	});
	return ok(afterTurn(acted));
}

/** "You do not *have* to take an action on your turn." */
export function skipTurn(table: CardTable, holder: string): StepResult {
	if (!inStep(table, 'turn')) return fail('wrong-step');
	if (!upAt(table).includes(holder)) return fail('not-up');
	return ok(afterTurn(withRound(table, { acted: union(table.round.acted, [holder]) })));
}

/** Once everyone at the number has acted: minor actions, or straight on if nobody played. */
function afterTurn(table: CardTable): CardTable {
	if (upAt(table).length > 0) return table;
	return table.round.playedHere ? openMinor(table) : nextNumber(table);
}

/* ---- Out of turn --------------------------------------------------------- */

/**
 * The Fool, or a talent's interrupt: played out of turn, before the acting
 * player's action, on anybody's turn. "The Fool *always* goes first, no matter
 * what"; it is an extra turn, so it opens no minor actions and costs the
 * holder nothing of their own turn.
 */
export function playOutOfTurn(
	table: CardTable,
	holder: string,
	turn: Omit<TurnPlay, 'mode'>,
	actor?: string
): StepResult {
	if (!inStep(table, 'turn', 'minor', 'resolve')) return fail('wrong-step');
	if (!isSeat(table, holder) && !isGroup(table, holder)) return fail('no-such-holder');
	return layDown(
		table,
		holder,
		[turn.from, ...(turn.extra ?? [])],
		{ action: turn.action, target: turn.target, kind: 'out-of-turn' },
		actor
	);
}

/**
 * Use a readied card: it turns face up into the open, labelled with what it
 * was readied for. Riposte and Dodge trigger on an attack, Aid Another and
 * Vigilance on another character's action — so on other people's turns, by
 * design, and in any step.
 */
export function useReadied(table: CardTable, holder: string): StepResult {
	const zone = facedownZoneOf(table, holder);
	if (!zone) return fail('no-such-holder');
	const card = table.zones[zone]?.cards[0];
	if (card === undefined) return fail('empty');
	const declared = table.facedown[zone];
	const moved = moveCard(table, { zone }, zoneOf(table, holder, 'played'));
	if (!moved.ok) return fail(moved.reason);
	const facedown = { ...moved.table.facedown };
	delete facedown[zone];
	return ok({
		...moved.table,
		facedown,
		plays: {
			...moved.table.plays,
			[card]: {
				by: holder,
				action: declared?.label ?? 'Readied action',
				kind: 'readied',
				number: table.round.count
			}
		}
	});
}

/** Turn an initiative card face up — "Show my initiative", for when you are attacked. */
export function showInitiative(table: CardTable, holder: string): StepResult {
	if (!isSeat(table, holder) && !isGroup(table, holder)) return fail('no-such-holder');
	return ok(withRound(table, { shown: union(table.round.shown, [holder]) }));
}

/* ---- Minor actions ------------------------------------------------------- */

/**
 * Who is asked about minor actions at this number: every adventurer holding
 * cards who did not just act, and every group with a creature up that did not
 * just act, if the GM holds cards ("If one of your characters just had their
 * turn, other characters you control can take a minor action").
 */
export function expectedMinor(table: CardTable): string[] {
	const acting = new Set(atCount(table));
	const players = adventurers(table).filter((s) => !acting.has(s) && hasCards(table, s));
	const groups = groupsUp(table).filter((g) => !acting.has(g) && hasCards(table, g));
	return [...players, ...groups];
}

/** Who minor actions are still waiting on. */
export function waitingForMinor(table: CardTable): string[] {
	if (!inStep(table, 'minor')) return [];
	return expectedMinor(table).filter((h) => !table.round.answered.includes(h));
}

function openMinor(table: CardTable): CardTable {
	const open = withRound(table, { step: 'minor', answered: [] });
	return expectedMinor(open).length === 0 ? revealMinors(open) : open;
}

function answer(table: CardTable, holders: readonly string[]): CardTable {
	const next = withRound(table, { answered: union(table.round.answered, holders) });
	return waitingForMinor(next).length === 0 ? revealMinors(next) : next;
}

function checkMinor(table: CardTable, holder: string): StepFailure | null {
	if (!inStep(table, 'minor')) return 'wrong-step';
	if (!expectedMinor(table).includes(holder)) return 'not-up';
	if (table.round.answered.includes(holder)) return 'already-answered';
	return null;
}

/**
 * Put a minor action down face down, saying what it is for. "Everybody who
 * wants to perform a minor action declares what they want to do and puts down
 * a card to represent this action. Then, everybody reveals their cards
 * simultaneously."
 */
export function declareMinor(
	table: CardTable,
	holder: string,
	from: Pick,
	label: string,
	actor?: string,
	target?: string
): StepResult {
	const refused = checkMinor(table, holder);
	if (refused) return fail(refused);
	const zone = zoneOf(table, holder, 'minor');
	const moved = moveCard(table, from, zone, actor);
	if (!moved.ok) return fail(moved.reason);
	return ok(
		answer(
			{
				...moved.table,
				minorDeclared: { ...moved.table.minorDeclared, [zone]: label },
				minorTargets: target
					? { ...moved.table.minorTargets, [zone]: target }
					: moved.table.minorTargets
			},
			[holder]
		)
	);
}

/** Ready a facedown action as a minor action: sideways, below the initiative, and kept. */
export function readyMinor(
	table: CardTable,
	holder: string,
	from: Pick,
	label: string,
	actor?: string
): StepResult {
	const refused = checkMinor(table, holder);
	if (refused) return fail(refused);
	const placed = placeFacedown(table, holder, from, { position: 'minor', label }, actor);
	if (!placed.ok) return fail(placed.reason);
	return ok(answer(placed.table, [holder]));
}

/** No minor action. The GM may pass for several groups at once. */
export function passMinor(table: CardTable, holders: readonly string[]): StepResult {
	for (const holder of holders) {
		const refused = checkMinor(table, holder);
		if (refused) return fail(refused);
	}
	return ok(answer(table, holders));
}

/**
 * Turn every minor action over at once, into the open with what it was for.
 * By itself when the last person answers; the GM's "Turn them over now" for
 * somebody who has gone quiet.
 */
export function revealMinors(table: CardTable): CardTable {
	let current = table;
	const plays = { ...table.plays };
	const minorDeclared = { ...table.minorDeclared };
	const minorTargets = { ...table.minorTargets };
	const targeted: string[] = [];
	const holders = [...table.seats, ...table.opponents.map((o) => o.id)];
	for (const holder of holders) {
		const zone = zoneOf(current, holder, 'minor');
		const card = current.zones[zone]?.cards[0];
		if (card === undefined) continue;
		const moved = moveCard(current, { zone }, zoneOf(current, holder, 'played'));
		if (!moved.ok) continue;
		current = moved.table;
		plays[card] = {
			by: holder,
			action: minorDeclared[zone] ?? 'Minor action',
			...(minorTargets[zone] ? { target: minorTargets[zone] } : {}),
			kind: 'minor',
			number: table.round.count
		};
		// "When other characters attempt to perform an action against you, flip
		// your Initiative card face up" — a minor action as much as a turn.
		const target = minorTargets[zone] ? holderOfTarget(current, minorTargets[zone]) : null;
		if (target) targeted.push(target);
		delete minorDeclared[zone];
		delete minorTargets[zone];
	}
	const revealed = withRound(
		{ ...current, plays, minorDeclared, minorTargets },
		{ shown: union(current.round.shown, targeted) }
	);
	// Nothing face up — a readied card, everyone passing — is nothing to work
	// out, so the count moves straight on rather than waiting on the GM.
	const anything = holders.some(
		(holder) => (revealed.zones[zoneOf(revealed, holder, 'played')]?.cards.length ?? 0) > 0
	);
	return anything ? withRound(revealed, { step: 'resolve' }) : nextNumber(revealed);
}

/* ---- Resolve ------------------------------------------------------------- */

/**
 * The number is done: everything played goes to its own deck's discard, and
 * the count moves on. This is what the Sweep was, done at the moment it is
 * always due.
 */
export function resolveNumber(table: CardTable): StepResult {
	if (!inStep(table, 'resolve')) return fail('wrong-step');
	let current = table;
	for (const seat of table.seats) {
		current = discardAll(
			current,
			seatZone(seat, 'played'),
			seat === table.gmSeat ? 'gm' : 'player'
		);
	}
	for (const opponent of table.opponents) {
		current = discardAll(current, opponentZone(opponent.id, 'played'), 'gm');
	}
	return ok(nextNumber({ ...current, plays: {} }));
}

/* ---- The GM's overrides, and taking something back ------------------------ */

/**
 * Move the round on, whatever it is waiting for — the GM's, for when somebody
 * has gone quiet or something has gone wrong. Initiative: start the count.
 * A turn: skip whoever has not acted. Minor actions: turn them over now.
 * Resolve: next.
 */
export function stepOn(table: CardTable): StepResult {
	switch (table.round.step) {
		case 'initiative':
			return startCount(table);
		case 'turn':
			return ok(afterTurn(withRound(table, { acted: union(table.round.acted, upAt(table)) })));
		case 'minor':
			return ok(revealMinors(table));
		case 'resolve':
			return resolveNumber(table);
		default:
			return fail('wrong-step');
	}
}

/**
 * Take back what you just did, while nobody has yet answered it: your
 * initiative card before the count starts, or the cards of your turn until
 * anyone has answered minor actions. Never past a reveal — once other people
 * have seen a card, it has been played.
 */
export function takeBack(table: CardTable, holder: string): StepResult {
	const hand = handOf(table, holder);
	if (!hand) return fail('no-such-holder');

	if (inStep(table, 'initiative')) {
		const slot = zoneOf(table, holder, 'initiative');
		if ((table.zones[slot]?.cards.length ?? 0) === 0) return fail('nothing-to-take-back');
		const back = moveCard(table, { zone: slot }, hand);
		return back.ok ? ok(back.table) : fail(back.reason);
	}

	const open =
		inStep(table, 'turn') || (inStep(table, 'minor') && table.round.answered.length === 0);
	if (!open || !table.round.acted.includes(holder)) return fail('nothing-to-take-back');
	const played = zoneOf(table, holder, 'played');
	const mine = Object.entries(table.plays)
		.filter(([, p]) => p.by === holder && p.kind === 'turn' && p.number === table.round.count)
		.map(([card]) => card)
		.filter((card) => table.zones[played]?.cards.includes(card));
	if (mine.length === 0) return fail('nothing-to-take-back');

	let current = table;
	const plays = { ...table.plays };
	for (const card of mine) {
		const back = moveCard(current, { zone: played, card }, hand);
		if (!back.ok) return fail(back.reason);
		current = back.table;
		delete plays[card];
	}
	const playedHere = Object.values(plays).some(
		(p) => p.kind === 'turn' && p.number === table.round.count
	);
	return ok(
		withRound(
			{ ...current, plays },
			{
				step: 'turn',
				answered: [],
				playedHere,
				acted: table.round.acted.filter((h) => h !== holder)
			}
		)
	);
}

/** Give up a readied card without using it — "If you no longer want to take the facedown action, discard the card." */
export function dropReadied(table: CardTable, holder: string): StepResult {
	if (!facedownZoneOf(table, holder)) return fail('no-such-holder');
	return ok(clearFacedown(table, holder));
}

export { initiativeHolder };
