import { describe, expect, it } from 'vitest';
import { ABILITIES, createCharacter, migrateCharacter, SCHEMA_VERSION } from './character';

describe('createCharacter', () => {
	it('opens every choice and assumes nothing', () => {
		const c = createCharacter();
		expect(c.schemaVersion).toBe(SCHEMA_VERSION);
		expect(c.backgroundId).toBeNull();
		expect(c.referenceClassId).toBeNull();
		expect(c.speciesId).toBeNull();
		for (const ability of ABILITIES) expect(c.abilities.base[ability]).toBeNull();
		expect(c.hitPoints.rolled).toBeNull();
	});
});

describe('migrateCharacter', () => {
	it('brings a v1 blob through unchanged', () => {
		const c = createCharacter();
		c.name = 'Vess';
		c.backgroundId = 'criminal';
		c.skills = ['stealth'];
		expect(migrateCharacter(structuredClone(c))).toEqual(c);
	});

	it('fills in what a partial or truncated save is missing', () => {
		// The shape a hand-edited or half-written blob might arrive in.
		const migrated = migrateCharacter({ name: 'Half', backgroundId: 'sage' });
		expect(migrated.name).toBe('Half');
		expect(migrated.backgroundId).toBe('sage');
		expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
		expect(migrated.skills).toEqual([]);
		expect(migrated.spells.spent).toEqual([]);
		expect(migrated.details.notes).toBe('');
		for (const ability of ABILITIES) expect(migrated.abilities.base[ability]).toBeNull();
	});

	it('survives junk rather than throwing', () => {
		expect(migrateCharacter(null)).toEqual(createCharacter());
		expect(migrateCharacter('nonsense')).toEqual(createCharacter());
	});

	it('copies collections rather than aliasing the input', () => {
		const raw = createCharacter();
		raw.skills = ['stealth'];
		const migrated = migrateCharacter(raw);
		migrated.skills.push('arcana');
		expect(raw.skills).toEqual(['stealth']);
	});
});
