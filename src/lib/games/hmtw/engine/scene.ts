/**
 * The scene — the book's zones, and who is standing in which.
 *
 * Ch.7 step 0: "The GM describes the encounter and demarcates the scene's
 * zones." A zone here is a *place* (the Nave, the King's Pillar), not a pile of
 * cards. The engine already spends the word `Zone` on piles, so this module
 * says `SceneZone` throughout and only the screen says "zone".
 *
 * Deliberately a record and not a map. Who is where is a fact the table keeps
 * so that nobody has to hold it in their head or scroll a whiteboard for it;
 * the engine does not measure distance, check adjacency, or rule on whether a
 * move was allowed. Moving is anyone's, the same as moving a card.
 */

import type { CardTable } from './table';

export interface SceneZone {
	id: string;
	name: string;
}

/**
 * The picture the GM put up for the scene. Only a reference: the bytes live in
 * the shell's own table, keyed to the card table and deleted with it, because
 * a table's state rides along in every poll and a picture must not.
 */
export interface ScenePicture {
	/** Changes on every upload, so a client fetches again exactly when it must. */
	id: string;
	mime: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface Scene {
	/** The zones the GM has named, in the order they named them. */
	zones: SceneZone[];
	picture: ScenePicture | null;
	/**
	 * Where each adventurer or creature stands, by scene-zone id. A key that is
	 * missing, or `null`, is "not placed" — the honest state of somebody nobody
	 * has put anywhere yet.
	 */
	at: Record<string, string | null>;
}

export function emptyScene(): Scene {
	return { zones: [], at: {}, picture: null };
}

/** At most this many zones in a scene, and this long a name. Generous; a guard, not a rule. */
export const MAX_SCENE_ZONES = 20;
export const MAX_SCENE_ZONE_NAME = 40;

/**
 * Replace the scene's zones with a new list.
 *
 * A zone that keeps its id keeps everybody standing in it, so renaming the Nave
 * moves nobody. A zone that is gone leaves whoever stood there unplaced rather
 * than guessing where they went — re-adding a zone of the same name later gives
 * it a new id and does not put them back, which is why the interface asks
 * before removing an occupied zone.
 *
 * Names are trimmed, blanks dropped, and duplicate ids collapse to the first.
 */
export function setSceneZones(table: CardTable, zones: readonly SceneZone[]): CardTable {
	const seen = new Set<string>();
	const kept: SceneZone[] = [];
	for (const zone of zones) {
		const name = zone.name.trim().slice(0, MAX_SCENE_ZONE_NAME);
		if (!zone.id || !name || seen.has(zone.id)) continue;
		seen.add(zone.id);
		kept.push({ id: zone.id, name });
		if (kept.length >= MAX_SCENE_ZONES) break;
	}
	const at = Object.fromEntries(
		Object.entries(table.scene.at).map(([who, zone]) => [who, zone && seen.has(zone) ? zone : null])
	);
	return { ...table, scene: { ...table.scene, zones: kept, at } };
}

/**
 * Everybody the scene may place: the adventurers' seats (not the GM's — the GM
 * is not standing in the room) and every creature.
 */
export function placeable(table: CardTable): Set<string> {
	const ids = new Set(table.seats.filter((s) => s !== table.gmSeat));
	for (const opponent of table.opponents) {
		for (const creature of opponent.creatures) ids.add(creature.id);
	}
	return ids;
}

/**
 * Put somebody in a zone, or take them out of every zone with `null`.
 *
 * Refuses only what has no meaning: somebody who is not at the table, or a zone
 * that does not exist. A creature that is down can still be moved, since where
 * the body lies is sometimes the point.
 */
export function placeInScene(table: CardTable, who: string, zone: string | null): CardTable {
	if (!placeable(table).has(who)) return table;
	if (zone !== null && !table.scene.zones.some((z) => z.id === zone)) return table;
	if ((table.scene.at[who] ?? null) === zone) return table;
	return { ...table, scene: { ...table.scene, at: { ...table.scene.at, [who]: zone } } };
}

/** Forget where these people stood, because they have left the table. */
export function forgetPlacements(table: CardTable, who: Iterable<string>): CardTable {
	const gone = new Set(who);
	if (![...gone].some((id) => id in table.scene.at)) return table;
	const at = Object.fromEntries(Object.entries(table.scene.at).filter(([id]) => !gone.has(id)));
	return { ...table, scene: { ...table.scene, at } };
}

/** Put up a picture for the scene, replacing any there was. */
export function setScenePicture(table: CardTable, picture: ScenePicture | null): CardTable {
	return { ...table, scene: { ...table.scene, picture } };
}

/**
 * A new scene: no zones, nobody placed, no picture. The GM's "New scene", and part of
 * Reset table. Leaving a Challenge does *not* do this — the King of Swords was
 * one fight across three sessions, with the guild going in and out of it.
 */
export function clearScene(table: CardTable): CardTable {
	return { ...table, scene: emptyScene() };
}

/**
 * Bring a stored scene into shape: missing becomes empty, and a placement that
 * names a zone the scene no longer has becomes unplaced.
 */
export function migrateScene(raw: Partial<Scene> | undefined): Scene {
	const zones = (raw?.zones ?? []).filter(
		(z): z is SceneZone => typeof z?.id === 'string' && typeof z?.name === 'string'
	);
	const ids = new Set(zones.map((z) => z.id));
	const at: Record<string, string | null> = {};
	for (const [who, zone] of Object.entries(raw?.at ?? {})) {
		at[who] = typeof zone === 'string' && ids.has(zone) ? zone : null;
	}
	const picture = raw?.picture;
	const mimes = ['image/png', 'image/jpeg', 'image/webp'];
	return {
		zones,
		at,
		// v11 → v12: a scene that predates pictures has none.
		picture:
			picture && typeof picture.id === 'string' && mimes.includes(picture.mime)
				? { id: picture.id, mime: picture.mime }
				: null
	};
}
