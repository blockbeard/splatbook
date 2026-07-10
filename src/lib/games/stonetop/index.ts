/**
 * The Stonetop game module — first game in the framework; served as
 * "Ringwall" at `/g/stonetop`.
 *
 * Contributes identity, pack schemas, and (phase 3) the pure rules engine.
 * Wizard steps and sheet component fill their slots as the phase-3 commits
 * land. The shell treats `engine` as opaque; only Stonetop's own step/sheet
 * code reaches into it with types.
 */

import type { Component } from 'svelte';
import type { GameModule, SheetProps } from '../types';
import { schemaFor } from './pack-schemas';
import { engine, SCHEMA_VERSION, type StonetopCharacter } from './engine';
import { stonetopWizardSteps } from './wizard/steps';
import CharacterSheet from './sheet/CharacterSheet.svelte';

export const stonetop: GameModule = {
	id: 'stonetop',
	name: 'Stonetop',
	packSchemas: schemaFor,
	engine,
	wizardSteps: stonetopWizardSteps,
	newDraft: () => engine.createCharacter(),
	entityMeta: (draft) => {
		const c = draft as StonetopCharacter;
		return {
			name: c.name?.trim() || 'Unnamed hero',
			entityType: 'character',
			schemaVersion: c.schemaVersion ?? SCHEMA_VERSION
		};
	},
	// Contained cast: the sheet types `character` as StonetopCharacter, the shell
	// slot as the opaque `SheetProps` — Svelte props are contravariant, so this is
	// the single erasure, mirroring `defineWizardStep`.
	sheetComponent: CharacterSheet as unknown as Component<SheetProps>
};
