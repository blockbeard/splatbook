/**
 * Steading Improvement requirement logic — the pure rules behind the
 * Improvements list (phase 6, commit 45). An Improvement in the pack carries a
 * `requires` tree built from a handful of printed combinators (`all`, `either`
 * /`orAll`, `pick` N of `options`, `andEstablish` a nested pick, `andThen`
 * follow-ups, and the Well-Trained Militia's `perTactic`/`tactics`). This module
 * normalises that tree into an ordered list of **requirement groups** the editor
 * renders as checklists, and decides when an Improvement's requirements are met.
 *
 * Design note: the tracker records what the players have *done*; it never
 * silently mutates stats. "Requirements met" enables the Mark-complete action;
 * applying an Improvement's effects (a Fortunes bump, a new Resource) is done by
 * hand on the tracker, matching how the printed sheet works. Pure functions
 * only — no UI/DB/SvelteKit imports.
 */

import type { RequirementEntry, SteadingRequires } from '../pack-schemas';
import type { ImprovementState, StonetopSteading } from './steading';

/** One tickable requirement: a stable `key`, its printed `label`, and — for a
 * multi-box "Pull Together" requirement — how many ◇ it needs. */
export interface RequirementSlot {
	key: string;
	label: string;
	boxes?: number;
}

/**
 * A group of requirement slots with a satisfaction rule:
 * - `all` — every slot must be satisfied.
 * - `pick` — at least `pick` slots satisfied (choose N of options / establish M).
 * - `either` — any one slot satisfied, **or** every slot in `orAll` satisfied.
 * - `each` — the open-ended tactic list: satisfied once at least one is ticked
 *   (each further tactic just adds effect; it's never *required*).
 */
export interface RequirementGroup {
	kind: 'all' | 'pick' | 'either' | 'each';
	/** Heading for the group, e.g. "And then", "Establish", "Train tactics". */
	label?: string;
	slots: RequirementSlot[];
	/** For `kind: 'pick'`: how many slots must be satisfied. */
	pick?: number;
	/** For `kind: 'either'`: the alternative "…or all of these" slots. */
	orAll?: RequirementSlot[];
}

const entryLabel = (e: RequirementEntry): string => (typeof e === 'string' ? e : e.text);
const entryBoxes = (e: RequirementEntry): number | undefined =>
	typeof e === 'string' ? undefined : e.boxes;

/** Build a slot for one entry under a group key prefix + index. */
function slot(prefix: string, i: number, e: RequirementEntry): RequirementSlot {
	const s: RequirementSlot = { key: `${prefix}-${i}`, label: entryLabel(e) };
	const boxes = entryBoxes(e);
	if (boxes) s.boxes = boxes;
	return s;
}

const slots = (prefix: string, entries: RequirementEntry[] | undefined): RequirementSlot[] =>
	(entries ?? []).map((e, i) => slot(prefix, i, e));

/**
 * Normalise a `requires` tree into ordered groups for rendering. Group keys are
 * stable per role (`all`, `either`, `pick`, `establish`, `then`, `tactic`), so a
 * saved `ImprovementState` keeps meaning as long as the pack's entry order holds.
 */
export function requirementGroups(requires: SteadingRequires): RequirementGroup[] {
	const groups: RequirementGroup[] = [];

	// Primary group: exactly one of all / either(+orAll) / pick.
	if (requires.all) {
		groups.push({ kind: 'all', slots: slots('all', requires.all) });
	} else if (requires.either) {
		const g: RequirementGroup = { kind: 'either', slots: slots('either', requires.either) };
		if (requires.orAll) g.orAll = slots('orall', requires.orAll);
		groups.push(g);
	} else if (requires.pick && requires.options) {
		groups.push({ kind: 'pick', pick: requires.pick, slots: slots('pick', requires.options) });
	}

	// A nested "establish" pick (Expanded Trades).
	if (requires.andEstablish) {
		groups.push({
			kind: 'pick',
			label: 'Establish',
			pick: requires.andEstablish.pick,
			slots: slots('establish', requires.andEstablish.options)
		});
	}

	// Sequenced follow-ups, all required (Inn, Market, Weapons of War…).
	if (requires.andThen) {
		groups.push({ kind: 'all', label: 'And then', slots: slots('then', requires.andThen) });
	}

	// Well-Trained Militia: an open-ended list of tactics, each its own Pull Together.
	if (requires.tactics) {
		groups.push({ kind: 'each', label: 'Train tactics', slots: slots('tactic', requires.tactics) });
	}

	return groups;
}

/** Whether a single slot counts as satisfied given the saved state. */
export function slotSatisfied(state: ImprovementState, s: RequirementSlot): boolean {
	if (s.boxes) return (state.boxes[s.key] ?? 0) >= s.boxes;
	return state.checked.includes(s.key);
}

/** Whether a whole group is satisfied. */
export function groupSatisfied(state: ImprovementState, group: RequirementGroup): boolean {
	const done = (s: RequirementSlot) => slotSatisfied(state, s);
	switch (group.kind) {
		case 'all':
			return group.slots.every(done);
		case 'pick':
			return group.slots.filter(done).length >= (group.pick ?? 1);
		case 'either':
			return group.slots.some(done) || (!!group.orAll && group.orAll.every(done));
		case 'each':
			return group.slots.some(done);
	}
}

/** Whether every requirement group of an Improvement is satisfied. */
export function requirementsMet(requires: SteadingRequires, state: ImprovementState): boolean {
	return requirementGroups(requires).every((g) => groupSatisfied(state, g));
}

/** Every slot key an Improvement's requirements define (both plain and box slots). */
export function allSlots(requires: SteadingRequires): RequirementSlot[] {
	return requirementGroups(requires).flatMap((g) => [...g.slots, ...(g.orAll ?? [])]);
}

const emptyState = (): ImprovementState => ({ checked: [], boxes: {}, completed: false });

/** The saved progress for one Improvement, or a fresh empty state. */
export function improvementState(steading: StonetopSteading, id: string): ImprovementState {
	return steading.improvements[id] ?? emptyState();
}

/** A steading with one Improvement's state replaced. */
export function setImprovementState(
	steading: StonetopSteading,
	id: string,
	state: ImprovementState
): StonetopSteading {
	return { ...steading, improvements: { ...steading.improvements, [id]: state } };
}

/** Toggle a plain (non-box) requirement slot on/off. */
export function toggleRequirement(
	steading: StonetopSteading,
	id: string,
	slotKey: string
): StonetopSteading {
	const state = improvementState(steading, id);
	const checked = state.checked.includes(slotKey)
		? state.checked.filter((k) => k !== slotKey)
		: [...state.checked, slotKey];
	return setImprovementState(steading, id, { ...state, checked });
}

/** Set how many ◇ are filled on a multi-box requirement slot (clamped 0…max). */
export function setRequirementBoxes(
	steading: StonetopSteading,
	id: string,
	slotKey: string,
	filled: number,
	max: number
): StonetopSteading {
	const state = improvementState(steading, id);
	const value = Math.max(0, Math.min(max, filled));
	return setImprovementState(steading, id, {
		...state,
		boxes: { ...state.boxes, [slotKey]: value }
	});
}

/** Mark (or unmark) an Improvement complete — its effects have been taken. */
export function setImprovementCompleted(
	steading: StonetopSteading,
	id: string,
	completed: boolean
): StonetopSteading {
	return setImprovementState(steading, id, { ...improvementState(steading, id), completed });
}
