/**
 * Stonetop's wizard steps, in order, registered against the generic wizard
 * shell. Each is built with `defineWizardStep` so the shell's `WizardStep`
 * slot type holds despite Svelte's contravariant component props.
 *
 * Steps land one commit at a time across phase 3 (playbook-select first);
 * append to this array as each arrives.
 */

import { defineWizardStep, type WizardStep } from '$lib/wizard';
import type { StonetopCharacter } from '../engine';
import PlaybookSelect from './PlaybookSelect.svelte';

export const stonetopWizardSteps: readonly WizardStep[] = [
	defineWizardStep<StonetopCharacter>({
		id: 'playbook',
		title: 'Playbook',
		component: PlaybookSelect
	})
];
