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
	/** Which suit, for the rules. Absent for a major, which has none. */
	suit?: string;
	/** Served path to the suit glyph. Absent for a major. */
	glyph?: string;
	/**
	 * Served path to the card's picture, when the pack carries one.
	 *
	 * Absent when it does not, and the table draws the suit glyph instead —
	 * which is what it drew before there were any pictures, so a pack without
	 * art is a quieter table rather than a broken one.
	 */
	art?: string;
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
	art?: { plates: { dir: string; ext: string } };
}

export type FaceIndex = Readonly<Record<string, CardFace>>;

/** Build the lookup. `packBase` is where the pack's art is served from. */
export function buildFaces(deck: DeckPack, packBase = '/content-packs/hmtw'): FaceIndex {
	const glyphOf = new Map(deck.suits.map((s) => [s.id, `${packBase}/${s.glyph}`]));
	const rankOf = new Map(deck.ranks.map((r) => [r.id, r.name]));
	const greater = deck.doomTiers.find((t) => t.id === 'greater');
	const plates = deck.art?.plates;
	const artOf = (id: string) =>
		plates ? `${packBase}/${plates.dir}/${id}.${plates.ext}` : undefined;

	const faces: Record<string, CardFace> = {};

	for (const card of deck.minors) {
		faces[card.id] = {
			id: card.id,
			name: card.name,
			rank: rankOf.get(card.rank) ?? card.rank,
			suit: card.suit,
			glyph: glyphOf.get(card.suit),
			art: artOf(card.id),
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
			art: artOf(major.id),
			value: major.value,
			greaterDoom: greater ? major.value >= greater.min && major.value <= greater.max : false
		};
	}

	return faces;
}
