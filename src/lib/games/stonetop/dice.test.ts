import { describe, expect, it } from 'vitest';
import { isValidNotation, parseNotation } from '$lib/dice';
import { STAT_KEYS, engine, setDebility } from './engine';
import { rollForStat, stonetopDice } from './dice';

const withStats = (stats: Partial<Record<string, number>>) => {
	const c = engine.createCharacter();
	for (const [stat, value] of Object.entries(stats)) {
		c.stats[stat as keyof typeof c.stats] = { value: value! };
	}
	return c;
};

describe('stonetopDice presets', () => {
	it('offers one roll per stat', () => {
		expect(stonetopDice.presets).toHaveLength(STAT_KEYS.length);
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

	it('rolls a marked debility at disadvantage, modifier untouched', () => {
		const character = setDebility(withStats({ DEX: 2 }), 'weakened', true);
		const resolved = stonetopDice.resolve!(dexPreset, character);
		expect(resolved.notation).toBe('2d6+2');
		expect(resolved.mode).toBe('disadvantage');
	});

	it('rolls normally with no debility marked', () => {
		expect(stonetopDice.resolve!(dexPreset, withStats({ DEX: 2 })).mode).toBe('normal');
	});

	// Every stonetopDice preset carries a stat today, but `resolve` still has to
	// handle a bare preset gracefully — the shell's generic dice panel (commit
	// 107) can hand back any preset, including ones stonetopDice never defined.
	it('leaves a preset with no stat alone', () => {
		const plain = { id: 'bare', label: 'Roll 2d6', notation: '2d6' };
		expect(stonetopDice.resolve!(plain, withStats({ DEX: 3 }))).toEqual({
			label: 'Roll 2d6',
			notation: '2d6'
		});
	});

	// commit 109: a real stat roll always arms the miss follow-up; a bare
	// preset (nothing to resolve) never does, so it can never reach a base die
	// or a damage roll — those never call rollForStat at all.
	it('arms a Mark XP follow-up on a real stat roll', () => {
		const resolved = stonetopDice.resolve!(dexPreset, withStats({ DEX: 2 }));
		expect(resolved.onMiss?.label).toBe('Mark XP');
	});

	it('has no follow-up to arm on a bare preset', () => {
		const plain = { id: 'bare', label: 'Roll 2d6', notation: '2d6' };
		expect(stonetopDice.resolve!(plain, withStats({ DEX: 3 })).onMiss).toBeUndefined();
	});
});

describe('rollForStat', () => {
	it('always arms a Mark XP follow-up that marks 1 XP on the character it’s given', () => {
		const character = withStats({ STR: 1 });
		const resolved = rollForStat(character, 'STR');
		expect(resolved.onMiss?.label).toBe('Mark XP');
		const next = resolved.onMiss!.apply(character);
		expect(next).toMatchObject({ xp: character.xp + 1 });
	});
});
