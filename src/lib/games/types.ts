/**
 * The GameModule boundary — the only door between the shell and game code.
 *
 * See `docs/architecture.md`: the shell touches game code exclusively through
 * this interface; game modules never import each other; every game-visible
 * string lives in the game's content pack, not in app code.
 *
 * A game contributes identity, pack schemas, an opaque rules engine, and one
 * or more **entity types** (character, steading, …). Each entity type owns its
 * own create/edit/render slots; the shell iterates the map rather than
 * branching on type. The map arrived in phase 6 when steadings became the
 * second entity type — the discipline is "abstract when a second instance
 * forces it," and it did. No universal *content* model: the shapes inside each
 * entity type stay the game's own.
 */

import type { Component } from 'svelte';
import type { SchemaResolver } from '../packs/harness';
import type { WizardStep } from '../wizard/types';

/** Props the shell passes a game's entity-sheet component. The draft/entity is
 * opaque to the shell (the game's own shape); the sheet casts it. */
export interface SheetProps {
	character: object;
}

/**
 * Props the shell passes a game's play/editor component. `character` is the
 * opaque saved/draft entity; `onChange` hands a new version back for the shell
 * to autosave. Play mode is the editable counterpart to the read-only sheet —
 * the game owns what "editing" means (mark HP and spend XP for a character;
 * step trackers and complete improvements for a steading); the shell only
 * persists whatever the game returns.
 */
export interface PlayProps {
	character: object;
	onChange: (next: object) => void;
}

/**
 * One entity type a game contributes (character, steading, …). Every slot is
 * optional so a type can be as small as it needs: a character has a step
 * wizard, a read-only sheet, and a play mode; a steading skips the wizard —
 * it's an editable tracker sheet from birth, so its editor lives in the `play`
 * slot and `wizardSteps` stays empty.
 *
 * The map key is the persisted `entityType`; it is not repeated here.
 */
export interface EntityTypeModule {
	/** Display label for this type, e.g. "Character", "Steading". */
	label: string;
	/** Seed a blank draft (the game's own shape). Required to create one. */
	newDraft?: () => object;
	/**
	 * Surface the columns the shell persists for a saved entity without the shell
	 * ever parsing the opaque `data` blob: a display `name` and the game's own
	 * `schemaVersion` for this shape. The `entityType` is the map key. Required
	 * for this type's entities to be saved/loaded.
	 */
	entityMeta?: (draft: object) => { name: string; schemaVersion: number };
	/** Ordered wizard steps, rendered by the generic wizard shell. Present for
	 * types built through a create-flow (characters); absent for editor-first
	 * types (steadings). Built with `defineWizardStep`. */
	wizardSteps?: readonly WizardStep[];
	/** Read-only sheet, rendered from a saved/finished draft (print view). */
	sheetComponent?: Component<SheetProps>;
	/** Play/editor component: the editable counterpart to the sheet. The shell
	 * autosaves whatever it returns. */
	playComponent?: Component<PlayProps>;
}

/** Props the shell passes a game's GM-guide component. `data` is the game's GM
 * reference pack (opaque to the shell; the game casts it); `section` is which
 * page to render — always one of `gmGuide.sections[].id`. */
export interface GmGuideProps {
	data: unknown;
	section: string;
}

/**
 * A game's GM-facing reference guide (phase 7): the running-the-game material
 * that isn't a build/tracker sheet — agenda, moves, procedures, interactive
 * tables, flow diagrams. Read-only reference, so it sits outside the entity-type
 * map (nothing is saved). The `sections` list is the serialisable nav the shell
 * renders in the sidebar and routes on (`/g/[game]/gm/[section]`); the shell
 * never inspects the pack `data` — the game's `component` renders each section.
 */
export interface GmGuideModule {
	/** Pack-relative path to the guide's reference data, e.g. `data/the-gm.json`.
	 * The shell fetches `/content-packs/<game>/<packFile>` and hands the parsed
	 * JSON to `component` as opaque `data` — it never inspects the shape. */
	packFile: string;
	/** Ordered nav sections (stable id + display title). */
	sections: readonly { id: string; title: string }[];
	/** Renders one section of the guide, given the pack data and the section id. */
	component: Component<GmGuideProps>;
}

export interface GameModule {
	/** Game id, kebab-case. Matches the content-pack folder and the `/g/[game]` URL segment. */
	id: string;
	/** Display name of the game. */
	name: string;
	/** Per-file Zod schemas for this game's content pack; wired into the validation harness on registration. */
	packSchemas: SchemaResolver;
	/** Pure rules engine — owned by the game, opaque to the shell. */
	engine?: unknown;
	/** The entity types this game contributes, keyed by persisted `entityType`
	 * (`character`, `steading`, …). The shell iterates this map; it never hard-codes
	 * a type. A game needs at least one entry to do anything user-facing. */
	entityTypes: Record<string, EntityTypeModule>;
	/** Optional GM reference guide, surfaced at `/g/[game]/gm`. Absent for games
	 * with no GM material. */
	gmGuide?: GmGuideModule;
}
