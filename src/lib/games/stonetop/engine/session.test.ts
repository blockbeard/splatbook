import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import { createSteading, setDebility, setStat } from './steading';
import { applyEndOfSession, emptyAnswers, turnSeason, xpFor } from './session';

const answers = (group: string[], personal: Record<string, string[]> = {}) => ({
	group,
	personal
});

describe('xpFor', () => {
	it('gives everyone an XP for every "yes" the table gave', () => {
		const a = answers(['q1', 'q3']);
		expect(xpFor('ryn', a)).toBe(2);
		expect(xpFor('bram', a)).toBe(2);
	});

	it('adds the prompts a character marked for themselves', () => {
		const a = answers(['q1'], { ryn: ['personal-1', 'personal-2'], bram: ['personal-1'] });
		expect(xpFor('ryn', a)).toBe(3);
		expect(xpFor('bram', a)).toBe(2);
		// A character nobody answered for still takes the group's XP.
		expect(xpFor('nobody', a)).toBe(1);
	});

	it('is nothing when the session was a wash', () => {
		expect(xpFor('ryn', emptyAnswers())).toBe(0);
	});
});

describe('applyEndOfSession', () => {
	it('marks the session XP on the character', () => {
		const c = { ...createCharacter('the-blessed'), xp: 2 };
		const after = applyEndOfSession(c, 'ryn', answers(['q1', 'q2'], { ryn: ['personal-1'] }));
		expect(after.xp).toBe(5);
	});

	// XP has no ceiling (see markXp): the point that levels you often lands here,
	// and the session still ends.
	it('banks XP past the level threshold', () => {
		const c = { ...createCharacter('the-blessed'), level: 1, xp: 7 };
		const after = applyEndOfSession(c, 'ryn', answers(['q1', 'q2', 'q3']));
		expect(after.xp).toBe(10); // threshold at level 1 is 8
	});

	it('leaves a character untouched when it earned nothing', () => {
		const c = { ...createCharacter('the-blessed'), xp: 4 };
		expect(applyEndOfSession(c, 'ryn', emptyAnswers())).toBe(c);
	});
});

describe('turnSeason', () => {
	it('advances the steading a season, wrapping the year', () => {
		const s = createSteading();
		expect(s.season).toBe('spring');
		expect(turnSeason(s).season).toBe('summer');
		expect(turnSeason({ ...s, season: 'winter' }).season).toBe('spring');
	});

	it('resets Fortunes to +1 after the roll — the change was for one season', () => {
		const s = setStat(createSteading(), 'fortunes', 3);
		expect(turnSeason(s).stats.fortunes).toBe(1);
	});

	it('resets Fortunes to +0 while the steading is malcontent', () => {
		const s = setDebility(setStat(createSteading(), 'fortunes', 2), 'malcontent', true);
		expect(turnSeason(s).stats.fortunes).toBe(0);
	});
});
