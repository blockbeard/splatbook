/**
 * Zod schemas for the Stonetop content pack, written from the pack's own
 * `SCHEMA.md` (Stonetop 2nd printing, Book I ch. 4).
 *
 * Strictness policy:
 * - Character playbooks (`the-<playbook>.json`) validate strictly — every key
 *   and shape — because the wizard and engine (phase 3) consume them directly.
 * - Inserts, the steading, and the GM playbook use "looser, purpose-built
 *   shapes" (SCHEMA.md's words): the envelope and top-level structure are
 *   checked, interiors stay `unknown` until the phase that consumes them
 *   (play mode 5, steading 6, GM tools 7) firms them up.
 *
 * Text fields carry Markdown emphasis; wording matches the 2nd printing.
 */

import { z } from 'zod';
import { documentTreeSchema } from '../../reference/document-tree';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case');
/** Prose fields — may carry Markdown emphasis. */
const markdown = z.string().min(1);

/** Where in the printed material this data comes from. */
const sourceSchema = z.strictObject({
	book: z.string().optional(),
	pages: z.array(z.number().int()).optional(),
	printing: z.number().int(),
	pdf: z.string().optional(),
	note: z.string().optional()
});

/** Use-boxes printed on the sheet, e.g. `{ boxes: 4, label: "Boon" }`. */
const trackerSchema = z.strictObject({
	boxes: z.number().int().positive(),
	label: z.string().min(1)
});

/** One nested pick, e.g. "Who are they? Choose 2 or 3:". */
const subChoiceSchema = z.strictObject({
	id,
	prompt: z.string().min(1),
	min: z.number().int(),
	max: z.number().int(),
	options: z.array(
		z.strictObject({
			label: z.string().min(1),
			/** Picking this option grants a move (e.g. Marshal crew tags). */
			grantsMove: id.optional(),
			/** Blank "discuss with the GM" style option. */
			writeIn: z.literal(true).optional()
		})
	),
	/** Entries that come regardless of the pick. */
	fixed: z.array(z.string()).optional()
});

/** Backgrounds and instincts. A final `custom: true` entry is a write-in. */
const choiceSchema = z.strictObject({
	id,
	name: z.string(),
	text: markdown.optional(),
	custom: z.literal(true).optional(),
	grants: z
		.strictObject({
			moves: z.array(id).optional(),
			notes: z.array(z.string()).optional()
		})
		.optional(),
	choices: z.array(subChoiceSchema).optional(),
	tracker: trackerSchema.optional()
});

const moveSchema = z.strictObject({
	id,
	name: z.string().min(1),
	text: markdown,
	/** Omitted = may be taken once. */
	maxTakes: z.number().int().optional(),
	requires: z
		.strictObject({
			level: z.number().int().optional(),
			moves: z.array(id).optional(),
			/** Non-mechanical requirement prose, e.g. "the Blessed". */
			note: z.string().optional()
		})
		.optional(),
	tracker: trackerSchema.optional(),
	/** Id of the parent move this one sits under on the sheet. */
	childOf: id.optional(),
	/** Taking this move retires the named one. */
	replaces: id.optional(),
	/** The Would-be Hero's asterisk rule. */
	asterisk: z.boolean().optional()
});

const itemSchema = z.strictObject({
	/** Empty string = blank write-in line on the sheet. */
	name: z.string(),
	text: markdown.optional(),
	tags: z.array(z.string()).optional(),
	uses: z.number().int().optional(),
	load: z.number().int().optional(),
	fixed: z.literal(true).optional(),
	writeIn: z.literal(true).optional(),
	choices: z.array(subChoiceSchema).optional(),
	statblock: z
		.strictObject({
			hp: z.number().int(),
			damage: z.string(),
			tags: z.array(z.string()),
			instinct: z.string(),
			cost: z.string()
		})
		.optional()
});

/** Playbook-specific back-page sections (sacred pouch, tall tales, chronicle…). */
const sectionSchema = z.strictObject({
	id,
	title: z.string().min(1),
	text: z.string().optional(),
	choices: z.array(subChoiceSchema).optional(),
	/** Like `appearance`: one array per printed line, pick 1 per line. */
	lines: z.array(z.array(z.string())).optional(),
	prompts: z.array(z.string()).optional()
});

export const playbookSchema = z.strictObject({
	id,
	name: z.string().min(1),
	flavor: markdown,
	source: sourceSchema,
	backgrounds: z.array(choiceSchema).min(1),
	instincts: z.array(choiceSchema).min(1),
	appearance: z.array(z.array(z.string())),
	origins: z.strictObject({
		prompt: z.string().min(1),
		options: z.array(
			z.strictObject({
				label: z.string().min(1),
				names: z.array(z.string()),
				note: z.string().optional()
			})
		)
	}),
	stats: z.strictObject({
		array: z.array(z.number().int()),
		debilities: z.array(z.strictObject({ name: z.string(), stats: z.array(z.string()) }))
	}),
	base: z.strictObject({ damage: z.string(), maxHp: z.number().int().positive() }),
	moves: z.strictObject({
		starting: z.strictObject({
			fixed: z.array(id).optional(),
			/** Moves granted by the chosen background: a count, or `true` for "whatever it grants". */
			fromBackground: z.union([z.number().int(), z.boolean()]).optional(),
			choose: z.number().int().optional(),
			/** Groups of ids: pick exactly one from each group. */
			pickOne: z.array(z.array(id)).optional()
		}),
		list: z.array(moveSchema).min(1),
		/** Rules note for the whole moves section (Would-be Hero's asterisk rule). */
		note: z.string().optional()
	}),
	possessions: z.strictObject({
		prompt: z.string().min(1),
		pick: z.number().int(),
		fixed: z.array(itemSchema).optional(),
		options: z.array(itemSchema)
	}),
	extras: z.array(sectionSchema),
	introductions: z.strictObject({
		intro: markdown,
		steps: z.array(
			z.strictObject({
				n: z.number().int(),
				text: markdown,
				questions: z.array(z.string()).optional()
			})
		)
	})
});

export type Playbook = z.infer<typeof playbookSchema>;

/**
 * Inserts (followers, crew, inventory, ghost/revenant/thrall…): strict
 * envelope, loose interior until the consuming phase arrives.
 */
export const insertSchema = z.looseObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	/** Playbook id this insert belongs to, or "all". */
	appliesTo: z.union([id, z.literal('all')]),
	source: sourceSchema
});

/** The steading sheet. Top-level keys pinned; interiors firm up in phase 6. */
export const steadingSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('steading'),
	source: sourceSchema,
	stats: z.unknown(),
	resources: z.unknown(),
	fortifications: z.unknown(),
	debilities: z.unknown(),
	placesOfInterest: z.unknown(),
	content: z.unknown(),
	improvements: z.array(z.unknown()).min(1),
	otherImprovements: z.unknown(),
	assets: z.unknown(),
	residents: z.unknown(),
	neighbors: z.unknown()
});

/** The GM playbook as reference data. Top-level keys pinned; interiors firm up in phase 7. */
export const gmSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('gm'),
	source: sourceSchema,
	agenda: z.unknown(),
	coreLoop: z.unknown(),
	gmMoves: z.unknown(),
	principles: z.unknown(),
	damageAndDebilities: z.unknown(),
	content: z.unknown(),
	threats: z.unknown(),
	iWonder: z.unknown(),
	expeditions: z.unknown(),
	sites: z.unknown(),
	discoveries: z.unknown(),
	hazards: z.unknown(),
	monsters: z.unknown(),
	npcs: z.unknown(),
	followers: z.unknown(),
	homefront: z.unknown(),
	aftermath: z.unknown(),
	downtime: z.unknown(),
	relativeValue: z.unknown(),
	flowOfPlay: z.unknown()
});

/** Schema resolver for the harness: pack-relative path → schema. */
export function schemaFor(relPath: string): z.ZodType | null {
	if (relPath === 'data/the-steading.json') return steadingSchema;
	if (relPath === 'data/the-gm.json') return gmSchema;
	if (/^data\/insert-[a-z-]+\.json$/.test(relPath)) return insertSchema;
	if (/^data\/the-[a-z-]+\.json$/.test(relPath)) return playbookSchema;
	// Generated rules reference (build_srd.py): one document tree per book.
	if (/^rules\/[a-z0-9-]+\.json$/.test(relPath)) return documentTreeSchema;
	return null;
}
