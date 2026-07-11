import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { engine } from '../engine';
import { stonetopSummary } from './summary';

// The provider resolves ids to names against the served pack, so the test
// serves it: `fetch` reads the real pack file the app would have downloaded.
// Nothing is faked but the transport.
const PACK = join(process.cwd(), 'static', 'content-packs');
const realFetch = globalThis.fetch;

beforeAll(() => {
	globalThis.fetch = (async (input: string) => {
		const url = String(input);
		const body = await readFile(join(PACK, url.replace(/^\/?content-packs\//, '')), 'utf8');
		return new Response(body, { status: 200 });
	}) as typeof fetch;
});

afterAll(() => {
	globalThis.fetch = realFetch;
});

const rows = (sections: readonly { items: readonly { label: string; value?: string }[] }[]) =>
	new Map(sections.flatMap((s) => s.items.map((i) => [i.label, i.value ?? ''])));

describe('stonetop wizard summary', () => {
	it('asks for a playbook before it can name anything else', async () => {
		const sections = await stonetopSummary(engine.createCharacter());
		expect(rows(sections).get('Playbook')).toBe('');
		// Every row still points at the step that fills it in.
		expect(sections[0].items.every((i) => i.stepId)).toBe(true);
	});

	it('resolves the draft to human labels once a playbook is chosen', async () => {
		const character = engine.createCharacter();
		character.playbookId = 'the-blessed';
		character.name = 'Ryn';
		character.stats.STR = { value: 1, debilitated: false };
		character.stats.CHA = { value: -1, debilitated: false };

		const summary = rows(await stonetopSummary(character));
		expect(summary.get('Name')).toBe('Ryn');
		expect(summary.get('Playbook')).toBe('The Blessed');
		expect(summary.get('STR')).toBe('+1');
		expect(summary.get('CHA')).toBe('-1');
		// An unassigned stat reads as blank — the rail shows what is still open.
		expect(summary.get('INT')).toBe('');
	});

	it('names the moves the playbook grants, not their ids', async () => {
		const character = engine.createCharacter();
		character.playbookId = 'the-blessed';
		character.moves = ['amulets-talismans'];

		const moves = rows(await stonetopSummary(character)).get('Moves') ?? '';
		expect(moves).toContain('Amulets & Talismans');
		expect(moves).not.toContain('amulets-talismans');
	});
});
