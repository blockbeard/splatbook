/**
 * Saying what just happened, for somebody who cannot see it happen.
 *
 * A card table is almost entirely a visual object, and everything on it moves
 * because *somebody else* moved it. A sighted player catches that from the
 * corner of their eye; without it you are sitting at a table that silently
 * rearranges itself, and the one thing you most need — that the count has
 * reached your initiative — is exactly the thing nothing announces.
 *
 * The event log already carries what changed, and it is public by contract:
 * zone ids and counts, never a card. So an announcement built from it can say
 * everything it knows without a leak being possible, which is the reason this
 * reads the log rather than diffing the projection.
 *
 * One sentence per event, in the table's own words. Events that change nothing
 * a player would notice return nothing, because a live region that narrates
 * bookkeeping is worse than one that stays quiet.
 */

export interface TableEvent {
	version: number;
	kind: string;
	data: unknown;
}

/** Who a seat id belongs to, as the table shows it. */
export type NameOf = (seatId: string | null | undefined) => string;

/**
 * Who is listening, and who is up on the table as it now stands — so the
 * count can say "your turn" to the one person it is true for, and to nobody
 * else.
 */
export interface Listener {
	viewer: string | null;
	upNow: readonly string[];
	/**
	 * The enemies as this viewer is sent them. While Health is hidden the log
	 * carries no numbers, so the GM — whose view still has them — hears them
	 * from here instead.
	 */
	opponents?: readonly {
		creatures: readonly {
			id: string;
			pools: readonly { health: number; healthMax: number; defense: number; defenseMax: number }[];
		}[];
	}[];
}

const deckName = (deck: unknown): string => (deck === 'gm' ? 'GM' : 'player');

/** "A", "A and B", "A, B and C". */
const listOf = (names: string[]): string =>
	names.length <= 1
		? (names[0] ?? '')
		: `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** The seat a `seat:<id>:<kind>` zone belongs to, or nothing. */
const seatOfZone = (zone: string): string | null => {
	const parts = zone.split(':');
	return parts[0] === 'seat' && parts.length === 3 ? parts[1] : null;
};

const zoneKind = (zone: string): string => zone.split(':').pop() ?? '';

/**
 * A move, in the terms the table uses for it.
 *
 * Deliberately not "from zone A to zone B": the zone ids are an implementation
 * detail and reading them aloud would be worse than silence. What matters is
 * which of the half-dozen things that happen at a card table this was.
 */
function announceMove(data: { from: string; to: string; seat?: string | null }, nameOf: NameOf) {
	const who = nameOf(data.seat);
	const from = zoneKind(data.from);
	const to = zoneKind(data.to);
	const toSeat = seatOfZone(data.to);

	if (to === 'played') return `${who} played a card.`;
	// An enemy's initiative belongs to no seat, so it is credited to whoever
	// placed it — the GM. Asking `nameOf` for a null id would have answered
	// "Someone", which is both true and useless.
	if (to === 'initiative') return `${toSeat ? nameOf(toSeat) : who} placed an initiative card.`;
	if (to === 'durable') return `${who} took an inspiration card.`;
	if (to === 'fate') return `${who} turned a card over for a Test of Fate.`;
	if (data.to.startsWith('discard:')) {
		const deck = data.to.endsWith(':gm') ? 'GM' : 'player';
		return from === 'hand' ? `${who} discarded a card.` : `A card went to the ${deck} discard.`;
	}
	if (to === 'hand') return `${who} took a card into hand.`;
	if (data.to.startsWith('deck:'))
		return `${who} put a card back on the ${deckName(data.to.split(':')[1])} deck.`;
	return `${who} moved a card.`;
}

/**
 * Add where the round got to, when an event moved it: the count jumping, minor
 * actions opening or turning over, the round ending.
 */
function withRound(
	said: string,
	d: Record<string, unknown>,
	listener: Listener | undefined,
	latest: boolean
): string {
	if (typeof d.step !== 'string') return said;
	const step =
		d.step === 'turn'
			? latest && listener?.viewer && listener.upNow.includes(listener.viewer)
				? `Initiative ${d.count}. Your turn.`
				: `Initiative ${d.count}.`
			: d.step === 'minor'
				? 'Any minor actions?'
				: d.step === 'resolve'
					? 'Everything is face up.'
					: d.step === 'over'
						? 'Everyone has had a turn.'
						: '';
	return [said, step].filter(Boolean).join(' ');
}

/**
 * What to say about one event, or nothing if it is not worth saying.
 *
 * `nameOf` resolves a seat id to the name the table shows; it should answer
 * something usable for an id it does not know, since a seat can leave between
 * an event landing and its being read.
 */
export function describe(
	event: TableEvent,
	nameOf: NameOf,
	listener?: Listener,
	/** Whether this is the newest event, about the table as it now stands. */
	latest = true
): string | null {
	const d = (event.data ?? {}) as Record<string, unknown>;
	switch (event.kind) {
		case 'move': {
			if (typeof d.from !== 'string' || typeof d.to !== 'string') return null;
			const said = announceMove({ from: d.from, to: d.to, seat: d.seat as string | null }, nameOf);
			return d.reshuffled
				? `The ${deckName(d.from.split(':')[1])} deck was empty, so its discard was shuffled back in. ${said}`
				: said;
		}
		case 'begin-round':
			return `Round ${d.round} dealt. Players draw ${d.playerHand}, the GM draws ${d.gmHand}.`;
		case 'end-round':
			return d.shuffled
				? `Round ${d.round} ended. The Fool came out, so both decks were shuffled.`
				: `Round ${d.round} ended.`;
		// The round's steps (phase 32). Each says who did what; when the round
		// moved because of it, where it got to — "Initiative 7. Your turn." to
		// the one person it is true for.
		case 'play-initiative':
			return withRound(`${nameOf(d.holder as string)} played initiative.`, d, listener, latest);
		case 'start-count':
		case 'step-on':
			return withRound('', d, listener, latest) || null;
		case 'play-turn': {
			const who = nameOf(d.holder as string);
			const at =
				typeof d.target === 'string'
					? ` at ${nameOf(d.target)}`
					: typeof d.targetLabel === 'string'
						? ` at ${d.targetLabel}`
						: '';
			const what =
				d.mode === 'ready'
					? `${who} readied ${d.action}.`
					: d.mode === 'guard'
						? `${who} Guards: a new initiative.`
						: `${who}: ${d.action}${at}.`;
			return withRound(what, d, listener, latest);
		}
		case 'skip-turn':
			return withRound(`${nameOf(d.holder as string)} skipped their turn.`, d, listener, latest);
		case 'play-out-of-turn': {
			const at =
				typeof d.target === 'string'
					? ` at ${nameOf(d.target)}`
					: typeof d.targetLabel === 'string'
						? ` at ${d.targetLabel}`
						: '';
			return `Out of turn, ${nameOf(d.holder as string)}: ${d.action}${at}.`;
		}
		case 'show-initiative':
			return `${nameOf(d.holder as string)} showed their initiative.`;
		case 'declare-minor':
			return withRound(
				`${nameOf(d.holder as string)} put down a minor action: ${d.label}${
					typeof d.target === 'string'
						? ` at ${nameOf(d.target)}`
						: typeof d.targetLabel === 'string'
							? ` at ${d.targetLabel}`
							: ''
				}.`,
				d,
				listener,
				latest
			);
		case 'ready-minor':
			return withRound(`${nameOf(d.holder as string)} readied ${d.label}.`, d, listener, latest);
		case 'pass-minor': {
			const holders = Array.isArray(d.holders) ? (d.holders as string[]) : [];
			return withRound(`${listOf(holders.map((h) => nameOf(h)))} passed.`, d, listener, latest);
		}
		case 'take-back':
			return `${nameOf(d.holder as string)} took it back.`;
		case 'use-readied':
			return `${nameOf(d.holder as string)} used ${typeof d.label === 'string' ? d.label : 'a readied card'}.`;
		case 'drop-readied':
			return `${nameOf(d.holder as string)} gave up a readied card.`;
		case 'mulligan':
			return 'The GM took a new hand.';
		case 'reshuffle':
			return `The ${deckName(d.deck)} deck was shuffled.`;
		case 'reset-table':
			return 'The table was reset.';
		case 'set-mode':
			return d.mode === 'challenge' ? 'The Challenge has begun.' : 'Back to the decks.';
		case 'add-opponent':
			return `${d.name} joined the fight.`;
		case 'remove-opponent':
			return 'An enemy left the fight.';
		case 'clear-fate':
			return 'The Test of Fate was cleared.';
		case 'set-scene-zones': {
			const zones = Array.isArray(d.zones) ? (d.zones as string[]) : [];
			return zones.length ? `The zones are ${listOf(zones)}.` : 'The scene has no zones.';
		}
		case 'clear-scene':
			return 'A new scene. The zones were cleared.';
		case 'set-scene-picture':
			return 'The GM put up a picture of the scene.';
		case 'clear-scene-picture':
			return 'The picture of the scene was taken down.';
		case 'place': {
			const who = typeof d.label === 'string' ? d.label : nameOf(d.seat as string);
			return typeof d.zone === 'string' ? `${who} moves to ${d.zone}.` : `${who} is not placed.`;
		}
		case 'add-creatures': {
			const labels = Array.isArray(d.labels) ? (d.labels as string[]) : [];
			return labels.length ? `${listOf(labels)} joined the fight.` : null;
		}
		case 'remove-creature':
			return `${d.label} was taken off the table.`;
		case 'set-hd': {
			// The latest only, so a run of clicks reads out once, as where it ended.
			const stat = d.stat === 'defense' ? 'Defense' : 'Health';
			if (typeof d.value === 'number') {
				return `${d.label}: ${stat} ${d.value}${typeof d.max === 'number' ? ` of ${d.max}` : ''}.`;
			}
			// Logged while Health was hidden: numbers only for a view that has them.
			const pool = listener?.opponents?.flatMap((o) => o.creatures).find((c) => c.id === d.creature)
				?.pools[0];
			if (!pool) return `${d.label}: ${stat} changed.`;
			const [value, max] =
				d.stat === 'defense' ? [pool.defense, pool.defenseMax] : [pool.health, pool.healthMax];
			return `${d.label}: ${stat} ${value} of ${max}.`;
		}
		case 'enemy-health':
			return d.shown ? 'Players can see enemy Health.' : 'Enemy Health is hidden from players.';
		case 'set-down':
			return d.down ? `${d.label} is down.` : `${d.label} is back up.`;
		// Bookkeeping nobody would notice happening: an enemy renamed, a
		// facedown slot cleared behind a reveal. Silence is the right answer.
		default:
			return null;
	}
}

/**
 * What to put in the live region for a batch of new events.
 *
 * A poll can bring several at once, and reading all of them would talk over
 * the player for as long as the table is busy. The last one that has anything
 * to say wins — it is the state the table is in now, which is what somebody
 * catching up actually needs.
 */
export function announce(events: TableEvent[], nameOf: NameOf, listener?: Listener): string | null {
	for (let i = events.length - 1; i >= 0; i--) {
		// Only the newest event is about the table as it now stands, so only it
		// may say "your turn".
		const said = describe(events[i], nameOf, listener, i === events.length - 1);
		if (said) return said;
	}
	return null;
}
