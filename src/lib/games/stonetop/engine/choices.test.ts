import { describe, expect, it } from 'vitest';
import { canPickMore, isSelectionValid, selectionCount, toggleOption } from './choices';
import type { ChoiceSelection } from './character';

const choice = { min: 2, max: 3 };

describe('selectionCount', () => {
	it('counts toggled options', () => {
		expect(selectionCount(undefined)).toBe(0);
		expect(selectionCount({ selected: ['a', 'b'] })).toBe(2);
	});

	it('counts a non-empty write-in as one, ignores whitespace-only', () => {
		expect(selectionCount({ selected: ['a'], writeIn: 'Enfys' })).toBe(2);
		expect(selectionCount({ selected: ['a'], writeIn: '   ' })).toBe(1);
	});
});

describe('isSelectionValid', () => {
	it('holds within [min, max] inclusive', () => {
		expect(isSelectionValid(choice, { selected: ['a'] })).toBe(false);
		expect(isSelectionValid(choice, { selected: ['a', 'b'] })).toBe(true);
		expect(isSelectionValid(choice, { selected: ['a', 'b', 'c'] })).toBe(true);
		expect(isSelectionValid(choice, { selected: ['a', 'b', 'c', 'd'] })).toBe(false);
	});
});

describe('canPickMore', () => {
	it('is true until max is reached', () => {
		expect(canPickMore(choice, { selected: ['a', 'b'] })).toBe(true);
		expect(canPickMore(choice, { selected: ['a', 'b', 'c'] })).toBe(false);
	});
});

describe('toggleOption', () => {
	it('adds up to max then refuses further adds', () => {
		let sel: ChoiceSelection | undefined;
		sel = toggleOption(choice, sel, 'a');
		sel = toggleOption(choice, sel, 'b');
		sel = toggleOption(choice, sel, 'c');
		expect(sel.selected).toEqual(['a', 'b', 'c']);
		sel = toggleOption(choice, sel, 'd'); // over max — ignored
		expect(sel.selected).toEqual(['a', 'b', 'c']);
	});

	it('removes an already-selected option regardless of max', () => {
		const sel = toggleOption(choice, { selected: ['a', 'b', 'c'] }, 'b');
		expect(sel.selected).toEqual(['a', 'c']);
	});

	it('does not mutate the input selection', () => {
		const input = { selected: ['a'] };
		toggleOption(choice, input, 'b');
		expect(input.selected).toEqual(['a']);
	});
});
