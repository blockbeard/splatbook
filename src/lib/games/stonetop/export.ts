/**
 * Character export — pure serializers from a Stonetop character to a JSON file
 * (round-trippable back into the app) and to Obsidian-flavoured Markdown (YAML
 * frontmatter + sectioned body, so a character drops straight into a vault).
 *
 * Pure functions over the character (+ optionally its loaded playbook, for
 * human names and move text); the DOM download lives in the sheet component.
 * PDF export is deferred until the sheet design settles (see the plan).
 */

import type { Playbook } from './pack-schemas';
import {
	STAT_KEYS,
	SCHEMA_VERSION,
	isWriteInPossession,
	startingMovesPlan,
	type StonetopCharacter
} from './engine';

/** Wrapper written by the JSON export — identifies the shape for re-import. */
export interface CharacterExport {
	format: 'splatbook.stonetop.character';
	schemaVersion: number;
	exportedAt: string;
	character: StonetopCharacter;
}

/** Serialize a character to a pretty JSON string with an identifying envelope. */
export function toExportJSON(c: StonetopCharacter, now: Date = new Date()): string {
	const payload: CharacterExport = {
		format: 'splatbook.stonetop.character',
		schemaVersion: c.schemaVersion ?? SCHEMA_VERSION,
		exportedAt: now.toISOString(),
		character: c
	};
	return JSON.stringify(payload, null, 2);
}

const fmt = (n: number | undefined): string => (n === undefined ? '—' : n >= 0 ? `+${n}` : `${n}`);

/** A filesystem-friendly slug for the download filename. */
export function exportFilename(c: StonetopCharacter, ext: 'json' | 'md' | 'pdf'): string {
	const slug =
		(c.name ?? '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'stonetop-character';
	return `${slug}.${ext}`;
}

/** YAML-escape a scalar (quote when it could confuse the parser). */
function yaml(value: string): string {
	return /^[\w +.\-/]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * Render a character as Obsidian-flavoured Markdown. With the playbook loaded,
 * moves and backgrounds render by name and full text; without it, the export
 * still works, falling back to the stored ids.
 */
export function toMarkdown(c: StonetopCharacter, playbook?: Playbook | null): string {
	const name = c.name?.trim() || 'Unnamed';
	const background = playbook?.backgrounds.find((b) => b.id === c.backgroundId) ?? null;
	const instinct = playbook?.instincts.find((i) => i.id === c.instinctId);
	const instinctLabel = instinct?.custom ? (c.instinctWriteIn ?? '') : (instinct?.name ?? '');
	const appearance = c.appearance.filter(Boolean);

	// Frontmatter.
	const fm: string[] = ['---', `name: ${yaml(name)}`, 'game: Stonetop'];
	if (playbook) fm.push(`playbook: ${yaml(playbook.name)}`);
	else if (c.playbookId) fm.push(`playbook: ${yaml(c.playbookId)}`);
	if (background) fm.push(`background: ${yaml(background.name)}`);
	if (instinctLabel) fm.push(`instinct: ${yaml(instinctLabel)}`);
	fm.push('stats:');
	for (const stat of STAT_KEYS) fm.push(`  ${stat}: ${fmt(c.stats[stat]?.value)}`);
	if (playbook) {
		fm.push(`maxHp: ${playbook.base.maxHp}`, `damage: ${yaml(playbook.base.damage)}`);
	}
	fm.push('tags: [splatbook, stonetop, character]', '---');

	const out: string[] = [fm.join('\n'), '', `# ${name}`, ''];

	const subtitle = [playbook?.name ?? c.playbookId, background?.name].filter(Boolean).join(' · ');
	if (subtitle) out.push(`*${subtitle}*`, '');

	const meta: string[] = [];
	if (instinctLabel) meta.push(`**Instinct:** ${instinctLabel}`);
	if (c.origin.option) meta.push(`**Origin:** ${c.origin.option}`);
	if (appearance.length) meta.push(`**Appearance:** ${appearance.join(', ')}`);
	if (meta.length) out.push(meta.join('  \n'), '');

	// Stats.
	out.push('## Stats', '');
	for (const stat of STAT_KEYS) out.push(`- **${stat}** ${fmt(c.stats[stat]?.value)}`);
	if (playbook)
		out.push(`- **Max HP** ${playbook.base.maxHp}`, `- **Damage** ${playbook.base.damage}`);
	out.push('');

	// Moves.
	if (playbook) {
		const moveById = new Map(playbook.moves.list.map((m) => [m.id, m]));
		const plan = startingMovesPlan(c, playbook);
		const ids = [...new Set([...plan.granted, ...c.moves])];
		const moves = ids
			.map((id) => moveById.get(id))
			.filter((m): m is NonNullable<typeof m> => Boolean(m));
		if (moves.length) {
			out.push('## Moves', '');
			for (const move of moves) out.push(`### ${move.name}`, '', move.text.trim(), '');
		}
	} else if (c.moves.length) {
		out.push('## Moves', '');
		for (const id of c.moves) out.push(`- ${id}`);
		out.push('');
	}

	// Background notes.
	if (background?.grants?.notes?.length) {
		out.push(`## ${background.name}`, '');
		for (const note of background.grants.notes) out.push(`- ${note}`);
		out.push('');
	}

	// Possessions.
	const chosen = c.possessions.map((id) =>
		isWriteInPossession(id) ? (c.possessionChoices[id]?.writeIn ?? '—') : id
	);
	const fixed = (playbook?.possessions.fixed ?? []).map((p) => p.name);
	if (chosen.length || fixed.length) {
		out.push('## Possessions', '');
		for (const item of [...fixed, ...chosen]) out.push(`- ${item}`);
		out.push('');
	}

	// Introductions.
	const intros = Object.values(c.introductions ?? {}).filter((v) => v?.trim());
	if (intros.length) {
		out.push('## Introductions', '');
		for (const note of intros) out.push(`- ${note}`);
		out.push('');
	}

	return (
		out
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trimEnd() + '\n'
	);
}
