/**
 * A moment's grace after a button changes what it does.
 *
 * Session 14 (phase 33): the GM pressed Next, the round stayed on 1 for the
 * second player there, and the button in the same place became "Skip their
 * turn". The GM pressed again to see what would happen, and the second player
 * lost their turn. A press that lands just after the button's meaning changed
 * was aimed at the old one, so for a moment it does nothing.
 */
export const HOLD_MS = 800;

/** What a button does, as far as a press is concerned: which step, which number, which words. */
export const actionKey = (step: string, count: number | null, label: string | undefined) =>
	label === undefined ? null : `${step}:${count ?? '-'}:${label}`;

/**
 * Whether to hold the button: only when it changed from one action to
 * another. Not when it first appears on the page, or comes back after a step
 * with no button, since there was nothing there to be pressing at.
 */
export const shouldHold = (previous: string | null, next: string | null): boolean =>
	previous !== null && next !== null && previous !== next;
