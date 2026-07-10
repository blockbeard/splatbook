import { describe, expect, it } from 'vitest';
import { createCharacter, type StonetopCharacter } from './character';
import type { InventoryInsert } from '../pack-schemas';
import {
	assignUndefinedGear,
	assignUndefinedSmall,
	carriedGear,
	gearLoad,
	gearSlots,
	loadBand,
	parseMarks,
	setUndefinedGear,
	setUndefinedSmall,
	toggleGear,
	toggleSmallItem
} from './inventory';

const insert = {
	id: 'insert-inventory',
	name: 'Inventory',
	type: 'insert',
	appliesTo: 'all',
	outfit: {
		text: '…',
		loads: [
			{ name: 'light load', tags: ['quick & quiet'], marks: 'up to 3' },
			{ name: 'normal load', marks: '4-6' },
			{ name: 'heavy load', tags: ['noisy'], marks: '7-9' }
		],
		undefinedSlots: 9,
		undefinedText: '…'
	},
	gear: [
		{ name: 'Bedroll', slots: 1 },
		{ name: 'Maul, iron', slots: 2 },
		{ name: 'Shield', slots: 2 }
	],
	smallItems: {
		text: '…',
		undefinedSlots: 6,
		undefinedText: '…',
		options: [{ name: 'Whetstone' }, { name: 'Chalk' }]
	}
} as unknown as InventoryInsert;

const fresh = (): StonetopCharacter => createCharacter('the-blessed');

describe('parseMarks', () => {
	it('reads the printed ranges', () => {
		expect(parseMarks('up to 3')).toEqual([0, 3]);
		expect(parseMarks('4-6')).toEqual([4, 6]);
		expect(parseMarks('7-9')).toEqual([7, 9]);
	});
});

describe('gear load and band', () => {
	it('sums carried slots plus undefined marks', () => {
		let c = fresh();
		c = toggleGear(c, 'Bedroll'); // 1
		c = toggleGear(c, 'Maul, iron'); // +2 = 3
		expect(gearLoad(c, insert)).toBe(3);
		c = setUndefinedGear(c, 2, insert); // +2 = 5
		expect(gearLoad(c, insert)).toBe(5);
	});

	it('maps a load total to its band', () => {
		expect(loadBand(3, insert)?.name).toBe('light load');
		expect(loadBand(5, insert)?.name).toBe('normal load');
		expect(loadBand(8, insert)?.name).toBe('heavy load');
		expect(loadBand(20, insert)).toBeNull();
	});

	it('reads an item’s slot cost', () => {
		expect(gearSlots(insert, 'Shield')).toBe(2);
		expect(gearSlots(insert, 'Nonexistent')).toBe(0);
	});
});

describe('toggling', () => {
	it('adds then removes gear and small items', () => {
		let c = toggleGear(fresh(), 'Bedroll');
		expect(c.inventory.gear).toEqual(['Bedroll']);
		c = toggleGear(c, 'Bedroll');
		expect(c.inventory.gear).toEqual([]);

		let s = toggleSmallItem(fresh(), 'Chalk');
		expect(s.inventory.smallItems).toEqual(['Chalk']);
		s = toggleSmallItem(s, 'Chalk');
		expect(s.inventory.smallItems).toEqual([]);
	});
});

describe('undefined pools clamp to the insert', () => {
	it('clamps gear and small marks', () => {
		expect(setUndefinedGear(fresh(), 99, insert).inventory.undefinedGear).toBe(9);
		expect(setUndefinedGear(fresh(), -5, insert).inventory.undefinedGear).toBe(0);
		expect(setUndefinedSmall(fresh(), 99, insert).inventory.undefinedSmall).toBe(6);
	});
});

describe('Have What You Need transfers', () => {
	it('assigns an undefined gear mark onto an item, spending its slots', () => {
		let c = setUndefinedGear(fresh(), 5, insert);
		c = assignUndefinedGear(c, insert, 'Maul, iron'); // costs 2
		expect(c.inventory.gear).toEqual(['Maul, iron']);
		expect(c.inventory.undefinedGear).toBe(3);
	});

	it('never drops the pool below zero and no-ops a duplicate', () => {
		let c = setUndefinedGear(fresh(), 1, insert);
		c = assignUndefinedGear(c, insert, 'Shield'); // costs 2, only 1 available
		expect(c.inventory.undefinedGear).toBe(0);
		const again = assignUndefinedGear(c, insert, 'Shield');
		expect(again).toBe(c); // already carried → unchanged reference
	});

	it('spends one small mark per small item assigned', () => {
		let c = setUndefinedSmall(fresh(), 2, insert);
		c = assignUndefinedSmall(c, 'Whetstone');
		expect(c.inventory.smallItems).toEqual(['Whetstone']);
		expect(c.inventory.undefinedSmall).toBe(1);
	});
});

describe('carriedGear', () => {
	it('resolves carried names to insert definitions in insert order', () => {
		let c = toggleGear(fresh(), 'Shield');
		c = toggleGear(c, 'Bedroll');
		expect(carriedGear(c, insert).map((g) => g.name)).toEqual(['Bedroll', 'Shield']);
	});
});
