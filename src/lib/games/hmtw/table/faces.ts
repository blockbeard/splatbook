/**
 * Turning a card id into something you can draw.
 *
 * The projection hands a client card *ids* — `swords-ace`, `magician` — because
 * an id is all the engine deals in. Everything a card looks like comes from the
 * pack, so this is the one place the two meet.
 *
 * Pure, and takes the pack as an argument, so it can be built once per page and
 * shared rather than threaded through every component.
 */

export interface CardFace {
	id: string;
	/** The whole name, for a screen reader: "Ace of Cups". */
	name: string;
	/** What is printed: "Ace", "VII", "King", or a major's numeral. */
	rank: string;
	/** Served path to the suit glyph. Absent for a major, which has no suit. */
	glyph?: string;
	value: number;
	/** Majors of 15 and over. The GM's mulligan judgement reads off this. */
	greaterDoom: boolean;
}

interface DeckPack {
	suits: { id: string; name: string; glyph: string }[];
	ranks: { id: string; name: string; value: number }[];
	minors: { id: string; suit: string; rank: string; value: number; name: string }[];
	majors: { id: string; name: string; numeral: string; value: number }[];
	doomTiers: { id: string; min: number; max: number }[];
}

export type FaceIndex = Readonly<Record<string, CardFace>>;

/** Build the lookup. `packBase` is where the pack's art is served from. */
export function buildFaces(deck: DeckPack, packBase = '/content-packs/hmtw'): FaceIndex {
	const glyphOf = new Map(deck.suits.map((s) => [s.id, `${packBase}/${s.glyph}`]));
	const rankOf = new Map(deck.ranks.map((r) => [r.id, r.name]));
	const greater = deck.doomTiers.find((t) => t.id === 'greater');

	const faces: Record<string, CardFace> = {};

	for (const card of deck.minors) {
		faces[card.id] = {
			id: card.id,
			name: card.name,
			rank: rankOf.get(card.rank) ?? card.rank,
			glyph: glyphOf.get(card.suit),
			value: card.value,
			greaterDoom: false
		};
	}

	for (const major of deck.majors) {
		faces[major.id] = {
			id: major.id,
			name: major.name,
			// A major is known by its numeral at the table — "the Star [XVII]" —
			// and the numeral is what the GM counts initiative by.
			rank: major.numeral,
			value: major.value,
			greaterDoom: greater ? major.value >= greater.min && major.value <= greater.max : false
		};
	}

	return faces;
}
