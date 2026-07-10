import { describe, expect, it } from 'vitest';
import { clampIndex, isFirst, isLast, nextIndex, prevIndex, progress } from './navigation';

describe('clampIndex', () => {
	it('keeps an index inside [0, count-1]', () => {
		expect(clampIndex(-2, 4)).toBe(0);
		expect(clampIndex(2, 4)).toBe(2);
		expect(clampIndex(9, 4)).toBe(3);
	});

	it('pins to 0 for an empty wizard and truncates fractions', () => {
		expect(clampIndex(3, 0)).toBe(0);
		expect(clampIndex(1.9, 4)).toBe(1);
	});
});

describe('nextIndex / prevIndex', () => {
	it('advance and retreat without leaving the ends', () => {
		expect(nextIndex(0, 3)).toBe(1);
		expect(nextIndex(2, 3)).toBe(2); // clamped at last
		expect(prevIndex(2, 3)).toBe(1);
		expect(prevIndex(0, 3)).toBe(0); // clamped at first
	});
});

describe('isFirst / isLast', () => {
	it('detect the ends', () => {
		expect(isFirst(0)).toBe(true);
		expect(isFirst(1)).toBe(false);
		expect(isLast(2, 3)).toBe(true);
		expect(isLast(1, 3)).toBe(false);
		expect(isLast(0, 0)).toBe(false); // empty wizard has no last step
	});
});

describe('progress', () => {
	it('is (index+1)/count, 0 when empty', () => {
		expect(progress(0, 4)).toBe(0.25);
		expect(progress(3, 4)).toBe(1);
		expect(progress(0, 0)).toBe(0);
	});

	it('clamps an out-of-range index before computing', () => {
		expect(progress(99, 4)).toBe(1);
		expect(progress(-5, 4)).toBe(0.25);
	});
});
