/**
 * Creatures — the bodies inside an enemy group.
 *
 * A group (an `Opponent`) is what takes a turn: one initiative card, one played
 * pile, one facedown slot, because the mob rule has a group act together ("the
 * entire group takes the same action"). A creature is what stands somewhere and
 * gets hurt. Zombie A can be in the Arena while Zombie B climbs the Pillar
 * without either of them costing the GM another card.
 *
 * Each creature has a letter, kept for life. A creature that goes down keeps it,
 * crossed out, so "Zombie B" never names two zombies in one fight, and a
 * creature that is split into another group takes its letter with it. Letters
 * are handed out per *family* — every group descended from one "Add" — so a
 * split-off group adding reinforcements carries on from the family's last
 * letter instead of minting a second Zombie C.
 */

/**
 * One pool of Health and Defense. Most creatures have one; ch.7 tracks enemy
 * damage this way, and Appendix C gives a dungeon lord several, one per body
 * part, each attacked separately.
 */
export interface HdPool {
	/** Only worth naming when there is more than one ("Torso", "Arms"). */
	name?: string;
	health: number;
	healthMax: number;
	defense: number;
	defenseMax: number;
}

export interface Creature {
	/** Stable for the creature's life, including across a split. */
	id: string;
	letter: string;
	down: boolean;
	/** Empty when the GM is not tracking this creature's HD. */
	pools: HdPool[];
}

/** A–Z, then AA–ZZ. Fifty-two bodies in one family is already a swarm. */
export const MAX_CREATURES = 52;

/** Health and Defense above this are a typo, not a monster. */
export const MAX_HD = 99;

/** The letter for the nth creature of a family: 0 → A, 25 → Z, 26 → AA, 51 → ZZ. */
export function letterFor(index: number): string {
	if (index < 0 || index >= MAX_CREATURES) throw new RangeError(`no letter for ${index}`);
	const char = String.fromCharCode(65 + (index % 26));
	return index < 26 ? char : char + char;
}

/** The inverse of `letterFor`, or -1 for something that is not one of its letters. */
export function letterIndex(letter: string): number {
	if (!/^([A-Z])\1?$/.test(letter)) return -1;
	return letter.charCodeAt(0) - 65 + (letter.length === 2 ? 26 : 0);
}

/** A creature id that cannot collide with a seat's or another family's. */
export function creatureId(family: string, letter: string): string {
	return `${family}:${letter}`;
}

/** A pool at full strength, or no pool at all when neither number is given. */
export function freshPools(hd?: { health?: number; defense?: number }): HdPool[] {
	if (hd?.health === undefined && hd?.defense === undefined) return [];
	const health = clampHd(hd.health ?? 0);
	const defense = clampHd(hd.defense ?? 0);
	return [{ health, healthMax: health, defense, defenseMax: defense }];
}

export function clampHd(n: number): number {
	return Math.max(0, Math.min(MAX_HD, Math.floor(Number.isFinite(n) ? n : 0)));
}

/** Make `count` creatures for a family, starting at its `from`th letter. */
export function makeCreatures(
	family: string,
	from: number,
	count: number,
	hd?: { health?: number; defense?: number }
): Creature[] {
	const room = Math.max(0, MAX_CREATURES - from);
	return Array.from({ length: Math.min(count, room) }, (_, i) => {
		const letter = letterFor(from + i);
		return { id: creatureId(family, letter), letter, down: false, pools: freshPools(hd) };
	});
}

/** Bring a stored creature into shape. Returns null for one that cannot be read. */
export function migrateCreature(raw: Partial<Creature> | undefined): Creature | null {
	if (!raw || typeof raw.id !== 'string' || typeof raw.letter !== 'string') return null;
	const pools = (raw.pools ?? [])
		.filter((p): p is HdPool => typeof p === 'object' && p !== null)
		.map((p) => {
			const healthMax = clampHd(p.healthMax ?? p.health ?? 0);
			const defenseMax = clampHd(p.defenseMax ?? p.defense ?? 0);
			return {
				...(p.name ? { name: String(p.name) } : {}),
				health: Math.min(clampHd(p.health ?? 0), healthMax),
				healthMax,
				defense: Math.min(clampHd(p.defense ?? 0), defenseMax),
				defenseMax
			};
		});
	return { id: raw.id, letter: raw.letter, down: raw.down === true, pools };
}

/** The shape `creatureLabel` reads — an engine `Opponent` or a client's projection of one. */
interface LabelGroup {
	name: string;
	family: string;
	creatures: readonly { id: string; letter: string }[];
}

/**
 * What to call a creature out loud: "Zombie B", or just "King of Swords" when
 * its family has only ever had one member, because "King of Swords A" is a
 * letter nobody needs. Null for an id that names no creature.
 */
export function creatureLabel(groups: readonly LabelGroup[], id: string): string | null {
	for (const group of groups) {
		const creature = group.creatures.find((c) => c.id === id);
		if (!creature) continue;
		const family = groups
			.filter((g) => g.family === group.family)
			.reduce((n, g) => n + g.creatures.length, 0);
		return family > 1 ? `${group.name} ${creature.letter}` : group.name;
	}
	return null;
}
