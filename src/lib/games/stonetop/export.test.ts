import { describe, it, expect } from 'vitest';
import type { Playbook } from './pack-schemas.ts';
import { createCharacter, type StonetopCharacter } from './engine';
import { toExportJSON, toMarkdown, exportFilename } from './export.ts';

/** A partial playbook — only the fields the exporter reads, cast for the test. */
const playbook = {
	name: 'The Blessed',
	base: { maxHp: 18, damage: 'd6' },
	moves: {
		starting: { fixed: ['spirit-tongue'], choose: 0 },
		list: [
			{ id: 'spirit-tongue', name: 'Spirit Tongue', text: 'You can **speak** with spirits.' },
			{ id: 'call-the-spirits', name: 'Call the Spirits', text: 'Roll +WIS.' }
		]
	},
	backgrounds: [
		{ id: 'devout', name: 'Devout', grants: { moves: [], notes: ['A note about faith.'] } }
	],
	instincts: [{ id: 'to-serve', name: 'To serve the gods' }],
	possessions: { fixed: [{ name: 'Holy symbol' }] }
} as unknown as Playbook;

function sampleCharacter(): StonetopCharacter {
	const c = createCharacter('the-blessed');
	c.name = 'Wray';
	c.backgroundId = 'devout';
	c.instinctId = 'to-serve';
	c.appearance = ['weathered'];
	c.origin = { option: 'Local', note: '' };
	c.stats = { STR: { value: 1 }, WIS: { value: 2 } };
	c.moves = ['call-the-spirits'];
	c.possessions = ['Trail rations'];
	c.introductions = { 1: 'I trust you with my life.' };
	return c;
}

describe('toExportJSON', () => {
	it('wraps the character in an identifying, re-importable envelope', () => {
		const parsed = JSON.parse(toExportJSON(sampleCharacter(), new Date('2026-07-10T12:00:00Z')));
		expect(parsed.format).toBe('splatbook.stonetop.character');
		expect(parsed.exportedAt).toBe('2026-07-10T12:00:00.000Z');
		expect(parsed.character.name).toBe('Wray');
		expect(parsed.character.moves).toEqual(['call-the-spirits']);
	});
});

describe('exportFilename', () => {
	it('slugifies the name', () => {
		expect(exportFilename(sampleCharacter(), 'json')).toBe('wray.json');
	});
	it('falls back when unnamed', () => {
		expect(exportFilename(createCharacter(), 'md')).toBe('stonetop-character.md');
	});
});

describe('toMarkdown with a playbook', () => {
	const md = toMarkdown(sampleCharacter(), playbook);

	it('emits Obsidian frontmatter with name, playbook, stats, and tags', () => {
		expect(md.startsWith('---\n')).toBe(true);
		expect(md).toContain('name: Wray');
		expect(md).toContain('playbook: The Blessed');
		expect(md).toContain('  STR: +1');
		expect(md).toContain('  DEX: —');
		expect(md).toContain('tags: [splatbook, stonetop, character]');
		expect(md).toContain('maxHp: 18');
	});

	it('renders granted and chosen moves by name with their text', () => {
		expect(md).toContain('### Spirit Tongue');
		expect(md).toContain('You can **speak** with spirits.');
		expect(md).toContain('### Call the Spirits');
	});

	it('includes background notes, possessions (fixed + chosen), and introductions', () => {
		expect(md).toContain('## Devout');
		expect(md).toContain('- A note about faith.');
		expect(md).toContain('- Holy symbol');
		expect(md).toContain('- Trail rations');
		expect(md).toContain('- I trust you with my life.');
	});

	it('has no run of three or more blank lines', () => {
		expect(md).not.toMatch(/\n{3,}/);
	});
});

describe('toMarkdown without a playbook', () => {
	it('still exports, falling back to stored ids', () => {
		const md = toMarkdown(sampleCharacter());
		expect(md).toContain('playbook: the-blessed');
		expect(md).toContain('- call-the-spirits');
		expect(md).toContain('# Wray');
	});
});
