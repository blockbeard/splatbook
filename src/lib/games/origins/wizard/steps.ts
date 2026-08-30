/**
 * Origins' wizard steps, in the order the post builds a character:
 * background (with its reference class) → species → ability scores →
 * equipment → spells → details → review.
 *
 * The spells step is always present rather than conditionally inserted: the
 * wizard shell renders a fixed sequence, and a step that vanishes for
 * non-casters reads as a bug. It says why it has nothing to offer instead.
 */

import { defineWizardStep, type WizardStep } from '$lib/wizard';
import type { OriginsCharacter } from '../engine';
import BackgroundStep from './BackgroundStep.svelte';
import SpeciesStep from './SpeciesStep.svelte';
import AbilitiesStep from './AbilitiesStep.svelte';
import EquipmentStep from './EquipmentStep.svelte';
import SpellsStep from './SpellsStep.svelte';
import DetailsStep from './DetailsStep.svelte';
import ReviewStep from './ReviewStep.svelte';

export const originsWizardSteps: readonly WizardStep[] = [
	defineWizardStep<OriginsCharacter>({
		id: 'background',
		title: 'Background',
		component: BackgroundStep
	}),
	defineWizardStep<OriginsCharacter>({ id: 'species', title: 'Species', component: SpeciesStep }),
	defineWizardStep<OriginsCharacter>({
		id: 'abilities',
		title: 'Abilities',
		component: AbilitiesStep
	}),
	defineWizardStep<OriginsCharacter>({
		id: 'equipment',
		title: 'Equipment',
		component: EquipmentStep
	}),
	defineWizardStep<OriginsCharacter>({ id: 'spells', title: 'Spells', component: SpellsStep }),
	defineWizardStep<OriginsCharacter>({ id: 'details', title: 'Details', component: DetailsStep }),
	defineWizardStep<OriginsCharacter>({ id: 'review', title: 'Review', component: ReviewStep })
];
