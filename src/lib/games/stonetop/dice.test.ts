import { describe, expect, it } from 'vitest';
import { isValidNotation, parseNotation } from '$lib/dice';
import { STAT_KEYS } from './engine';
import { stonetopDice } from './dice';

describe('stonetopDice presets', () => {
	it('offers a plain 2d6 plus one roll per stat', () => {
		expect(stonetopDice.presets).toHaveLength(1 + STAT_KEYS.length);
	});

	it('has unique preset ids', () => {
		const ids = stonetopDice.presets.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('every preset notation is valid dice notation', () => {
		for (const preset of stonetopDice.presets) {
			expect(isValidNotation(preset.notation), preset.id).toBe(true);
		}
	});

	it('rolls every move on 2d6', () => {
		for (const preset of stonetopDice.presets) {
			expect(parseNotation(preset.notation).terms).toEqual([{ count: 2, sides: 6 }]);
		}
	});

	it('tags each stat roll with its stat in meta, drawn from STAT_KEYS', () => {
		const statPresets = stonetopDice.presets.filter((p) => p.meta?.stat);
		expect(statPresets.map((p) => p.meta!.stat)).toEqual([...STAT_KEYS]);
		for (const preset of statPresets) {
			expect(preset.label).toBe(`Roll +${preset.meta!.stat}`);
		}
	});
});
