/**
 * Origins 5.5e — game #3 (phase 28).
 *
 * A classless, level-less hack of SRD 5.2.1 by Patchwork Paladin: you build a
 * character out of the character-origin rules alone — a background, a species,
 * ability scores — and borrow a "reference class" for nothing but its Hit Point
 * Die, Armor Training, Shields, and Weapon Proficiencies. No class features, no
 * saving-throw proficiencies, no levels, and therefore a proficiency bonus
 * fixed at +2.
 *
 * Scoped to a character builder: one entity type, no rules reference, no GM
 * guide, no end-of-session move. The hack is one blog post and the SRD is a
 * click away, both linked from the game's front door.
 *
 * Both bodies of text are CC BY 4.0 — Origins 5.5e © 2026 Patchwork Paladin,
 * and SRD 5.2.1 © 2024 Wizards of the Coast LLC — so the pack carries one
 * licence and both credits. See the pack's LICENSE.md.
 */

import type { Component } from 'svelte';
import type { EntityTypeModule, GameModule, PlayProps, SheetProps } from '../types';
import { schemaFor } from './pack-schemas';
import { engine, SCHEMA_VERSION, type OriginsCharacter } from './engine';
import { originsWizardSteps } from './wizard/steps';
import { originsSummary } from './wizard/summary';
import CharacterSheet from './sheet/CharacterSheet.svelte';
import PlayMode from './play/PlayMode.svelte';
// The game's own skin. Scoped to `[data-game="origins"]`, which the shell
// stamps on the game's routes — inert everywhere else.
import './theme.css';

// Contained cast: the sheet/play components type `character` as
// OriginsCharacter, the shell slot as the opaque `SheetProps`/`PlayProps` —
// Svelte props are contravariant, so this is the single erasure, mirroring
// `defineWizardStep`.
const character: EntityTypeModule = {
	label: 'Character',
	wizardSteps: originsWizardSteps,
	summary: originsSummary,
	newDraft: () => engine.createCharacter(),
	entityMeta: (draft) => {
		const c = draft as OriginsCharacter;
		return {
			name: c.name?.trim() || 'Unnamed adventurer',
			schemaVersion: c.schemaVersion ?? SCHEMA_VERSION
		};
	},
	sheetComponent: CharacterSheet as unknown as Component<SheetProps>,
	playComponent: PlayMode as unknown as Component<PlayProps>
};

export const origins: GameModule = {
	id: 'origins',
	name: 'Origins 5.5e',
	packSchemas: schemaFor,
	engine,
	// One entity type, and no plans for a second: a game with no levels, no
	// settlements and no monsters in scope has nothing else to save.
	entityTypes: { character }
};
