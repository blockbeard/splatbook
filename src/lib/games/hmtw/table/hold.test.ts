import { describe, expect, it } from 'vitest';
import { actionKey, shouldHold } from './hold';

describe('holding a button that just changed', () => {
	it('holds when Next becomes Skip on the same number (Session 14)', () => {
		const next = actionKey('resolve', 1, 'Next');
		const skip = actionKey('turn', 1, "Skip Tatyana's turn");
		expect(shouldHold(next, skip)).toBe(true);
	});

	it('holds when the count moves on under the same words', () => {
		expect(shouldHold(actionKey('resolve', 1, 'Next'), actionKey('resolve', 3, 'Next'))).toBe(true);
	});

	it('does not hold for a table update that changes nothing about the button', () => {
		const key = actionKey('turn', 4, "Skip Elric's turn");
		expect(shouldHold(key, key)).toBe(false);
	});

	it('does not hold a button that has only just appeared', () => {
		expect(shouldHold(null, actionKey('initiative', null, 'Start the count now'))).toBe(false);
		expect(shouldHold(actionKey('turn', 2, 'Skip'), null)).toBe(false);
	});
});
