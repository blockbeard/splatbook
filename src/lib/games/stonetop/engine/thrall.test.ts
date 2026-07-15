import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import {
	attachThrall,
	hasThrallInsert,
	setThrallFavor,
	thrallStateOf,
	THRALL_INSERT_ID,
	toggleThrallMark,
	updateThrall
} from './thrall';

describe('attachThrall', () => {
	it('attaches blank', () => {
		const c = attachThrall(createCharacter(null));
		expect(hasThrallInsert(c)).toBe(true);
		expect(thrallStateOf(c)).toEqual({
			masterName: '',
			impulse: '',
			instinctId: null,
			favor: 0,
			marks: []
		});
	});

	it('is idempotent', () => {
		let c = attachThrall(createCharacter(null));
		c = updateThrall(c, { masterName: 'The Crawling Dark' });
		c = attachThrall(c);
		expect(thrallStateOf(c).masterName).toBe('The Crawling Dark');
	});
});

describe('hasThrallInsert / thrallStateOf', () => {
	it('is false and blank before attaching', () => {
		const c = createCharacter(null);
		expect(hasThrallInsert(c)).toBe(false);
		expect(thrallStateOf(c).marks).toEqual([]);
	});
});

describe('updateThrall', () => {
	it('patches master/impulse/instinct', () => {
		const c = updateThrall(attachThrall(createCharacter(null)), {
			masterName: 'The Crawling Dark',
			impulse: 'Inflict harm, cruelly and unnecessarily',
			instinctId: 'shame'
		});
		const state = thrallStateOf(c);
		expect(state.masterName).toBe('The Crawling Dark');
		expect(state.impulse).toBe('Inflict harm, cruelly and unnecessarily');
		expect(state.instinctId).toBe('shame');
	});
});

describe('setThrallFavor', () => {
	it('clamps to [0, 3]', () => {
		const c = attachThrall(createCharacter(null));
		expect(thrallStateOf(setThrallFavor(c, -1)).favor).toBe(0);
		expect(thrallStateOf(setThrallFavor(c, 5)).favor).toBe(3);
		expect(thrallStateOf(setThrallFavor(c, 2)).favor).toBe(2);
	});
});

describe('toggleThrallMark', () => {
	it('adds then removes a mark', () => {
		let c = attachThrall(createCharacter(null));
		c = toggleThrallMark(c, 'ravenous');
		expect(thrallStateOf(c).marks).toEqual(['ravenous']);
		c = toggleThrallMark(c, 'ravenous');
		expect(thrallStateOf(c).marks).toEqual([]);
	});

	it('supports multiple marks', () => {
		let c = attachThrall(createCharacter(null));
		c = toggleThrallMark(c, 'ravenous');
		c = toggleThrallMark(c, 'red-wrath');
		expect(thrallStateOf(c).marks.sort()).toEqual(['ravenous', 'red-wrath']);
	});
});

it('stores state under the documented insert id', () => {
	const c = attachThrall(createCharacter(null));
	expect(c.inserts[THRALL_INSERT_ID]).toBeDefined();
});
