import { describe, expect, it } from 'vitest';
import type { GhostInsert } from '../pack-schemas';
import { createCharacter } from './character';
import {
	attachGhost,
	attachRevenant,
	attachUndeadInsert,
	GHOST_INSERT_ID,
	ghostStateOf,
	hasGhostInsert,
	hasRevenantInsert,
	hasUndeadInsert,
	REVENANT_INSERT_ID,
	revenantStateOf,
	setTerriblePurpose,
	setUndeadInstinct,
	toggleFinalConsequence,
	toggleUndeadConsequence,
	undeadStateOf
} from './undead';

const insert = {
	consequences: {
		list: [
			{ id: 'breakdown' },
			{ id: 'unstable', childOf: 'breakdown', requires: { consequences: ['breakdown'] } },
			{ id: 'disturbing' }
		]
	}
} as unknown as GhostInsert;

describe('attachGhost / attachRevenant', () => {
	it('attaches each under its own id, blank', () => {
		const c = attachGhost(createCharacter(null));
		expect(hasGhostInsert(c)).toBe(true);
		expect(hasRevenantInsert(c)).toBe(false);
		expect(ghostStateOf(c)).toEqual({
			instinctId: null,
			terriblePurposeId: null,
			consequences: [],
			finalMarked: false
		});
	});

	it('both can be attached independently', () => {
		let c = attachGhost(createCharacter(null));
		c = attachRevenant(c);
		expect(hasGhostInsert(c)).toBe(true);
		expect(hasRevenantInsert(c)).toBe(true);
		expect(revenantStateOf(c).consequences).toEqual([]);
	});
});

describe('hasUndeadInsert / undeadStateOf', () => {
	it('is false and blank before attaching', () => {
		const c = createCharacter(null);
		expect(hasUndeadInsert(c, GHOST_INSERT_ID)).toBe(false);
		expect(undeadStateOf(c, GHOST_INSERT_ID).consequences).toEqual([]);
	});
});

describe('setUndeadInstinct / setTerriblePurpose', () => {
	it('sets each independently per insert id', () => {
		let c = attachGhost(createCharacter(null));
		c = setUndeadInstinct(c, GHOST_INSERT_ID, 'denial');
		c = setTerriblePurpose(c, GHOST_INSERT_ID, 'longing');
		expect(ghostStateOf(c).instinctId).toBe('denial');
		expect(ghostStateOf(c).terriblePurposeId).toBe('longing');
	});
});

describe('toggleUndeadConsequence', () => {
	it('marks an ungated consequence', () => {
		let c = attachGhost(createCharacter(null));
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		expect(ghostStateOf(c).consequences).toEqual(['breakdown']);
	});

	it('unmarks a marked consequence', () => {
		let c = attachGhost(createCharacter(null));
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		expect(ghostStateOf(c).consequences).toEqual([]);
	});

	it('is a no-op marking a gated consequence before its prerequisite', () => {
		const before = attachGhost(createCharacter(null));
		const after = toggleUndeadConsequence(before, GHOST_INSERT_ID, insert, 'unstable');
		expect(after).toBe(before);
	});

	it('allows marking a gated consequence once its prerequisite is marked', () => {
		let c = attachGhost(createCharacter(null));
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'unstable');
		expect(ghostStateOf(c).consequences.sort()).toEqual(['breakdown', 'unstable']);
	});

	it('unmarking a prerequisite cascades to unmark what it gated', () => {
		let c = attachGhost(createCharacter(null));
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'unstable');
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		expect(ghostStateOf(c).consequences).toEqual([]);
	});

	it('does not disturb an unrelated consequence', () => {
		let c = attachGhost(createCharacter(null));
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'disturbing');
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		expect(ghostStateOf(c).consequences).toEqual(['disturbing']);
	});

	it('operates independently on Revenant state', () => {
		let c = attachGhost(createCharacter(null));
		c = attachRevenant(c);
		c = toggleUndeadConsequence(c, GHOST_INSERT_ID, insert, 'breakdown');
		expect(ghostStateOf(c).consequences).toEqual(['breakdown']);
		expect(revenantStateOf(c).consequences).toEqual([]);
	});
});

describe('toggleFinalConsequence', () => {
	it('marks then clears', () => {
		let c = attachGhost(createCharacter(null));
		c = toggleFinalConsequence(c, GHOST_INSERT_ID);
		expect(ghostStateOf(c).finalMarked).toBe(true);
		c = toggleFinalConsequence(c, GHOST_INSERT_ID);
		expect(ghostStateOf(c).finalMarked).toBe(false);
	});
});

it('attachUndeadInsert is idempotent', () => {
	let c = attachUndeadInsert(createCharacter(null), REVENANT_INSERT_ID);
	c = setUndeadInstinct(c, REVENANT_INSERT_ID, 'ennui');
	c = attachUndeadInsert(c, REVENANT_INSERT_ID);
	expect(undeadStateOf(c, REVENANT_INSERT_ID).instinctId).toBe('ennui');
});
