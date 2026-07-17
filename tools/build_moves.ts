/**
 * Generate the move data files for the Stonetop pack:
 *
 *   data/basic-moves.json     the moves every character can make
 *   data/special-moves.json   the special moves (commit 113 — the Moves & Gear page)
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
const SPECIAL_START = '03-playing-the-game--special-moves';
const HOMEFRONT_START = '03-playing-the-game--homefront-moves';
const END_OF_SESSION = '03-playing-the-game--end-of-session';
/**
 * Death's Door belongs on the Moves & Gear handout with the other special
 * moves, but the playing-the-game chapter doesn't restate it — the Player
 * Moves chapter carries the crisp copy (the move callout, plus an unquoted
 * "discussed in detail…" trailer this script drops; see `calloutOnly`).
 */
const DEATHS_DOOR = '06-player-moves--death-s-door';

/** The steading's own stats — a homefront move that rolls one of these is a
 * steading move; one that doesn't is a character's business. */
const STEADING_STATS = ['Fortunes', 'Surplus', 'Population', 'Prosperity', 'Defenses'];
const ROLLS_STEADING_STAT = new RegExp(`rolls?\\s*\\+(${STEADING_STATS.join('|')})\\b`, 'i');

/**
 * Moves whose own resolution *is* "deal your damage" — commit 108's "Damage"
 * button. Hand-curated by id rather than text-matched: the book's exact
 * phrasing ("deal your damage") also shows up as one option among several on
 * moves that aren't fundamentally about dealing damage — Defend's "strike
 * back at an attacker (deal your damage, with disadvantage)" is one of four
 * spendable Readiness options, not the move's trigger, and a regex can't
 * tell "the move's resolution" from "a bullet point inside it" the way a
 * reader can. Revisit this list if a future vault regeneration adds a new
 * basic move built the same way as Clash/Let Fly.
 */
const ROLLS_DAMAGE_IDS = new Set(['clash', 'let-fly']);

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
	/** The rules section this move card deep-links to (commit 115). */
	sectionId: string;
	rollsDamage?: boolean;
}

/**
 * Since the vault cleanup (phase 12), a move heading opens an Obsidian
 * callout (`> [!move] ## CLASH`) instead of a plain `#…` heading. `build_srd.py`
 * deliberately keeps a callout section's body as raw blockquote markdown --
 * every line still carries its `> ` continuation mark, and a trailing bare
 * `^move-id` line (the callout's own link anchor) -- because that's the
 * reference *renderer's* job to style (commit 93), not the pipeline's. This
 * script wants the plain move text underneath for structured play-sheet data,
 * so it undoes both here: strips the `> ` mark from every line, drops the
 * bare anchor line, and collapses the blank line it leaves behind.
 */
function dequote(body: string): string {
	return body
		.split('\n')
		.map((line) => line.replace(/^>\s?/, ''))
		.filter((line) => !/^\^[\w-]+$/.test(line.trim()))
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * Like `dequote`, but first drops every line *outside* the move callout — some
 * sections follow the quoted move with plain-prose commentary ("This move is
 * discussed in detail on …") that belongs to the reference, not to a handout's
 * move card.
 */
function calloutOnly(body: string): string {
	return dequote(
		body
			.split('\n')
			.filter((line) => line.startsWith('>'))
			.join('\n')
	);
}

const tree = JSON.parse(await readFile(RULES, 'utf8')) as Section | Section[];
const all = (Array.isArray(tree) ? tree : [tree]).flatMap((root) => flatten(root));

/**
 * The rules section a move card should deep-link to (commit 115). The
 * playing-the-game chapter this script lifts *text* from is the handout
 * summary; the full write-ups live in the reference chapters — Player Moves
 * (06) for a character's moves, Homefront (15) for the steading's. Commit 89's
 * reimport made each move its own section, so the id is findable by the same
 * slug this script already derives — recorded here so the link is data, not
 * string-matching at runtime. Falls back to the section the move was lifted
 * from, which always exists.
 */
const FULL_RULES_CHAPTERS = ['06-player-moves', '15-homefront'];
function rulesSectionId(moveId: string, liftedFrom: string): string {
	for (const chapter of FULL_RULES_CHAPTERS) {
		const hit = all.find((s) => s.id === `${chapter}--${moveId}`);
		if (hit) return hit.id;
	}
	return liftedFrom;
}

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
		const id = slug(section.title);
		const move: MoveEntry = {
			id,
			name: titleCase(section.title),
			text: dequote(section.body),
			sectionId: rulesSectionId(id, section.id),
			...(ROLLS_DAMAGE_IDS.has(id) ? { rollsDamage: true } : {})
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

// The special moves (commit 113): the run after "Special moves" —
// Advantage/Disadvantage, Burn Brightly, End of Session — plus Death's Door,
// lifted from the Player Moves chapter (callout only; see DEATHS_DOOR above).
// End of Session appears here as a *card* (its text, for the handout page);
// data/end-of-session.json below stays the guided flow's structured split.
const special = movesInRun(SPECIAL_START, /^follower moves$/i, () => true);
const dd = all.find((s) => s.id === DEATHS_DOOR);
if (!dd?.body) throw new Error(`${RULES}: no Death's Door section (${DEATHS_DOOR})`);
special.push({
	id: slug(dd.title),
	name: titleCase(dd.title),
	text: calloutOnly(dd.body),
	sectionId: rulesSectionId(slug(dd.title), dd.id)
});
await writePack(
	'special-moves.json',
	{
		id: 'special-moves',
		name: 'Special moves',
		type: 'moves',
		// Provenance names the run's start; Death's Door additionally comes from
		// the DEATHS_DOOR section — this script is the record of that.
		source: { file: 'rules/book-i.json', section: SPECIAL_START },
		moves: special
	},
	special.length
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
const eosBody = dequote(eos.body);

const paragraphs = eosBody
	.split(/\n\s*\n/)
	.map((p) => p.trim())
	.filter(Boolean);

const personal = paragraphs
	.filter((p) => !p.startsWith('-') && /mark XP/i.test(p))
	.map((text, i) => ({ id: `personal-${i + 1}`, text }));

const questions = eosBody
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
