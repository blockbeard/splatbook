/**
 * The layer rule, enforced rather than remembered.
 *
 * The engine is pure TypeScript: no UI, no database, no framework, and no
 * ambient randomness. That is easy to hold on day one and easy to lose on day
 * forty, when a component is right there and importing it would save five
 * minutes. This test is the thing that notices.
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const engineDir = dirname(fileURLToPath(import.meta.url));

let sources: { file: string; text: string }[];
beforeAll(async () => {
	const files = (await readdir(engineDir)).filter(
		(f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
	);
	sources = await Promise.all(
		files.map(async (file) => ({
			file,
			text: code(await readFile(join(engineDir, file), 'utf8'))
		}))
	);
});

/**
 * Comments discuss the very things this file forbids — `shuffle.ts` explains
 * that it never calls `Math.random`, and cites `$lib/dice` for the Rng shape.
 * So strip the prose and check the code.
 */
const code = (text: string): string =>
	text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const specifiers = (text: string): string[] =>
	[...text.matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('engine boundaries', () => {
	it('has sources to check', () => {
		expect(sources.length).toBeGreaterThan(3);
	});

	it('imports nothing from outside the engine directory', () => {
		for (const { file, text } of sources) {
			for (const spec of specifiers(text)) {
				// Relative, and not climbing out: `./thing`, never `../..` or `$lib/…`.
				expect(`${file}: ${spec}`).toMatch(/^.*: \.\/[^/]+$/);
			}
		}
	});

	it('never reaches for ambient randomness', () => {
		// Shuffles take a seeded Rng from the caller, so the server owns the deck
		// order and a test can assert an exact deal.
		for (const { file, text } of sources) {
			expect(`${file}: ${text.includes('Math.random')}`).toBe(`${file}: false`);
		}
	});

	it('never touches a browser or a database', () => {
		for (const { file, text } of sources) {
			for (const forbidden of ['svelte', 'document.', 'window.', 'drizzle', '$app/', '$lib/']) {
				expect(`${file}: ${text.includes(forbidden)}`).toBe(`${file}: false`);
			}
		}
	});
});
