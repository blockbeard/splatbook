import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { clearPackSchemas, registerPackSchemas, validatePack } from './harness';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const testPack = join(fixtures, 'test-pack');

const thingsSchema = z.object({
	id: z.string(),
	entries: z.array(z.object({ id: z.string(), name: z.string() }))
});

afterEach(() => clearPackSchemas());

describe('validatePack', () => {
	it('passes a pack whose files all match their registered schemas', async () => {
		registerPackSchemas('test-pack', (path) => (path === 'data/things.json' ? thingsSchema : null));
		const result = await validatePack(testPack);
		expect(result.errors).toEqual([]);
		expect(result.manifest?.id).toBe('test-pack');
	});

	it('fails a pack whose game registered no schemas at all', async () => {
		const result = await validatePack(testPack);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatch(/no schemas registered for game "test-pack"/);
	});

	it('fails a file the game has no schema for', async () => {
		registerPackSchemas('test-pack', () => null);
		const result = await validatePack(testPack);
		expect(result.errors[0]).toMatch(/no schema for this file/);
	});

	it('reports schema violations with file and path', async () => {
		registerPackSchemas('test-pack', () =>
			z.object({ id: z.string(), entries: z.array(z.object({ id: z.number() })) })
		);
		const result = await validatePack(testPack);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('data/things.json');
		expect(result.errors[0]).toContain('entries.0.id');
	});

	it('surfaces envelope failures without reaching schema validation', async () => {
		registerPackSchemas('missing-file', () => thingsSchema);
		const result = await validatePack(join(fixtures, 'missing-file'));
		expect(result.manifest).toBeUndefined();
		expect(result.errors[0]).toMatch(/listed in manifest but not found/);
	});
});
