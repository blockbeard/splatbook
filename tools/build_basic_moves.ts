/**
 * Generate `data/basic-moves.json` for the Stonetop pack.
 *
 * The basic moves are already in the pack — as prose, inside the generated rules
 * tree (`rules/book-i.json`, under "The moves" → "Basic moves"). The play sheet
 * needs them as data, and retyping licensed text by hand is how text drifts from
 * its source. So this lifts them out of the rules tree instead: every move
 * between the "Basic moves" heading and the "Special moves" one, with its name
 * and body exactly as the rules carry them.
 *
 * Run when the rules are regenerated from the vault:
 *   npx tsx tools/build_basic_moves.ts
 *
 * Writes both tracked copies of the pack (source `content/`, served `static/`).
 */

import { readFile, writeFile } from 'node:fs/promises';

const RULES = 'static/content-packs/stonetop/rules/book-i.json';
const START = '03-playing-the-game--basic-moves';
const OUT = ['content/stonetop/data/basic-moves.json', 'static/content-packs/stonetop/data/basic-moves.json'];

interface Section {
	id: string;
	title: string;
	level: number;
	body?: string;
	sections?: Section[];
	visibility?: string;
}

function flatten(node: Section, into: Section[] = []): Section[] {
	into.push(node);
	for (const child of node.sections ?? []) flatten(child, into);
	return into;
}

/** "PERSUADE (vs. NPCs)" → "Persuade (vs. NPCs)"; "DEFY DANGER" → "Defy Danger". */
function titleCase(name: string): string {
	return name
		.toLowerCase()
		.replace(/(^|[\s(])([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase())
		.replace(/\bNpcs\b/, 'NPCs')
		.replace(/\bPcs\b/, 'PCs')
		.replace(/\bGm\b/, 'GM')
		.replace(/\bVs\.\s/, 'vs. ');
}

function slug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

const tree = JSON.parse(await readFile(RULES, 'utf8')) as Section | Section[];
const all = (Array.isArray(tree) ? tree : [tree]).flatMap((root) => flatten(root));

const start = all.findIndex((s) => s.id === START);
if (start < 0) throw new Error(`${RULES}: no "Basic moves" section (${START})`);

// Everything until the next "Special moves" heading is a basic move. Heading
// levels are uneven in the source (AID sits a level deeper than CLASH), so the
// run — not the depth — is what delimits them.
const moves = [];
for (const section of all.slice(start + 1)) {
	if (/^special moves$/i.test(section.title)) break;
	if (!section.body?.trim()) continue;
	moves.push({
		id: slug(section.title),
		name: titleCase(section.title),
		text: section.body.trim()
	});
}
if (moves.length === 0) throw new Error(`${RULES}: found no basic moves after ${START}`);

const pack = {
	id: 'basic-moves',
	name: 'Basic moves',
	type: 'moves',
	// Provenance, so the next regeneration knows where this came from.
	source: { file: 'rules/book-i.json', section: START },
	moves
};

for (const out of OUT) {
	await writeFile(out, JSON.stringify(pack, null, '\t') + '\n');
	console.log(`wrote ${out} (${moves.length} moves)`);
}
