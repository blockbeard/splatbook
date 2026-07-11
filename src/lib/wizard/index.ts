/**
 * The generic wizard shell — game-agnostic step runner with a progress bar,
 * back/forward navigation, and localStorage autosave. A game module supplies
 * the ordered steps; the shell renders them without knowing the draft shape.
 */

export { default as Wizard } from './Wizard.svelte';
export {
	defineWizardStep,
	type WizardStep,
	type WizardStepProps,
	type WizardSummary,
	type WizardSummaryItem,
	type WizardSummarySection
} from './types';
export { clampIndex, nextIndex, prevIndex, isFirst, isLast, progress } from './navigation';
export { draftKey, saveDraft, loadDraft, clearDraft, type DraftStorage } from './autosave';
