/**
 * Stonetop's choices-so-far rail (the shell's `summary(draft)` hook).
 *
 * Turns the draft's ids into the names a player recognises — which means
 * reading the chosen playbook out of the content pack, so this is async. The
 * fetch is memoised in `pack/playbooks`, so the rail re-resolving on every
 * keystroke costs one map lookup after the first load.
 *
 * Blank values are deliberately kept rather than dropped: a row reading
 * "Instinct — not chosen yet" is the rail earning its place.
 */

import type { WizardSummarySection } from '$lib/wizard';
import {
	STAT_KEYS,
	isWriteInPossession,
	startingMovesPlan,
	type StonetopCharacter
} from '../engine';
import type { Move, Playbook } from '../pack-schemas';
import { fetchPlaybook } from '../pack/playbooks';

function formatModifier(value: number | undefined): string {
	if (value === undefined) return '';
	return value >= 0 ? `+${value}` : `${value}`;
}

function instinctLabel(character: StonetopCharacter, playbook: Playbook): string {
	const instinct = playbook.instincts.find((i) => i.id === character.instinctId);
	if (!instinct) return '';
	return instinct.custom ? (character.instinctWriteIn ?? '') : instinct.name;
}

function moveNames(character: StonetopCharacter, playbook: Playbook): string[] {
	const byId = new Map<string, Move>(playbook.moves.list.map((m) => [m.id, m]));
	const plan = startingMovesPlan(character, playbook);
	// Granted moves come with the playbook; `character.moves` are the picks.
	const ids = [...new Set([...plan.granted, ...character.moves])];
	return ids.map((id) => byId.get(id)?.name ?? id);
}

function possessionNames(character: StonetopCharacter): string[] {
	return character.possessions.map((id) =>
		isWriteInPossession(id) ? (character.possessionChoices[id]?.writeIn ?? '—') : id
	);
}

export async function stonetopSummary(draft: object): Promise<readonly WizardSummarySection[]> {
	const character = draft as StonetopCharacter;

	// Without a playbook there is nothing to resolve names against — say so, and
	// point at the step that fixes it.
	if (!character.playbookId) {
		return [
			{
				title: 'Character',
				items: [
					{ label: 'Name', value: character.name, stepId: 'extras' },
					{ label: 'Playbook', value: '', stepId: 'playbook' }
				]
			}
		];
	}

	let playbook: Playbook;
	try {
		playbook = await fetchPlaybook(character.playbookId, fetch);
	} catch {
		// A pack that won't load is the wizard's problem to report, not the rail's.
		return [
			{
				title: 'Character',
				items: [
					{ label: 'Name', value: character.name, stepId: 'extras' },
					{ label: 'Playbook', value: character.playbookId, stepId: 'playbook' }
				]
			}
		];
	}

	const moves = moveNames(character, playbook);
	const possessions = possessionNames(character);

	return [
		{
			title: 'Character',
			items: [
				{ label: 'Name', value: character.name, stepId: 'extras' },
				{ label: 'Playbook', value: playbook.name, stepId: 'playbook' },
				{
					label: 'Background',
					value: playbook.backgrounds.find((b) => b.id === character.backgroundId)?.name ?? '',
					stepId: 'background'
				},
				{ label: 'Instinct', value: instinctLabel(character, playbook), stepId: 'instinct' },
				{ label: 'Origin', value: character.origin.option ?? '', stepId: 'origin' }
			]
		},
		{
			title: 'Stats',
			items: STAT_KEYS.map((key) => ({
				label: key,
				value: formatModifier(character.stats[key]?.value),
				stepId: 'stats'
			}))
		},
		{
			title: 'Moves & gear',
			items: [
				{ label: 'Moves', value: moves.join(', '), stepId: 'moves' },
				{ label: 'Possessions', value: possessions.join(', '), stepId: 'possessions' }
			]
		}
	];
}
