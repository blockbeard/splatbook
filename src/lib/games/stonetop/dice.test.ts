import { describe, expect, it } from 'vitest';
import { isValidNotation, parseNotation } from '$lib/dice';
import { STAT_KEYS, engine, setDebility } from './engine';
import { stonetopDice } from './dice';

const withStats = (stats: Partial<Record<string, number>>) => {
	const c = engine.createCharacter();
	for (const [stat, value] of Object.entries(stats)) {
		c.stats[stat as keyof typeof c.stats] = { value: value!, debilitated: false };
	}
	return c;
};

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

// The preset carries only the *name* of the modifier; the number lives in the
// character, which the shell holds opaquely. `resolve` is the join.
describe('stonetopDice resolve', () => {
	const dexPreset = stonetopDice.presets.find((p) => p.meta?.stat === 'DEX')!;

	it('adds the character’s stat to the roll', () => {
		const resolved = stonetopDice.resolve!(dexPreset, withStats({ DEX: 2 }));
		expect(resolved.notation).toBe('2d6+2');
		expect(resolved.label).toBe('Roll +DEX (+2)');
	});

	it('keeps a negative stat negative', () => {
		const resolved = stonetopDice.resolve!(dexPreset, withStats({ DEX: -1 }));
		expect(resolved.notation).toBe('2d6-1');
		expect(resolved.label).toBe('Roll +DEX (-1)');
	});

	it('prices in a marked debility, so the dice agree with the sheet', () => {
		const character = setDebility(withStats({ DEX: 2 }), 'DEX', true)!;
		expect(stonetopDice.resolve!(dexPreset, character).notation).toBe('2d6+1');
	});

	it('leaves a preset with no stat alone', () => {
		const plain = stonetopDice.presets.find((p) => !p.meta?.stat)!;
		expect(stonetopDice.resolve!(plain, withStats({ DEX: 3 }))).toEqual({
			label: 'Roll 2d6',
			notation: '2d6'
		});
	});
});
