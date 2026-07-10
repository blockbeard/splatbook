/**
 * The GameModule boundary — the only door between the shell and game code.
 *
 * See `docs/architecture.md`: the shell touches game code exclusively through
 * this interface; game modules never import each other; every game-visible
 * string lives in the game's content pack, not in app code.
 *
 * Fields beyond `id`/`name`/`packSchemas` are placeholders that firm up as
 * their phases arrive (wizard and sheet in phase 3, engine alongside them).
 * They are typed loosely on purpose: no universal character model — shapes
 * get abstracted only when a second game forces it.
 */

import type { Component } from 'svelte';
import type { SchemaResolver } from '../packs/harness';
import type { WizardStep } from '../wizard/types';

/** Props the shell passes a game's character-sheet component. The draft/entity
 * is opaque to the shell (the game's own shape); the sheet casts it. */
export interface SheetProps {
	character: object;
}

/**
 * Props the shell passes a game's play-mode component. `character` is the opaque
 * saved/draft entity; `onChange` hands a new version back for the shell to
 * autosave. Play mode is the editable counterpart to the read-only sheet — the
 * game owns what "editing" means (mark HP, spend XP, level up); the shell only
 * persists whatever the game returns.
 */
export interface PlayProps {
	character: object;
	onChange: (next: object) => void;
}

export interface GameModule {
	/** Game id, kebab-case. Matches the content-pack folder and the `/g/[game]` URL segment. */
	id: string;
	/** Display name of the game. */
	name: string;
	/** Per-file Zod schemas for this game's content pack; wired into the validation harness on registration. */
	packSchemas: SchemaResolver;
	/** Pure rules engine — owned by the game, opaque to the shell. Arrives in phase 3. */
	engine?: unknown;
	/** Ordered character-wizard steps, rendered by the generic wizard shell. Steps
	 * populate as the phase-3 commits land; built with `defineWizardStep`. */
	wizardSteps?: readonly WizardStep[];
	/** Seed a blank wizard draft (the game's own entity shape). The shell renders
	 * it opaquely; the game owns what's inside. Required to run the wizard. */
	newDraft?: () => object;
	/**
	 * Surface the columns the shell persists for a saved entity without the shell
	 * ever parsing the opaque `data` blob: a display `name`, the `entityType`
	 * (character/steading/…), and the game's own `schemaVersion` for this shape.
	 * Required for a game's entities to be saved/loaded. */
	entityMeta?: (draft: object) => { name: string; entityType: string; schemaVersion: number };
	/** Character-sheet component, rendered from a saved/finished draft. */
	sheetComponent?: Component<SheetProps>;
	/** Play-mode component: the editable counterpart to the sheet (trackers,
	 * advancement). Arrives in phase 5; the shell autosaves whatever it returns. */
	playComponent?: Component<PlayProps>;
}
