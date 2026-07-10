/**
 * The Stonetop game module — first game in the framework; served as
 * "Ringwall" at `/g/stonetop`.
 *
 * Contributes identity, pack schemas, the pure rules engine, and its entity
 * types. The shell treats `engine` as opaque; only Stonetop's own step/sheet
 * code reaches into it with types.
 *
 * Entity types:
 * - **character** — built through the wizard, rendered by a sheet, edited in
 *   play mode.
 * - **steading** — no wizard; it's an editable tracker sheet from birth, so its
 *   editor lives in the `playComponent` slot (phase 6). Its read-only print
 *   sheet lands in commit 48.
 */

import type { Component } from 'svelte';
import type { EntityTypeModule, GameModule, PlayProps, SheetProps } from '../types';
import { schemaFor } from './pack-schemas';
import { engine, SCHEMA_VERSION, type StonetopCharacter } from './engine';
import { STEADING_SCHEMA_VERSION, createSteading, type StonetopSteading } from './engine/steading';
import { stonetopWizardSteps } from './wizard/steps';
import CharacterSheet from './sheet/CharacterSheet.svelte';
import PlayMode from './play/PlayMode.svelte';
import SteadingEditor from './steading/SteadingEditor.svelte';

// Contained cast: the sheet/play components type `character` as
// StonetopCharacter, the shell slot as the opaque `SheetProps`/`PlayProps` —
// Svelte props are contravariant, so this is the single erasure, mirroring
// `defineWizardStep`.
const character: EntityTypeModule = {
	label: 'Character',
	wizardSteps: stonetopWizardSteps,
	newDraft: () => engine.createCharacter(),
	entityMeta: (draft) => {
		const c = draft as StonetopCharacter;
		return {
			name: c.name?.trim() || 'Unnamed hero',
			schemaVersion: c.schemaVersion ?? SCHEMA_VERSION
		};
	},
	sheetComponent: CharacterSheet as unknown as Component<SheetProps>,
	playComponent: PlayMode as unknown as Component<PlayProps>
};

const steading: EntityTypeModule = {
	label: 'Steading',
	newDraft: () => createSteading(),
	entityMeta: (draft) => {
		const st = draft as StonetopSteading;
		return {
			name: st.name?.trim() || 'Unnamed steading',
			schemaVersion: st.schemaVersion ?? STEADING_SCHEMA_VERSION
		};
	},
	// Editor-first: the tracker sheet is the play component; the read-only print
	// sheet (sheetComponent) arrives in commit 48.
	playComponent: SteadingEditor as unknown as Component<PlayProps>
};

export const stonetop: GameModule = {
	id: 'stonetop',
	name: 'Stonetop',
	packSchemas: schemaFor,
	engine,
	entityTypes: { character, steading }
};
