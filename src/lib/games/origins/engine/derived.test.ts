/**
 * The derived numbers, with particular attention to the four places Origins
 * departs from 5e. Each of those has a test that fails if someone restores the
 * familiar rule: fixed proficiency bonus, no saving-throw proficiency, rolled
 * hit points, and 100/150 GP.
 */

import { describe, expect, it } from 'vitest';
import { createCharacter, type OriginsCharacter } from './character';
import {
	armorClass,
	formatMoney,
	hitDie,
	initiative,
	isTrainedFor,
	maxHitPoints,
	passivePerception,
	proficiencyBonus,
	savingThrow,
	skillModifier,
	startingGold,
	type PackContext
} from './derived';
import { background, equipment, reference, referenceClass, rules, skill } from './fixtures';

function context(backgroundId: string | null, classId: string | null): PackContext {
	return {
		rules,
		reference,
		equipment,
		background: backgroundId ? background(backgroundId) : null,
		referenceClass: classId ? referenceClass(classId) : null
	};
}

/** A character with the given final scores, reached through base scores alone. */
function withScores(partial: Partial<Record<string, number>>): OriginsCharacter {
	const c = createCharacter();
	for (const [ability, score] of Object.entries(partial)) {
		c.abilities.base[ability as keyof typeof c.abilities.base] = score!;
	}
	return c;
}

describe('proficiency bonus', () => {
	it('is fixed at the pack’s value — there are no levels to scale with', () => {
		expect(proficiencyBonus(rules)).toBe(2);
	});
});

describe('armor class', () => {
	const ctx = context('criminal', 'rogue');

	it('is 10 + DEX unarmored', () => {
		expect(armorClass(withScores({ DEX: 16 }), ctx)).toBe(13);
	});

	it('adds the full DEX modifier under light armor', () => {
		const c = withScores({ DEX: 16 });
		c.equipment.armorId = 'leather-armor'; // 11 + Dex
		expect(armorClass(c, ctx)).toBe(14);
	});

	it('caps DEX under medium armor', () => {
		const c = withScores({ DEX: 18 }); // +4, capped to +2
		c.equipment.armorId = 'half-plate-armor'; // 15 + Dex (max 2)
		expect(armorClass(c, ctx)).toBe(17);
	});

	it('ignores DEX under heavy armor', () => {
		const c = withScores({ DEX: 18 });
		c.equipment.armorId = 'plate-armor'; // 18, no Dex
		expect(armorClass(c, ctx)).toBe(18);
	});

	it('adds a shield’s bonus on top, armored or not', () => {
		const bare = withScores({ DEX: 14 });
		bare.equipment.shield = true;
		expect(armorClass(bare, ctx)).toBe(14); // 10 + 2 + 2

		const armored = withScores({ DEX: 14 });
		armored.equipment.armorId = 'chain-mail';
		armored.equipment.shield = true;
		expect(armorClass(armored, ctx)).toBe(18); // 16 + 2
	});

	it('knows what the reference class trained the character for', () => {
		const plate = equipment.armor.find((a) => a.id === 'plate-armor')!;
		const leather = equipment.armor.find((a) => a.id === 'leather-armor')!;
		const shield = equipment.armor.find((a) => a.id === 'shield')!;

		expect(isTrainedFor(plate, referenceClass('fighter'))).toBe(true);
		expect(isTrainedFor(plate, referenceClass('rogue'))).toBe(false);
		expect(isTrainedFor(leather, referenceClass('rogue'))).toBe(true);
		expect(isTrainedFor(shield, referenceClass('wizard'))).toBe(false);
		// No reference class picked yet: trained for nothing.
		expect(isTrainedFor(leather, null)).toBe(false);
	});
});

describe('hit points', () => {
	const ctx = context('soldier', 'fighter');

	it('borrows the hit die from the reference class', () => {
		expect(hitDie(ctx)).toBe(10);
		expect(hitDie(context('sage', 'wizard'))).toBe(6);
	});

	it('is the ROLLED die plus CON — not 5e’s maximum at level 1', () => {
		const c = withScores({ CON: 14 }); // +2
		c.hitPoints.rolled = 6; // a d10 that came up 6
		expect(maxHitPoints(c)).toBe(8);
		// If this ever returns 12 (the d10's maximum plus CON), the hack has
		// been quietly reverted to standard 5e.
		expect(maxHitPoints(c)).not.toBe(12);
	});

	it('is null until the die is rolled, and never drops below 1', () => {
		expect(maxHitPoints(withScores({ CON: 14 }))).toBeNull();
		const unlucky = withScores({ CON: 6 }); // −2
		unlucky.hitPoints.rolled = 1;
		expect(maxHitPoints(unlucky)).toBe(1);
	});
});

describe('saving throws', () => {
	it('are the bare ability modifier — a reference class grants NO proficiency', () => {
		const c = withScores({ STR: 16, CON: 14 });
		// Fighter's own saving throws are Strength and Constitution. An Origins
		// character borrowing Fighter gets neither: the reference class lends
		// four things and saving throws are not among them.
		expect(referenceClass('fighter').notGranted.savingThrowProficiencies).toContain('Strength');
		expect(savingThrow(c, 'STR')).toBe(3); // +3, not +5
		expect(savingThrow(c, 'CON')).toBe(2);
	});
});

describe('skills', () => {
	const ctx = context('acolyte', 'cleric');

	it('adds proficiency only where the character is proficient', () => {
		const c = withScores({ WIS: 16, INT: 10 });
		c.skills = ['religion'];
		expect(skillModifier(c, skill('religion'), ctx)).toBe(2); // INT +0, +2 proficiency
		expect(skillModifier(c, skill('insight'), ctx)).toBe(3); // WIS +3, untrained
	});

	it('computes passive Perception from the Perception modifier', () => {
		const c = withScores({ WIS: 14 });
		expect(passivePerception(c, ctx)).toBe(12);
		c.skills = ['perception'];
		expect(passivePerception(c, ctx)).toBe(14);
	});
});

describe('initiative', () => {
	it('is DEX, plus proficiency for a character whose background gave them Alert', () => {
		const c = withScores({ DEX: 16 });
		// Criminal's feat is Alert, whose Initiative Proficiency benefit applies.
		expect(background('criminal').feat.id).toBe('alert');
		expect(initiative(c, context('criminal', 'rogue'))).toBe(5);
		expect(initiative(c, context('sage', 'wizard'))).toBe(3);
	});
});

describe('starting gold', () => {
	it('is 100 GP, not the SRD’s 50', () => {
		// Rogue trains Light armor only.
		expect(startingGold(context('criminal', 'rogue'))).toBe(100);
		// The pack still carries the SRD's own untouched 50 for Option B; the
		// override is the hack's, and lives in origins-rules.json.
		const optionB = background('criminal').equipment.options.find((o) => o.id === 'b')!;
		expect(optionB.gp).toBe(50);
	});

	it('is 150 GP with Medium or Heavy armor training', () => {
		expect(startingGold(context('soldier', 'fighter'))).toBe(150); // Heavy
		expect(startingGold(context('soldier', 'barbarian'))).toBe(150); // Medium
		expect(startingGold(context('sage', 'wizard'))).toBe(100); // none
	});
});

describe('money', () => {
	it('renders a copper purse the way a sheet writes it', () => {
		expect(formatMoney(1255)).toBe('12 GP 5 SP 5 CP');
		expect(formatMoney(10000)).toBe('100 GP');
		expect(formatMoney(0)).toBe('0 CP');
	});
});
