import { describe, expect, it } from 'vitest';
import { createCharacter, type StonetopCharacter } from './character';
import { isComplete, validateCharacter, validators } from './validation';
import type { Playbook } from '../pack-schemas';

/** A minimal-but-complete playbook: backgrounds (one with a 2–3 pick), instincts
 * (including a write-in), two appearance lines, and origin options. */
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
	],
	instincts: [
		{ id: 'delight', name: 'Delight' },
		{ id: 'custom', name: 'Something else', custom: true }
	],
	appearance: [
		['young', 'old'],
		['tall', 'short']
	],
	origins: { prompt: 'Where from?', options: [{ label: 'Stonetop', names: ['Arwel'] }] },
	stats: { array: [2, 1, 1, 0, 0, -1] },
	moves: {
		starting: { fixed: ['fx'], choose: 1 },
		list: [
			{ id: 'fx', name: 'Fixed', text: '…' },
			{ id: 'opt', name: 'Option', text: '…' }
		]
	},
	possessions: { prompt: 'Pick 1', pick: 1, options: [{ name: 'Torch' }, { name: 'Rope' }] }
} as unknown as Playbook;

/** A character with every non-background choice satisfied, for isolating tests. */
const complete = (patch: Partial<StonetopCharacter> = {}): StonetopCharacter => ({
	...createCharacter('the-blessed'),
	backgroundId: 'vessel',
	instinctId: 'delight',
	appearance: ['young', 'tall'],
	origin: { option: 'Stonetop', note: '' },
	name: 'Arwel',
	stats: {
		STR: { value: 2 },
		DEX: { value: 1 },
		CON: { value: 1 },
		INT: { value: 0 },
		WIS: { value: 0 },
		CHA: { value: -1 }
	},
	moves: ['opt'],
	possessions: ['Torch'],
	...patch
});

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

describe('instinct / appearance / origin validation', () => {
	it('requires an instinct, and write-in text for the custom one', () => {
		expect(
			validateCharacter(complete({ instinctId: null }), playbook).some((i) => i.step === 'instinct')
		).toBe(true);
		const custom = complete({ instinctId: 'custom', instinctWriteIn: '  ' });
		expect(validateCharacter(custom, playbook).some((i) => i.field === 'instinctWriteIn')).toBe(
			true
		);
		const filled = complete({ instinctId: 'custom', instinctWriteIn: 'Curiosity' });
		expect(validateCharacter(filled, playbook).some((i) => i.step === 'instinct')).toBe(false);
	});

	it('requires one pick per appearance line', () => {
		const c = complete({ appearance: ['young'] }); // second line missing
		expect(validateCharacter(c, playbook).some((i) => i.field === 'appearance.1')).toBe(true);
	});

	it('requires an origin and a name', () => {
		expect(
			validateCharacter(complete({ origin: { option: null, note: '' } }), playbook).some(
				(i) => i.field === 'origin.option'
			)
		).toBe(true);
		expect(
			validateCharacter(complete({ name: '  ' }), playbook).some((i) => i.field === 'name')
		).toBe(true);
	});

	it('a fully-specified character has no step errors', () => {
		const issues = validateCharacter(complete(), playbook);
		expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
	});
});

describe('extras validation', () => {
	/** Playbook with one extras section: a pick-one line and a choose-1. */
	const pb = {
		...playbook,
		extras: [
			{
				id: 'pouch',
				title: 'Sacred pouch',
				lines: [['heirloom', 'gift']],
				choices: [{ id: 'trait', prompt: 'Trait?', min: 1, max: 1, options: [{ label: 'warm' }] }]
			}
		]
	} as unknown as Playbook;

	it('requires each extras line and choice', () => {
		const issues = validateCharacter(complete(), pb);
		expect(issues.some((i) => i.field === 'extras.pouch.line.0')).toBe(true);
		expect(issues.some((i) => i.field === 'extras.pouch.trait')).toBe(true);
	});

	it('passes once the section is filled in', () => {
		const c = complete({
			extras: { pouch: { lines: ['heirloom'], choices: { trait: { selected: ['warm'] } } } }
		});
		expect(validateCharacter(c, pb).some((i) => i.step === 'extras')).toBe(false);
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
