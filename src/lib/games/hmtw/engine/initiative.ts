/**
 * Initiative cards, read off the table: whose slot is whose, and who has one
 * down at what value. Shared by the projection and the round's steps.
 */

import type { CardTable } from './table';
import { opponentZone, seatZone } from './zones';

/** The seat or group whose initiative slot this is, or null for any other zone. */
export function initiativeHolder(zoneId: string): string | null {
	const match = /^(?:seat|opponent):(.+):initiative$/.exec(zoneId);
	return match ? match[1] : null;
}

/** Every seat and group with an initiative card down, and its value. */
export function holdersWithInitiative(table: CardTable): [string, number][] {
	const found: [string, number][] = [];
	for (const slot of initiativeSlots(table)) {
		const card = table.zones[slot]?.cards[0];
		const holder = initiativeHolder(slot);
		if (card !== undefined && holder !== null) found.push([holder, table.valueOf[card] ?? 0]);
	}
	return found;
}

export function initiativeSlots(table: CardTable): string[] {
	return [
		...table.seats.map((s) => seatZone(s, 'initiative')),
		...table.opponents.map((o) => opponentZone(o.id, 'initiative'))
	];
}
