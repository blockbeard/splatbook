/**
 * Wizard navigation — the pure state machine behind the progress bar and the
 * Back/Next buttons. No Svelte, no DOM: just index arithmetic over a step
 * count, so it is trivially unit-testable and the component stays a thin shell.
 */

/** Clamp a step index into `[0, count - 1]`; an empty wizard pins to 0. */
export function clampIndex(index: number, count: number): number {
	if (count <= 0) return 0;
	return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

/** The index after pressing Next (never past the last step). */
export function nextIndex(index: number, count: number): number {
	return clampIndex(index + 1, count);
}

/** The index after pressing Back (never before the first step). */
export function prevIndex(index: number, count: number): number {
	return clampIndex(index - 1, count);
}

/** On the first step? (Back is disabled.) */
export function isFirst(index: number): boolean {
	return index <= 0;
}

/** On the last step? (Next becomes Finish.) */
export function isLast(index: number, count: number): boolean {
	return count > 0 && index >= count - 1;
}

/**
 * Progress as a fraction in `[0, 1]` — how far through the wizard the current
 * step sits. Step 1 of 4 → 0.25, last step → 1. An empty wizard is 0.
 */
export function progress(index: number, count: number): number {
	if (count <= 0) return 0;
	return (clampIndex(index, count) + 1) / count;
}
