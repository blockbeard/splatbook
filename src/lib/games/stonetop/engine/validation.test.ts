import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import { isComplete, validateCharacter, validators } from './validation';

describe('validateCharacter', () => {
	it('is clean for a blank character while all step validators are stubs', () => {
		expect(validateCharacter(createCharacter(), null)).toEqual([]);
	});

	it('flags a schema-version mismatch as an error', () => {
		const stale = { ...createCharacter(), schemaVersion: 0 };
		const issues = validateCharacter(stale, null);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ step: 'schema', severity: 'error' });
	});

	it('composes every registered step validator', () => {
		// Every non-schema step has an entry, so later commits only fill bodies.
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

describe('isComplete', () => {
	it('is true when there are no error-severity issues', () => {
		expect(isComplete(createCharacter(), null)).toBe(true);
	});

	it('is false when an error issue is present', () => {
		const stale = { ...createCharacter(), schemaVersion: 99 };
		expect(isComplete(stale, null)).toBe(false);
	});
});
