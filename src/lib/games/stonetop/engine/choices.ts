/**
 * Nested "choose N of these" picks — the shared logic behind backgrounds,
 * possessions, and extras (the pack's `subChoiceSchema`). Pure and unit-tested;
 * the UI (`ChoiceGroup.svelte`) renders against these rules and the per-step
 * validators reuse them.
 *
 * A selection records the option labels the player toggled plus an optional
 * free-text write-in. A non-empty write-in counts as one pick (the pack's
 * `writeIn: true` option), so it is never also listed in `selected`.
 */

import type { ChoiceSelection } from './character';

/** The slice of a pack sub-choice these helpers need. */
export interface ChoiceLike {
	min: number;
	max: number;
}

/** Total picks in a selection: toggled options plus a non-empty write-in. */
export function selectionCount(selection: ChoiceSelection | undefined): number {
	if (!selection) return 0;
	const writeIn = selection.writeIn?.trim() ? 1 : 0;
	return selection.selected.length + writeIn;
}

/** Whether a selection satisfies the choice's `[min, max]`. */
export function isSelectionValid(
	choice: ChoiceLike,
	selection: ChoiceSelection | undefined
): boolean {
	const n = selectionCount(selection);
	return n >= choice.min && n <= choice.max;
}

/** Whether one more pick is allowed (used to gate/disable further toggles). */
export function canPickMore(choice: ChoiceLike, selection: ChoiceSelection | undefined): boolean {
	return selectionCount(selection) < choice.max;
}

/**
 * Toggle an option label in a selection, respecting `max`. Pure — returns a new
 * selection. Removing is always allowed; adding past `max` is a no-op.
 */
export function toggleOption(
	choice: ChoiceLike,
	selection: ChoiceSelection | undefined,
	label: string
): ChoiceSelection {
	const current = selection ?? { selected: [] };
	if (current.selected.includes(label)) {
		return { ...current, selected: current.selected.filter((l) => l !== label) };
	}
	if (!canPickMore(choice, current)) return current;
	return { ...current, selected: [...current.selected, label] };
}
