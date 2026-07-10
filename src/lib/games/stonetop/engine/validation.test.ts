import { describe, expect, it } from 'vitest';
import { createCharacter, type StonetopCharacter } from './character';
import { isComplete, validateCharacter, validators } from './validation';
import type { Playbook } from '../pack-schemas';

/** A minimal playbook with two backgrounds, one carrying a 2–3 pick. */
const playbook = {
	backgrounds: [
		{
			id: 'initiate',
			name: 'Initiate',
			choices: [
				{
					id: 'initiates',
					prompt: 'Who are they?',
					min: 2,
					max: 3,
					options: [{ label: 'Enfys' }, { label: 'Gwyn' }, { label: 'Aled' }]
				}
			]
		},
		{ id: 'vessel', name: 'Vessel' }
	]
} as unknown as Playbook;

const withPlaybook = (patch: Partial<StonetopCharacter> = {}): StonetopCharacter => ({
	...createCharacter('the-blessed'),
	...patch
});

describe('validateCharacter', () => {
	it('flags a blank character as needing a playbook', () => {
		const issues = validateCharacter(createCharacter(), null);
		expect(issues.map((i) => i.step)).toContain('playbook');
	});

	it('flags a schema-version mismatch as an error', () => {
		const stale = { ...createCharacter(), schemaVersion: 0 };
		expect(validateCharacter(stale, null).some((i) => i.step === 'schema')).toBe(true);
	});

	it('composes every registered step validator', () => {
		expect(Object.keys(validators)).toEqual([
			'playbook',
			'background',
			'instinct',
			'appearance',
			'origin',
			'stats',
			'moves',
			'possessions',
			'extras',
			'introductions'
		]);
	});
});

describe('background validation', () => {
	it('requires a background to be chosen', () => {
		const issues = validateCharacter(withPlaybook(), playbook);
		expect(issues.some((i) => i.step === 'background' && i.field === 'backgroundId')).toBe(true);
	});

	it('flags an unsatisfied nested pick', () => {
		const c = withPlaybook({ backgroundId: 'initiate', backgroundChoices: {} });
		const issues = validateCharacter(c, playbook);
		expect(issues.some((i) => i.field === 'backgroundChoices.initiates')).toBe(true);
	});

	it('passes once the pick is within range', () => {
		const c = withPlaybook({
			backgroundId: 'initiate',
			backgroundChoices: { initiates: { selected: ['Enfys', 'Gwyn'] } }
		});
		const issues = validateCharacter(c, playbook);
		expect(issues.some((i) => i.step === 'background')).toBe(false);
	});

	it('a background without picks is satisfied by selection alone', () => {
		const c = withPlaybook({ backgroundId: 'vessel' });
		expect(validateCharacter(c, playbook).some((i) => i.step === 'background')).toBe(false);
	});
});

describe('isComplete', () => {
	it('is false for a blank character (no playbook)', () => {
		expect(isComplete(createCharacter(), null)).toBe(false);
	});

	it('is false when a schema error is present', () => {
		const stale = { ...createCharacter('the-blessed'), schemaVersion: 99 };
		expect(isComplete(stale, playbook)).toBe(false);
	});
});
