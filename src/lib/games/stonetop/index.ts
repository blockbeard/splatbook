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
 *   editor lives in the `playComponent` slot, with a read-only print sheet in
 *   the `sheetComponent` slot (phase 6).
 */

import type { Component } from 'svelte';
import type { EntityTypeModule, GameModule, GmGuideProps, PlayProps, SheetProps } from '../types';
// The game's own skin. Scoped to `[data-game="stonetop"]`, which the shell
// stamps on the game's routes — inert everywhere else.
import './theme.css';
import { schemaFor } from './pack-schemas';
import { engine, SCHEMA_VERSION, type StonetopCharacter } from './engine';
import { STEADING_SCHEMA_VERSION, createSteading, type StonetopSteading } from './engine/steading';
import { THREAT_SCHEMA_VERSION, createThreat, type StonetopThreat } from './engine/threat';
import { stonetopWizardSteps } from './wizard/steps';
import { stonetopSummary } from './wizard/summary';
import CharacterSheet from './sheet/CharacterSheet.svelte';
import PlayMode from './play/PlayMode.svelte';
import SteadingEditor from './steading/SteadingEditor.svelte';
import SteadingSheet from './steading/SteadingSheet.svelte';
import ThreatEditor from './gm/ThreatEditor.svelte';
import ThreatSheet from './gm/ThreatSheet.svelte';
import GmGuide from './gm/GmGuide.svelte';
import { GM_SECTIONS } from './gm/sections';
import { stonetopDice } from './dice';

// Contained cast: the sheet/play components type `character` as
// StonetopCharacter, the shell slot as the opaque `SheetProps`/`PlayProps` —
// Svelte props are contravariant, so this is the single erasure, mirroring
// `defineWizardStep`.
const character: EntityTypeModule = {
	label: 'Character',
	wizardSteps: stonetopWizardSteps,
	summary: stonetopSummary,
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
	// sheet is the sheet component.
	playComponent: SteadingEditor as unknown as Component<PlayProps>,
	sheetComponent: SteadingSheet as unknown as Component<SheetProps>
};

// A GM threat worksheet — the third entity type. Editor-first like a steading:
// no wizard, edited in place from creation, with a read-only print sheet.
const threat: EntityTypeModule = {
	label: 'Threat',
	newDraft: () => createThreat(),
	entityMeta: (draft) => {
		const th = draft as StonetopThreat;
		return {
			name: th.name?.trim() || 'Unnamed threat',
			schemaVersion: th.schemaVersion ?? THREAT_SCHEMA_VERSION
		};
	},
	playComponent: ThreatEditor as unknown as Component<PlayProps>,
	sheetComponent: ThreatSheet as unknown as Component<SheetProps>
};

export const stonetop: GameModule = {
	id: 'stonetop',
	name: 'Stonetop',
	packSchemas: schemaFor,
	engine,
	entityTypes: { character, steading, threat },
	// PbtA move rolls (2d6 + stat) offered as generic dice presets (phase 10).
	dice: stonetopDice,
	// The GM playbook as an in-app reference guide (phase 7): agenda, moves,
	// procedures, interactive tables, flow diagrams. Read-only, so it's not an
	// entity type — the shell serves it at `/g/stonetop/gm`.
	gmGuide: {
		packFile: 'data/the-gm.json',
		sections: GM_SECTIONS,
		component: GmGuide as unknown as Component<GmGuideProps>
	}
};
