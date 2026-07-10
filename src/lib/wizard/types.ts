/**
 * The generic wizard shell's contract — shell code, game-agnostic.
 *
 * A game module supplies an ordered list of `WizardStep`s (through its
 * `wizardSteps` slot); the shell renders them one at a time with a progress
 * bar and back/forward navigation, and autosaves the working draft. The shell
 * never inspects the draft's shape — that is the game's business — so `TDraft`
 * is opaque here and every game-visible string comes from the step components
 * (which read the content pack), not from the shell.
 */

import type { Component } from 'svelte';

/** Props every step component receives from the wizard shell. */
export interface WizardStepProps<TDraft extends object = Record<string, unknown>> {
	/** The current working draft (the game's own character/entity shape). */
	draft: TDraft;
	/** Merge a partial change into the draft; the shell autosaves the result. */
	update: (patch: Partial<TDraft>) => void;
}

/** One step in the wizard: an id, a title for the progress UI, and its component. */
export interface WizardStep<TDraft extends object = Record<string, unknown>> {
	/** Stable step id (also used for deep-linkable step routing later). */
	id: string;
	/** Short title shown in the progress indicator. */
	title: string;
	/** The component rendered when this step is active. */
	component: Component<WizardStepProps<TDraft>>;
}

/**
 * Register a typed step against the generic slot. Game modules build their
 * steps with a concrete `TDraft`; this erases the generic to the shell's
 * `WizardStep` slot type without leaking `any` into game code or forcing the
 * shell to know the draft shape. (Svelte component props are contravariant, so
 * a direct assignment of `WizardStep<Character>` to `WizardStep` is unsound in
 * general — this is the single, contained cast.)
 */
export function defineWizardStep<TDraft extends object>(step: WizardStep<TDraft>): WizardStep {
	return step as unknown as WizardStep;
}
