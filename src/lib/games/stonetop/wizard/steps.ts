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
import BackgroundStep from './BackgroundStep.svelte';
import InstinctStep from './InstinctStep.svelte';
import AppearanceStep from './AppearanceStep.svelte';
import OriginStep from './OriginStep.svelte';
import StatsStep from './StatsStep.svelte';
import MovesStep from './MovesStep.svelte';
import PossessionsStep from './PossessionsStep.svelte';
import ExtrasStep from './ExtrasStep.svelte';

export const stonetopWizardSteps: readonly WizardStep[] = [
	defineWizardStep<StonetopCharacter>({
		id: 'playbook',
		title: 'Playbook',
		component: PlaybookSelect
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'background',
		title: 'Background',
		component: BackgroundStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'instinct',
		title: 'Instinct',
		component: InstinctStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'appearance',
		title: 'Appearance',
		component: AppearanceStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'origin',
		title: 'Origin',
		component: OriginStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'stats',
		title: 'Stats',
		component: StatsStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'moves',
		title: 'Moves',
		component: MovesStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'possessions',
		title: 'Possessions',
		component: PossessionsStep
	}),
	defineWizardStep<StonetopCharacter>({
		id: 'extras',
		title: 'Details',
		component: ExtrasStep
	})
];
