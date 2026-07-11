/**
 * Outfit / Inventory rules (Stonetop, Book I p.142), driven by
 * `insert-inventory.json`.
 *
 * When you *Outfit* you mark ◇ on specific gear (each item takes `slots` ◇) or
 * on "Undefined" — reserved marks you assign to real items later via *Have What
 * You Need*. Total marked ◇ put you in a load band (light ≤3 / normal 4–6 /
 * heavy 7–9), each with its own tags. Small items work the same way with their
 * own undefined pool.
 *
 * Pure functions over `character.inventory` plus the insert; no UI/DB imports.
 */

import type { Gear, InventoryInsert } from '../pack-schemas';
import type { InventoryState, StonetopCharacter } from './character';

/** A character's inventory state, tolerating an older blob without one. */
function inv(character: StonetopCharacter): InventoryState {
	return character.inventory ?? { gear: [], smallItems: [], undefinedGear: 0, undefinedSmall: 0 };
}

function withInventory(character: StonetopCharacter, next: InventoryState): StonetopCharacter {
	return { ...character, inventory: next };
}

/** The ◇ a gear item occupies (its `slots`), or 0 if not in the insert. */
export function gearSlots(insert: InventoryInsert, name: string): number {
	return insert.gear.find((g) => g.name === name)?.slots ?? 0;
}

/** Total ◇ marked: the slots of every carried gear item plus undefined marks. */
export function gearLoad(character: StonetopCharacter, insert: InventoryInsert): number {
	const state = inv(character);
	const carried = state.gear.reduce((sum, name) => sum + gearSlots(insert, name), 0);
	return carried + state.undefinedGear;
}

/** Parse a printed mark range ("up to 3", "4-6", "7-9") into `[min, max]`. */
export function parseMarks(marks: string): [number, number] {
	const nums = marks.match(/\d+/g)?.map(Number) ?? [];
	if (marks.includes('up to')) return [0, nums[0] ?? 0];
	if (nums.length >= 2) return [nums[0], nums[1]];
	return [nums[0] ?? 0, nums[0] ?? 0];
}

/** The load band a given ◇ total falls into (light/normal/heavy), or null. */
export function loadBand(
	load: number,
	insert: InventoryInsert
): InventoryInsert['outfit']['loads'][number] | null {
	for (const band of insert.outfit.loads) {
		const [min, max] = parseMarks(band.marks);
		if (load >= min && load <= max) return band;
	}
	return null;
}

/**
 * The most ◇ any band accounts for — the carrying cap. Read off the pack's own
 * bands (heavy tops out at 7-9, so 9) rather than hard-coded, so a pack that
 * prints different bands moves the cap with it.
 */
export function maxLoad(insert: InventoryInsert): number {
	return Math.max(...insert.outfit.loads.map((band) => parseMarks(band.marks)[1]));
}

/**
 * Carrying more than the heaviest band allows. Past the cap there is no band to
 * be in — you're over-encumbered and something has to go.
 */
export function isOverloaded(character: StonetopCharacter, insert: InventoryInsert): boolean {
	return gearLoad(character, insert) > maxLoad(insert);
}

/** Whether a gear item is currently carried. */
export function carryingGear(character: StonetopCharacter, name: string): boolean {
	return inv(character).gear.includes(name);
}

/** Toggle a gear item on/off the sheet. Pure. */
export function toggleGear(character: StonetopCharacter, name: string): StonetopCharacter {
	const state = inv(character);
	const gear = state.gear.includes(name)
		? state.gear.filter((g) => g !== name)
		: [...state.gear, name];
	return withInventory(character, { ...state, gear });
}

/** Whether a small item is currently carried. */
export function carryingSmall(character: StonetopCharacter, name: string): boolean {
	return inv(character).smallItems.includes(name);
}

/** Toggle a small item on/off the sheet. Pure. */
export function toggleSmallItem(character: StonetopCharacter, name: string): StonetopCharacter {
	const state = inv(character);
	const smallItems = state.smallItems.includes(name)
		? state.smallItems.filter((s) => s !== name)
		: [...state.smallItems, name];
	return withInventory(character, { ...state, smallItems });
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** Set the number of undefined ◇ marks, clamped to the insert's pool. */
export function setUndefinedGear(
	character: StonetopCharacter,
	n: number,
	insert: InventoryInsert
): StonetopCharacter {
	const state = inv(character);
	return withInventory(character, {
		...state,
		undefinedGear: clamp(n, 0, insert.outfit.undefinedSlots)
	});
}

/** Set the number of undefined small-item marks, clamped to the insert's pool. */
export function setUndefinedSmall(
	character: StonetopCharacter,
	n: number,
	insert: InventoryInsert
): StonetopCharacter {
	const state = inv(character);
	return withInventory(character, {
		...state,
		undefinedSmall: clamp(n, 0, insert.smallItems.undefinedSlots)
	});
}

/**
 * *Have What You Need*: assign undefined ◇ to a specific gear item — mark the
 * item and reduce the undefined pool by its slot count (floored at 0). A no-op
 * if the item is already carried.
 */
export function assignUndefinedGear(
	character: StonetopCharacter,
	insert: InventoryInsert,
	name: string
): StonetopCharacter {
	const state = inv(character);
	if (state.gear.includes(name)) return character;
	const cost = gearSlots(insert, name);
	return withInventory(character, {
		...state,
		gear: [...state.gear, name],
		undefinedGear: Math.max(0, state.undefinedGear - cost)
	});
}

/**
 * *Have What You Need* for small items: mark the item and spend one undefined
 * small mark (floored at 0). A no-op if the item is already carried.
 */
export function assignUndefinedSmall(
	character: StonetopCharacter,
	name: string
): StonetopCharacter {
	const state = inv(character);
	if (state.smallItems.includes(name)) return character;
	return withInventory(character, {
		...state,
		smallItems: [...state.smallItems, name],
		undefinedSmall: Math.max(0, state.undefinedSmall - 1)
	});
}

/** The carried gear items, resolved to their insert definitions (order = insert). */
export function carriedGear(character: StonetopCharacter, insert: InventoryInsert): Gear[] {
	const carried = new Set(inv(character).gear);
	return insert.gear.filter((g) => carried.has(g.name));
}
