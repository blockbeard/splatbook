/**
 * What a card's total is made of, in the table's words (phase 33).
 *
 * The book is exact: a turn's total is "the card's face value _plus_ the
 * associated attribute", a minor action's is "the card's face value", and a
 * face-down card goes by where it was put down. The table adds nothing; it
 * says which kind each card is, so nobody has to remember.
 */

import type { FacedownPosition } from '../engine/exceptions';

/** "+ attribute", "face value", or nothing for a play stored before v17. */
export function addsWords(adds: boolean | undefined): string | null {
	if (adds === undefined) return null;
	return adds ? '+ attribute' : 'face value';
}

/** A readied card's total when it turns over: above the initiative adds it, below doesn't. */
export const readiedAdds = (position: FacedownPosition): boolean => position === 'turn';
