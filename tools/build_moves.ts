/**
 * Generate the move data files for the Stonetop pack:
 *
 *   data/basic-moves.json     the moves every character can make
 *   data/steading-moves.json  the moves a *steading* rolls
 *
 * Both are already in the pack — as prose, inside the generated rules tree
 * (`rules/book-i.json`). The play sheets need them as data, and retyping licensed
 * text by hand is how text drifts from its source. So this lifts them out of the
 * rules tree instead, with each move's name and body exactly as the rules carry
 * them.
 *
 * The basic moves are the run between the "Basic moves" heading and "Special
 * moves". The steading's moves are the Homefront moves that roll a *steading*
 * stat (Seasons Change +Fortunes, Deploy +Defenses, …) — the rest of the
 * homefront moves are things a character does at home (Convalesce, Level Up) and
 * are no business of the steading sheet.
 *
 * Run when the rules are regenerated from the vault:
 *   npx tsx tools/build_moves.ts
 *
 * Writes both tracked copies of the pack (source `content/`, served `static/`).
 */

import { readFile, writeFile } from 'node:fs/promises';

const RULES = 'static/content-packs/stonetop/rules/book-i.json';
const BASIC_START = '03-playing-the-game--basic-moves';
const HOMEFRONT_START = '03-playing-the-game--homefront-moves';
const END_OF_SESSION = '03-playing-the-game--end-of-session';

/** The steading's own stats — a homefront move that rolls one of these is a
 * steading move; one that doesn't is a character's business. */
const STEADING_STATS = ['Fortunes', 'Surplus', 'Population', 'Prosperity', 'Defenses'];
const ROLLS_STEADING_STAT = new RegExp(`rolls?\\s*\\+(${STEADING_STATS.join('|')})\\b`, 'i');

const packPaths = (file: string) => [
	`content/stonetop/data/${file}`,
	`static/content-packs/stonetop/data/${file}`
];

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

interface MoveEntry {
	id: string;
	name: string;
	text: string;
}

const tree = JSON.parse(await readFile(RULES, 'utf8')) as Section | Section[];
const all = (Array.isArray(tree) ? tree : [tree]).flatMap((root) => flatten(root));

/**
 * The moves in the run that starts after `startId` and ends at `endsAt`.
 *
 * Heading levels are uneven in the source (AID sits a level deeper than CLASH),
 * so the run — not the depth — is what delimits a move list.
 */
function movesInRun(startId: string, endsAt: RegExp, keep: (m: MoveEntry) => boolean): MoveEntry[] {
	const start = all.findIndex((s) => s.id === startId);
	if (start < 0) throw new Error(`${RULES}: no such section: ${startId}`);

	const moves: MoveEntry[] = [];
	for (const section of all.slice(start + 1)) {
		if (endsAt.test(section.title)) break;
		if (!section.body?.trim()) continue;
		const move = {
			id: slug(section.title),
			name: titleCase(section.title),
			text: section.body.trim()
		};
		if (keep(move)) moves.push(move);
	}
	if (moves.length === 0) throw new Error(`${RULES}: found no moves after ${startId}`);
	return moves;
}

async function writePack(file: string, pack: object, count: number): Promise<void> {
	for (const out of packPaths(file)) {
		await writeFile(out, JSON.stringify(pack, null, '\t') + '\n');
		console.log(`wrote ${out} (${count} moves)`);
	}
}

const basic = movesInRun(BASIC_START, /^special moves$/i, () => true);
await writePack(
	'basic-moves.json',
	{
		id: 'basic-moves',
		name: 'Basic moves',
		type: 'moves',
		// Provenance, so the next regeneration knows where this came from.
		source: { file: 'rules/book-i.json', section: BASIC_START },
		moves: basic
	},
	basic.length
);

// The homefront moves that roll a steading stat. Convalesce and Level Up sit in
// the same run of the book but roll nothing of the steading's — they're what a
// character does at home, not what the village does.
const steading = movesInRun(HOMEFRONT_START, /^gear and possessions$/i, (m) =>
	ROLLS_STEADING_STAT.test(m.text)
);
await writePack(
	'steading-moves.json',
	{
		id: 'steading-moves',
		name: 'Steading moves',
		type: 'moves',
		source: { file: 'rules/book-i.json', section: HOMEFRONT_START },
		moves: steading
	},
	steading.length
);

/**
 * The end-of-session move, split into the parts a guided flow needs: the two
 * prompts each player answers for themselves ("If you can, mark XP"), and the
 * questions the table answers together (every "yes" is an XP for everyone).
 *
 * The split is structural, not editorial: the personal prompts are the
 * paragraphs that end in "mark XP", the group questions are the bullet list, and
 * the rest (praise, a wish) is prose the flow shows but scores nothing for.
 */
const eos = all.find((s) => s.id === END_OF_SESSION);
if (!eos?.body) throw new Error(`${RULES}: no end-of-session move (${END_OF_SESSION})`);

const paragraphs = eos.body
	.split(/\n\s*\n/)
	.map((p) => p.trim())
	.filter(Boolean);

const personal = paragraphs
	.filter((p) => !p.startsWith('-') && /mark XP/i.test(p))
	.map((text, i) => ({ id: `personal-${i + 1}`, text }));

const questions = eos.body
	.split('\n')
	.map((line) => line.trim())
	.filter((line) => line.startsWith('- '))
	.map((line, i) => ({ id: `q${i + 1}`, text: line.slice(2).trim() }));

// Everything with no XP attached: praise, and a wish for future sessions.
const closing = paragraphs.filter(
	(p) => !p.startsWith('-') && !/mark XP/i.test(p) && !/^Answer these questions/i.test(p) && !/^For more information/i.test(p)
);

if (personal.length === 0 || questions.length === 0) {
	throw new Error(`${RULES}: end-of-session move parsed to nothing (${personal.length} prompts, ${questions.length} questions)`);
}

await writePack(
	'end-of-session.json',
	{
		id: 'end-of-session',
		name: 'End of Session',
		type: 'move',
		source: { file: 'rules/book-i.json', section: END_OF_SESSION },
		/** Each answered for yourself; "if you can, mark XP". */
		personal,
		/** Answered as a group; for each "yes", everyone marks XP. */
		questions,
		/** Prose the flow shows at the end; nothing is scored for it. */
		closing
	},
	personal.length + questions.length
);
