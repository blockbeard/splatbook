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
			note: z.string().optional(),
			/** Gate on a tracker's marks: the Would-be Hero's Superior Stat needs
			 * all 6 marks in Potential for Greatness. `move` names the tracker-bearing
			 * move; `count` is the minimum marks required. */
			tracker: z.strictObject({ move: id, count: z.number().int() }).optional()
		})
		.optional(),
	tracker: trackerSchema.optional(),
	/** Id of the parent move this one sits under on the sheet. */
	childOf: id.optional(),
	/** Taking this move retires the named one. */
	replaces: id.optional(),
	/** The Would-be Hero's asterisk rule. */
	asterisk: z.boolean().optional(),
	/** Taking this move raises one stat by +1, up to `cap` (Improved Stat +2,
	 * Superior Stat +3). The player picks which stat on Level Up. */
	statBump: z.strictObject({ cap: z.number().int() }).optional()
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
export type Choice = z.infer<typeof choiceSchema>;
export type SubChoice = z.infer<typeof subChoiceSchema>;
export type Move = z.infer<typeof moveSchema>;
export type Item = z.infer<typeof itemSchema>;
export type PlaybookSection = z.infer<typeof sectionSchema>;

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

/** Tags/ammo lists carried by gear and small items. */
const tagList = z.array(z.string());

/** The standard Inventory sheet (insert-inventory.json). Firmed up in phase 5
 * (play mode's Outfit view). `slots` = number of ◇ an item occupies. */
const gearSchema = z.strictObject({
	name: z.string().min(1),
	slots: z.number().int().positive(),
	uses: z.string().optional(),
	note: z.string().optional(),
	text: z.string().optional(),
	tags: tagList.optional(),
	ammo: tagList.optional()
});

const smallItemSchema = z.strictObject({
	/** Empty string with `writeIn` = blank write-in lines. */
	name: z.string(),
	text: z.string().optional(),
	uses: z.number().int().optional(),
	tags: tagList.optional(),
	ammo: tagList.optional(),
	writeIn: z.literal(true).optional(),
	/** How many blank write-in lines this entry represents. */
	count: z.number().int().optional()
});

export const inventoryInsertSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: z.union([id, z.literal('all')]),
	source: sourceSchema,
	outfit: z.strictObject({
		text: markdown,
		loads: z.array(
			z.strictObject({
				name: z.string().min(1),
				tags: tagList.optional(),
				/** Mark range as printed: "up to 3", "4-6", "7-9". */
				marks: z.string().min(1)
			})
		),
		undefinedSlots: z.number().int().nonnegative(),
		undefinedText: markdown
	}),
	gear: z.array(gearSchema).min(1),
	writeIns: z.strictObject({
		possessions: z.strictObject({
			title: z.string().min(1),
			lines: z.array(z.number().int())
		}),
		otherThings: z.strictObject({ title: z.string().min(1), text: z.string() })
	}),
	smallItems: z.strictObject({
		text: markdown,
		undefinedSlots: z.number().int().nonnegative(),
		undefinedText: markdown,
		options: z.array(smallItemSchema).min(1)
	}),
	prosperity: z.array(z.strictObject({ value: z.number().int(), note: z.string().optional() }))
});

export type InventoryInsert = z.infer<typeof inventoryInsertSchema>;
export type Gear = z.infer<typeof gearSchema>;
export type SmallItem = z.infer<typeof smallItemSchema>;

/** One Resources/Fortifications-style starting list with its write-in count. */
const startingListSchema = z.strictObject({
	starting: z.array(z.string().min(1)),
	writeIns: z.number().int().nonnegative()
});

/** A steading numeric stat: a start value and an optional printed range. */
const steadingStatSchema = z.strictObject({
	start: z.number().int(),
	range: z.tuple([z.number().int(), z.number().int()]).optional()
});

/**
 * One Improvement requirement entry: a plain string, or a `{ text, boxes }`
 * multi-box "Pull Together" requirement (the boxes are the ◇ to tick).
 */
const requirementEntrySchema = z.union([
	z.string().min(1),
	z.strictObject({ text: z.string().min(1), boxes: z.number().int().positive().optional() })
]);

/**
 * The `requires` block of an Improvement. Every combinator the printed sheet
 * uses: `all` (do them all), `either`/`orAll` (this one OR all of those),
 * `pick` N of `options`, `andThen` follow-ups, `andEstablish` a nested pick,
 * `perTactic` drilling across `tactics`, and `inOrder` for sequenced steps.
 */
const requiresSchema = z.strictObject({
	all: z.array(requirementEntrySchema).optional(),
	either: z.array(requirementEntrySchema).optional(),
	orAll: z.array(requirementEntrySchema).optional(),
	pick: z.number().int().positive().optional(),
	options: z.array(requirementEntrySchema).optional(),
	andThen: z.array(requirementEntrySchema).optional(),
	andEstablish: z
		.strictObject({ pick: z.number().int().positive(), options: z.array(requirementEntrySchema) })
		.optional(),
	perTactic: z.string().min(1).optional(),
	tactics: z.array(requirementEntrySchema).optional(),
	inOrder: z.boolean().optional()
});

/** One catalogue Improvement: flavour summary, requirement tree, effects text. */
const improvementSchema = z.strictObject({
	id,
	name: z.string().min(1),
	summary: z.string().min(1),
	requires: requiresSchema,
	effects: markdown
});

/** The steading sheet — the second entity type's pack data (phase 6). */
export const steadingSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('steading'),
	source: sourceSchema,
	stats: z.strictObject({
		fortunes: steadingStatSchema,
		surplus: steadingStatSchema,
		size: z.strictObject({
			start: z.string().min(1),
			options: z.array(
				z.strictObject({ id, label: z.string().min(1), note: z.string().optional() })
			)
		}),
		population: steadingStatSchema,
		prosperity: steadingStatSchema,
		defenses: steadingStatSchema
	}),
	resources: startingListSchema,
	fortifications: startingListSchema,
	debilities: z.array(
		z.strictObject({
			id,
			name: z.string().min(1),
			cause: z.string().min(1),
			effect: z.string().min(1)
		})
	),
	placesOfInterest: z.strictObject({
		starting: z.array(z.strictObject({ marker: z.string().min(1), name: z.string().min(1) })),
		writeInMarkers: z.array(z.string().min(1))
	}),
	content: z.strictObject({
		text: markdown,
		lists: z.array(z.strictObject({ id, title: z.string().min(1), note: z.string().optional() }))
	}),
	improvements: z.array(improvementSchema).min(1),
	otherImprovements: z.strictObject({
		text: z.string().min(1),
		blankCards: z.number().int().nonnegative(),
		cardFields: z.array(z.string().min(1))
	}),
	assets: z.strictObject({
		text: z.string().min(1),
		starting: z.array(z.string().min(1)),
		writeIns: z.number().int().nonnegative(),
		treasure: z.strictObject({
			silver: z.array(z.string().min(1)),
			gold: z.array(z.string().min(1))
		})
	}),
	residents: z.strictObject({
		text: z.string().min(1),
		columns: z.array(z.string().min(1)),
		prefilledOccupations: z.array(z.string().min(1)),
		names: z.array(z.string().min(1)),
		npcTraits: z.array(z.string().min(1))
	}),
	neighbors: z.strictObject({
		text: z.string().min(1),
		columns: z.array(z.string().min(1)),
		places: z.array(
			z.strictObject({
				name: z.string().min(1),
				note: z.string().optional(),
				namesNote: z.string().optional(),
				names: z.array(z.string().min(1))
			})
		)
	})
});

export type SteadingPack = z.infer<typeof steadingSchema>;
export type SteadingImprovement = z.infer<typeof improvementSchema>;
export type SteadingRequires = z.infer<typeof requiresSchema>;
export type RequirementEntry = z.infer<typeof requirementEntrySchema>;

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
	if (relPath === 'data/insert-inventory.json') return inventoryInsertSchema;
	if (/^data\/insert-[a-z-]+\.json$/.test(relPath)) return insertSchema;
	if (/^data\/the-[a-z-]+\.json$/.test(relPath)) return playbookSchema;
	// Generated rules reference (build_srd.py): one document tree per book.
	if (/^rules\/[a-z0-9-]+\.json$/.test(relPath)) return documentTreeSchema;
	return null;
}
