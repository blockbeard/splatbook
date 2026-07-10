import { describe, it, expect } from 'vitest';
import {
	createThreat,
	migrateThreat,
	toggleGrimPortent,
	setGrimPortents,
	setField,
	setList,
	THREAT_SCHEMA_VERSION,
	THREAT_TRACKERS
} from './threat';

describe('createThreat', () => {
	it('starts empty on the Homefront tracker at the current schema version', () => {
		const t = createThreat();
		expect(t.entityType).toBe('threat');
		expect(t.schemaVersion).toBe(THREAT_SCHEMA_VERSION);
		expect(t.tracker).toBe('homefront');
		expect(t.name).toBe('');
		expect(t.threatType).toBe('');
		expect(t.grimPortents).toEqual([]);
		expect(t.moves).toEqual([]);
	});

	it('lists exactly three trackers, closest first', () => {
		expect(THREAT_TRACKERS).toEqual(['homefront', 'nearby', 'distant']);
	});
});

describe('migrateThreat', () => {
	it('fills missing fields and stamps the current schema version', () => {
		const partial = { entityType: 'threat', name: 'The Lord of Ashes' } as never;
		const t = migrateThreat(partial);
		expect(t.name).toBe('The Lord of Ashes');
		expect(t.tracker).toBe('homefront');
		expect(t.stakes).toEqual([]);
		expect(t.schemaVersion).toBe(THREAT_SCHEMA_VERSION);
	});

	it('preserves existing content', () => {
		const t = setField(createThreat(), 'instinct', 'to enrich himself');
		expect(migrateThreat(t).instinct).toBe('to enrich himself');
	});
});

describe('toggleGrimPortent', () => {
	const base = setGrimPortents(createThreat(), [
		{ text: 'The wells run foul', marked: false },
		{ text: 'The herds sicken', marked: false }
	]);

	it('marks and unmarks the portent at an index', () => {
		const marked = toggleGrimPortent(base, 0);
		expect(marked.grimPortents[0].marked).toBe(true);
		expect(marked.grimPortents[1].marked).toBe(false);
		expect(toggleGrimPortent(marked, 0).grimPortents[0].marked).toBe(false);
	});

	it('is a no-op for an out-of-range index', () => {
		expect(toggleGrimPortent(base, 5)).toBe(base);
		expect(toggleGrimPortent(base, -1)).toBe(base);
	});

	it('does not mutate the input', () => {
		toggleGrimPortent(base, 1);
		expect(base.grimPortents[1].marked).toBe(false);
	});
});

describe('setList', () => {
	it('replaces a string-list field', () => {
		const t = setList(createThreat(), 'moves', ['Take a prisoner', 'Do the unthinkable']);
		expect(t.moves).toEqual(['Take a prisoner', 'Do the unthinkable']);
		expect(t.stakes).toEqual([]);
	});
});
