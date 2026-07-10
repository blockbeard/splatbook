/**
 * Character validation — the skeleton the wizard steps hang their rules on.
 *
 * Each wizard step owns a validator: a pure function from a character (and the
 * playbook it's being built against) to a list of issues. Most are empty stubs
 * now and firm up in their own commits (playbook-select in 21, background in
 * 22, …); the composition, issue shape, and severity model are settled here so
 * later commits only fill bodies in.
 *
 * The playbook is typed loosely (`Playbook | null`) because a draft may not
 * have one yet, and the validators tolerate a missing pack rather than throw —
 * an incomplete character is a normal state, not an error.
 */

import type { Playbook } from '../pack-schemas';
import { SCHEMA_VERSION, type StonetopCharacter } from './character';
import { isSelectionValid } from './choices';
import { isStatArrayComplete } from './stats';

/** Which wizard step an issue belongs to — lets the UI route it to the right screen. */
export type StepId =
	| 'schema'
	| 'playbook'
	| 'background'
	| 'instinct'
	| 'appearance'
	| 'origin'
	| 'stats'
	| 'moves'
	| 'possessions'
	| 'extras'
	| 'introductions';

/** `error` blocks a finished character; `warning` is advisory (e.g. an empty optional). */
export type Severity = 'error' | 'warning';

/** A single validation finding. `field` is an optional dotted path for the UI to focus. */
export interface Issue {
	step: StepId;
	severity: Severity;
	message: string;
	field?: string;
}

/** A per-step validator. Pure; tolerant of a `null` playbook and partial character. */
export type Validator = (character: StonetopCharacter, playbook: Playbook | null) => Issue[];

/** Persisted-shape sanity — the one check that has real teeth from day one. */
const validateSchema: Validator = (character) => {
	if (character.schemaVersion !== SCHEMA_VERSION) {
		return [
			{
				step: 'schema',
				severity: 'error',
				message: `character schemaVersion ${character.schemaVersion} does not match engine version ${SCHEMA_VERSION}`,
				field: 'schemaVersion'
			}
		];
	}
	return [];
};

const noIssues: Validator = () => [];

/** A playbook must be chosen; nothing downstream is meaningful without one. */
const validatePlaybook: Validator = (character) =>
	character.playbookId
		? []
		: [{ step: 'playbook', severity: 'error', message: 'Choose a playbook.', field: 'playbookId' }];

/** A background must be chosen and each of its nested picks satisfied. */
const validateBackground: Validator = (character, playbook) => {
	if (!playbook) return [];
	if (!character.backgroundId) {
		return [
			{
				step: 'background',
				severity: 'error',
				message: 'Choose a background.',
				field: 'backgroundId'
			}
		];
	}
	const background = playbook.backgrounds.find((b) => b.id === character.backgroundId);
	if (!background) {
		return [
			{
				step: 'background',
				severity: 'error',
				message: 'Unknown background.',
				field: 'backgroundId'
			}
		];
	}
	const issues: Issue[] = [];
	for (const choice of background.choices ?? []) {
		if (!isSelectionValid(choice, character.backgroundChoices[choice.id])) {
			issues.push({
				step: 'background',
				severity: 'error',
				message: `${choice.prompt} (choose ${choice.min}–${choice.max}).`,
				field: `backgroundChoices.${choice.id}`
			});
		}
	}
	return issues;
};

/** An instinct must be chosen; the write-in instinct needs its text. */
const validateInstinct: Validator = (character, playbook) => {
	if (!playbook) return [];
	if (!character.instinctId) {
		return [
			{ step: 'instinct', severity: 'error', message: 'Choose an instinct.', field: 'instinctId' }
		];
	}
	const instinct = playbook.instincts.find((i) => i.id === character.instinctId);
	if (!instinct) {
		return [
			{ step: 'instinct', severity: 'error', message: 'Unknown instinct.', field: 'instinctId' }
		];
	}
	if (instinct.custom && !character.instinctWriteIn.trim()) {
		return [
			{
				step: 'instinct',
				severity: 'error',
				message: 'Write your instinct.',
				field: 'instinctWriteIn'
			}
		];
	}
	return [];
};

/** Every appearance line needs exactly one pick. */
const validateAppearance: Validator = (character, playbook) => {
	if (!playbook) return [];
	const issues: Issue[] = [];
	playbook.appearance.forEach((_line, i) => {
		if (!character.appearance[i]) {
			issues.push({
				step: 'appearance',
				severity: 'error',
				message: `Pick an appearance detail (line ${i + 1}).`,
				field: `appearance.${i}`
			});
		}
	});
	return issues;
};

/** An origin must be chosen and the character named. */
const validateOrigin: Validator = (character, playbook) => {
	if (!playbook) return [];
	const issues: Issue[] = [];
	if (!character.origin.option) {
		issues.push({
			step: 'origin',
			severity: 'error',
			message: 'Choose an origin.',
			field: 'origin.option'
		});
	}
	if (!character.name.trim()) {
		issues.push({
			step: 'origin',
			severity: 'error',
			message: 'Name your character.',
			field: 'name'
		});
	}
	return issues;
};

/** Every stat must hold one value from the playbook's array (a permutation). */
const validateStats: Validator = (character, playbook) => {
	if (!playbook) return [];
	if (!isStatArrayComplete(playbook.stats.array, character.stats)) {
		return [
			{
				step: 'stats',
				severity: 'error',
				message: 'Assign every stat from the array.',
				field: 'stats'
			}
		];
	}
	return [];
};

/**
 * The validator table, one entry per step. Steps arriving later in phase 3
 * replace their `noIssues` stub with real rules; `validateCharacter` composes
 * whatever is registered, so wiring never changes as bodies fill in.
 */
export const validators: Record<Exclude<StepId, 'schema'>, Validator> = {
	playbook: validatePlaybook,
	background: validateBackground,
	instinct: validateInstinct,
	appearance: validateAppearance,
	origin: validateOrigin,
	stats: validateStats,
	moves: noIssues,
	possessions: noIssues,
	extras: noIssues,
	introductions: noIssues
};

/** Run every validator and return all issues, schema check first. */
export function validateCharacter(
	character: StonetopCharacter,
	playbook: Playbook | null
): Issue[] {
	const issues = validateSchema(character, playbook);
	for (const validator of Object.values(validators)) {
		issues.push(...validator(character, playbook));
	}
	return issues;
}

/** A character is complete when it has no `error`-severity issues. */
export function isComplete(character: StonetopCharacter, playbook: Playbook | null): boolean {
	return !validateCharacter(character, playbook).some((issue) => issue.severity === 'error');
}
