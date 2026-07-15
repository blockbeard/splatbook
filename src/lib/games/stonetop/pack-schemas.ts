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
	/** Taking this move rules out ever taking these (mutual exclusion — distinct
	 * from `replaces`, which retires a move you already have; `excludes` blocks
	 * a pick outright). Matches Hearthfire's vocabulary (`excludes`); not yet
	 * used by any Book I move, added now per the phase-14 vocabulary check so
	 * the day one shows up it's a data change, not a schema change mid-UI. */
	excludes: z.array(id).optional(),
	/** The Would-be Hero's asterisk rule. */
	asterisk: z.boolean().optional(),
	/** This move's own resolution says to deal your base damage die (Clash, Let
	 * Fly and kin) — the sheet renders a "Damage (dX)" button on the card,
	 * rolling `playbook.base.damage`. A move that only adds a rider on top of
	 * *another* roll's damage (e.g. "+1d4") doesn't get this; that bonus rides
	 * commit 107's custom bonus box instead, dialled in before tapping the
	 * triggering roll. */
	rollsDamage: z.boolean().optional(),
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
	/** Tracked-use box count for `uses` (e.g. Crew's Supplies: "4+Prosperity
	 * per crew member" over 6 boxes) — separate from `uses` because the label
	 * is a formula, not a number, so the box count needs its own field. */
	useTracks: z.number().int().positive().optional(),
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

/**
 * Typed insert schemas (commit 100). `insertSchema` above stays the loose
 * fallback for a future/unmodeled insert file; these are the seven that
 * commits 102-104 actually build UI against, firmed to their real interiors.
 * `insert-inventory.json` already has its own strict schema above.
 *
 * A few shapes repeat across inserts (followers, crew, initiates, and the
 * animal companion all print the same "Order Followers" / "Strengthen Your
 * Bond" rules text; Ghost and Revenant are structurally identical, differing
 * only in their book content) — shared here so one change updates every
 * insert that uses it, rather than drifting between copies.
 */

/** `appliesTo`'s value: a specific playbook id, or every character. */
const insertAppliesTo = z.union([id, z.literal('all')]);

/** Envelope-level gate beyond `appliesTo` (Animal Companion needs the move,
 * Initiates of Danu needs the background) — data for the same auto-attach
 * rules `autoAttachedInsertIds` (commit 99) evaluates in the engine. */
const insertRequiresSchema = z.strictObject({
	moves: z.array(id).optional(),
	backgrounds: z.array(id).optional()
});

/** "Order Followers" / "Strengthen Your Bond" / Animal Companion's "Loyal to
 * the End" — printed rules text attached to a follower-like insert. */
const insertRuleSchema = z.strictObject({ id, name: z.string().min(1), text: markdown });

/** Crew's tags and Animal Companion's cost/instincts: pick N of a printed
 * option list, plus a write-in count or flag. */
const pickFromListSchema = z.strictObject({
	pick: z.number().int(),
	options: z.array(z.string().min(1)).min(1),
	writeIn: z.union([z.boolean(), z.number().int()]).optional()
});

/** Same shape as `pickFromListSchema` plus the Loyalty cap every follower
 * cost-list insert prints. */
const followerCostSchema = z.strictObject({
	pick: z.number().int(),
	loyaltyMax: z.number().int(),
	options: z.array(z.string().min(1)).min(1),
	writeIn: z.union([z.boolean(), z.number().int()]).optional()
});

export const insertFollowersSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	source: sourceSchema,
	intro: markdown,
	followerBlock: z.strictObject({
		count: z.number().int(),
		fields: z.array(z.string().min(1)).min(1),
		flags: z.array(z.string().min(1)),
		moveLines: z.number().int(),
		cost: z.boolean(),
		loyaltyMax: z.number().int(),
		gearLines: z.array(z.number().int()),
		notes: z.boolean()
	}),
	reference: z.strictObject({
		playersAgenda: z.array(z.string().min(1)),
		playersPrinciples: z.array(z.string().min(1)),
		whenInDoubt: z.array(z.string().min(1)),
		triggeringMoves: markdown,
		holdAndSpend: markdown
	})
});
export type FollowersInsert = z.infer<typeof insertFollowersSchema>;

export const insertCrewSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	source: sourceSchema,
	intro: markdown,
	base: z.strictObject({
		hp: z.string().min(1),
		armor: z.number().int(),
		damage: z.string().min(1)
	}),
	tags: z.strictObject({
		text: markdown,
		fixed: z.array(z.string().min(1)),
		fromBackground: z.number().int(),
		choose: z.number().int(),
		options: z.array(z.string().min(1)).min(1),
		writeIn: z.number().int(),
		/** A tag gated behind a move, e.g. *exceptional* via Heroes to the Last. */
		special: z.array(
			z.strictObject({
				name: z.string().min(1),
				requires: z.strictObject({ moves: z.array(id) })
			})
		)
	}),
	instincts: pickFromListSchema,
	cost: followerCostSchema,
	inventory: z.strictObject({
		text: markdown,
		gear: z.array(gearSchema).min(1),
		writeIns: z.strictObject({ lines: z.array(z.number().int()) })
	}),
	individuals: z.strictObject({
		text: markdown,
		portraitBoxes: z.number().int(),
		names: z.array(z.string().min(1)).min(1),
		tags: z.array(z.string().min(1)).min(1),
		traits: z.array(z.string().min(1)).min(1)
	}),
	rules: z.array(insertRuleSchema).min(1)
});
export type CrewInsert = z.infer<typeof insertCrewSchema>;

export const insertAnimalCompanionSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	requires: insertRequiresSchema.optional(),
	source: sourceSchema,
	intro: markdown,
	fields: z.array(z.string().min(1)).min(1),
	types: z
		.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				examples: z.array(z.string().min(1)).min(1),
				hp: z.number().int(),
				armor: z.number().int(),
				armorNote: z.string().optional(),
				damage: z.string().min(1),
				damageTags: z.array(z.string().min(1)),
				startingTraits: z.array(z.string().min(1)),
				pick: z.number().int(),
				options: z.array(z.string().min(1)).min(1),
				writeIn: z.boolean().optional()
			})
		)
		.min(1),
	instincts: pickFromListSchema,
	cost: followerCostSchema,
	beastOfLegend: z.strictObject({ text: markdown, options: z.array(z.string().min(1)).min(1) }),
	rules: z.array(insertRuleSchema).min(1)
});
export type AnimalCompanionInsert = z.infer<typeof insertAnimalCompanionSchema>;

export const insertInitiatesOfDanuSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	requires: insertRequiresSchema.optional(),
	source: sourceSchema,
	intro: markdown,
	pick: z.strictObject({ min: z.number().int(), max: z.number().int() }),
	initiates: z
		.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				tags: z.array(z.string().min(1)).min(1),
				hp: z.number().int(),
				armor: z.number().int(),
				armorNote: z.string().optional(),
				damage: z.string().min(1),
				instinct: z.string().min(1),
				moves: z.array(z.string().min(1)).min(1),
				cost: z.string().min(1),
				loyaltyMax: z.number().int(),
				choices: z
					.array(
						z.strictObject({
							prompt: z.string().min(1),
							options: z.array(z.string().min(1)).min(1),
							writeIn: z.boolean().optional()
						})
					)
					.optional()
			})
		)
		.min(1),
	rules: z.array(insertRuleSchema).min(1)
});
export type InitiatesOfDanuInsert = z.infer<typeof insertInitiatesOfDanuSchema>;

export const insertInvocationsSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	source: sourceSchema,
	intro: markdown,
	startKnowing: z.number().int(),
	learnAt: z.string().min(1),
	invocations: z
		.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				/** Only one Invocation may be active at a time. */
				ongoing: z.literal(true).optional(),
				text: markdown,
				reduced: markdown,
				empowered: markdown
			})
		)
		.min(1)
});
export type InvocationsInsert = z.infer<typeof insertInvocationsSchema>;

/** Ghost and Revenant's shared shape: both replace the playbook Instinct,
 * grant a fixed set of moves, pick a Terrible Purpose, and track Consequences
 * toward a shared Final Consequence. The book content differs; the structure
 * doesn't, so both files validate against this one schema. */
const namedTextOptionSchema = z.strictObject({ id, name: z.string().min(1), text: markdown });

const undeadInsertSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	gainedWhen: markdown,
	source: sourceSchema,
	instincts: z.strictObject({
		text: markdown,
		options: z.array(namedTextOptionSchema).min(1)
	}),
	moves: z.strictObject({
		text: markdown,
		list: z
			.array(
				z.strictObject({
					id,
					name: z.string().min(1),
					granted: z.literal(true).optional(),
					text: markdown,
					tracker: trackerSchema.optional()
				})
			)
			.min(1)
	}),
	terriblePurpose: z.strictObject({
		prompt: z.string().min(1),
		/** Revenant reprints Ghost's Terrible Purpose options verbatim; this
		 * names the insert they're shared with rather than duplicating the
		 * `requires`/`childOf` graph checks against a second copy. */
		sameAs: id.optional(),
		options: z.array(namedTextOptionSchema).min(1)
	}),
	consequences: z.strictObject({
		text: markdown,
		list: z
			.array(
				z.strictObject({
					id,
					name: z.string().min(1),
					text: markdown,
					tracker: trackerSchema.optional(),
					/** A consequence that only appears once its parent is marked
					 * (Unstable requires Breakdown, Insatiable requires Strange
					 * Appetites) — the same child/prerequisite shape moves use,
					 * gated on consequence ids instead of move ids. */
					childOf: id.optional(),
					requires: z.strictObject({ consequences: z.array(id) }).optional(),
					choices: z.array(subChoiceSchema).optional()
				})
			)
			.min(1),
		final: z.strictObject({ name: z.string().min(1), text: markdown })
	})
});
export const insertGhostSchema = undeadInsertSchema;
export const insertRevenantSchema = undeadInsertSchema;
export type GhostInsert = z.infer<typeof undeadInsertSchema>;
export type RevenantInsert = GhostInsert;

export const insertThrallSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('insert'),
	appliesTo: insertAppliesTo,
	gainedWhen: markdown,
	source: sourceSchema,
	master: z.strictObject({
		text: markdown,
		prompt: z.string().min(1),
		writeIn: z.literal(true)
	}),
	impulse: z.strictObject({
		text: markdown,
		options: z.array(z.string().min(1)).min(1),
		writeIn: z.literal(true)
	}),
	instincts: z.strictObject({
		text: markdown,
		options: z.array(namedTextOptionSchema).min(1)
	}),
	moves: z.strictObject({
		text: markdown,
		list: z
			.array(
				z.strictObject({
					id,
					name: z.string().min(1),
					granted: z.literal(true).optional(),
					text: markdown,
					tracker: trackerSchema.optional()
				})
			)
			.min(1)
	}),
	marks: z.strictObject({
		text: markdown,
		list: z
			.array(
				z.strictObject({
					id,
					name: z.string().min(1),
					text: markdown,
					maxHpPenalty: z.number().int().positive().optional()
				})
			)
			.min(1)
	})
});
export type ThrallInsert = z.infer<typeof insertThrallSchema>;

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

/**
 * The GM playbook as reference data (phase 7). Firmed up from `the-gm.json`:
 * every top-level section now has a real shape, so the GM tools render from a
 * typed `GmPlaybook` rather than poking at `unknown`. The playbook is *reference*
 * (not a build/tracker sheet like the steading), so most interiors are prose
 * strings, string lists, and small labelled tables.
 */

/** A `[label, value]` pair as printed in the GM playbook's option tables
 * (e.g. `["In large groups (horde)", "3 HP"]`). */
const labelledValue = z.tuple([z.string(), z.string()]);

/** A `d6` outcome table: a roll range (`"1"`, `"2-3"`) and its result. */
const rollRow = z.strictObject({ roll: z.string().min(1), result: z.string().min(1) });

/** One numbered procedure step (site/monster/follower creation, the core loop). */
const gmStepSchema = z.strictObject({
	n: z.number().int(),
	name: z.string().min(1),
	text: markdown.optional(),
	actions: z.array(z.string()).optional(),
	items: z.array(z.string()).optional(),
	note: z.string().optional(),
	/** Pick-from-these option groups (monster/follower tag & stat tables). */
	groups: z
		.array(z.strictObject({ prompt: z.string().min(1), options: z.array(labelledValue) }))
		.optional(),
	prompt: z.string().optional(),
	options: z.array(labelledValue).optional(),
	tagLists: z
		.strictObject({
			useful: z.array(z.string()),
			problematic: z.array(z.string()),
			mixedBlessing: z.array(z.string())
		})
		.optional(),
	special: z.record(z.string(), z.string()).optional()
});

export const gmSchema = z.strictObject({
	id,
	name: z.string().min(1),
	type: z.literal('gm'),
	source: sourceSchema,
	agenda: z.array(z.string().min(1)),
	coreLoop: z.strictObject({
		steps: z.array(gmStepSchema),
		otherThingsToDo: z.array(z.string())
	}),
	gmMoves: z.strictObject({
		general: z.array(z.string()),
		exploration: z.array(z.string()),
		homefront: z.array(z.string())
	}),
	principles: z.array(z.string().min(1)),
	damageAndDebilities: z.strictObject({
		text: markdown,
		damageLadder: z.array(z.strictObject({ effect: z.string(), die: z.string() })),
		debilities: z.array(z.strictObject({ name: z.string(), text: z.string() })),
		recover: markdown,
		tendingRequirements: z.array(z.string()),
		tendingNote: z.string()
	}),
	content: z.strictObject({
		text: markdown,
		lists: z.array(z.strictObject({ id, title: z.string().min(1), note: z.string().optional() }))
	}),
	threats: z.strictObject({
		text: markdown,
		writeUp: z.array(z.string()),
		update: z.strictObject({ text: z.string(), items: z.array(z.string()) }),
		trackers: z.array(z.string().min(1)),
		trackersNote: z.string(),
		types: z.array(z.strictObject({ id, name: z.string().min(1), moves: z.array(z.string()) }))
	}),
	iWonder: z.strictObject({ text: markdown }),
	expeditions: z.strictObject({
		chartACourse: markdown,
		requirements: z.array(z.string()),
		challenges: z.array(z.string()),
		challengesNote: z.string(),
		whenTheWayIsPerilous: z.strictObject({ text: markdown, table: z.array(rollRow) }),
		travelTimes: z.array(
			z.strictObject({ from: z.string().min(1), entries: z.array(labelledValue) })
		),
		makeCamp: z.strictObject({
			questions: z.array(z.string()),
			note: z.string(),
			dieOfFate: z.array(rollRow)
		}),
		legsOfTravel: z.strictObject({
			text: markdown,
			questions: z.array(z.string()),
			softMoves: z.array(z.string())
		}),
		pointsOfInterest: z.strictObject({
			items: z.array(z.string()),
			text: markdown,
			firstVisitQuestions: z.array(z.string()),
			landmarkNote: markdown
		}),
		randomWeather: z.strictObject({
			note: z.string(),
			tables: z.array(z.strictObject({ season: z.string().min(1), rows: z.array(labelledValue) }))
		})
	}),
	sites: z.strictObject({
		text: markdown,
		considerations: z.array(z.string()),
		exploration: markdown,
		creation: z.array(gmStepSchema)
	}),
	discoveries: z.strictObject({
		clues: z.strictObject({ text: markdown, items: z.array(z.string()) }),
		encounters: z.strictObject({ items: z.array(z.string()) }),
		opportunities: z.strictObject({ items: z.array(z.string()) }),
		artifactsAndArcana: markdown
	}),
	hazards: z.strictObject({
		asDescription: markdown,
		asGmMoves: z.strictObject({ text: markdown, items: z.array(z.string()), note: z.string() }),
		asImpendingDoom: markdown,
		asPlayerMoves: z.strictObject({ text: markdown, items: z.array(z.string()) }),
		ifItDealsDamage: z.strictObject({
			text: markdown,
			ladder: z.array(labelledValue),
			modifiers: z.array(labelledValue)
		})
	}),
	monsters: z.strictObject({
		steps: z.array(gmStepSchema),
		monstersAndFollowers: markdown
	}),
	npcs: z.strictObject({
		names: z.strictObject({
			note: z.string(),
			lists: z.array(
				z.strictObject({
					region: z.string().min(1),
					sound: z.string(),
					names: z.array(z.string())
				})
			)
		}),
		trait: markdown,
		questions: z.strictObject({
			locals: z.array(z.string()),
			outsiders: z.array(z.string()),
			heardOf: z.array(z.string())
		}),
		impressions: z.strictObject({
			note: z.string(),
			areas: z.array(z.strictObject({ area: z.string().min(1), options: z.string() }))
		}),
		instinct: markdown,
		tagsAndMoves: markdown,
		connections: z.array(z.string()),
		motivations: z.array(z.string()),
		embodiment: z.array(z.string()),
		hpArmorDamage: markdown,
		persuade: z.strictObject({
			move: markdown,
			convincers: z.array(z.string()),
			note: markdown
		})
	}),
	followers: z.strictObject({
		steps: z.array(gmStepSchema),
		inPlay: markdown,
		groupFollowers: markdown,
		abstractingGroupExchanges: markdown
	}),
	homefront: z.strictObject({
		lifeInStonetop: z.strictObject({
			people: z.array(z.string()),
			homeAndHearth: z.array(z.string()),
			tradeAndCommerce: z.array(z.string()),
			protectionAndGovernance: z.array(z.string())
		}),
		questionsToAsk: z.array(z.string()),
		seasonalActivities: z.strictObject({
			spring: z.array(z.string()),
			summer: z.array(z.string()),
			autumn: z.array(z.string()),
			winter: z.array(z.string()),
			always: z.array(z.string())
		})
	}),
	aftermath: z.array(z.string()),
	downtime: z.strictObject({
		items: z.array(z.string()),
		note: z.string(),
		makeAPlan: z.strictObject({
			move: markdown,
			requirements: z.array(z.string()),
			note: z.string()
		})
	}),
	relativeValue: z.strictObject({
		values: z.array(z.strictObject({ value: z.number().int(), worth: z.array(z.string()) })),
		notes: z.array(z.string())
	}),
	flowOfPlay: z.strictObject({
		note: z.string(),
		nodes: z.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				ref: z.string().optional(),
				items: z.array(z.string())
			})
		),
		edges: z.array(z.strictObject({ from: id, to: id, label: z.string().optional() }))
	})
});

export type GmPlaybook = z.infer<typeof gmSchema>;
export type GmStep = z.infer<typeof gmStepSchema>;
export type GmRollRow = z.infer<typeof rollRow>;

/** Schema resolver for the harness: pack-relative path → schema. */
/**
 * A moves file: the basic moves every character can make, and the moves a
 * *steading* rolls. Both are lifted out of the rules prose by
 * `tools/build_moves.ts`, and both are deliberately the same `{ id, name, text }`
 * shape a playbook move has — so a sheet renders (and rolls) any of them through
 * one code path. Which stat a move rolls is read from its text, not stored twice.
 */
function movesFileSchema<T extends string>(fileId: T) {
	return z.strictObject({
		id: z.literal(fileId),
		name: z.string().min(1),
		type: z.literal('moves'),
		/** Where the generator lifted these from, for the next regeneration. */
		source: z.strictObject({ file: z.string().min(1), section: z.string().min(1) }),
		moves: z
			.array(
				z.strictObject({
					id,
					name: z.string().min(1),
					text: markdown,
					/** Same meaning as `moveSchema`'s `rollsDamage` (Clash, Let Fly) —
					 * detected by `build_moves.ts` from the move's own text, not
					 * hand-authored, since this file regenerates from the vault. */
					rollsDamage: z.boolean().optional()
				})
			)
			.min(1)
	});
}

export const basicMovesSchema = movesFileSchema('basic-moves');

/**
 * The end-of-session move, split into the parts a guided flow needs: the prompts
 * each player answers about their own character ("if you can, mark XP"), the
 * questions the table answers together (every "yes" is an XP for everyone), and
 * the closing prose that scores nothing.
 */
export const endOfSessionSchema = z.strictObject({
	id: z.literal('end-of-session'),
	name: z.string().min(1),
	type: z.literal('move'),
	source: z.strictObject({ file: z.string().min(1), section: z.string().min(1) }),
	personal: z.array(z.strictObject({ id, text: markdown })).min(1),
	questions: z.array(z.strictObject({ id, text: markdown })).min(1),
	closing: z.array(markdown)
});

export type EndOfSession = z.infer<typeof endOfSessionSchema>;
export const steadingMovesSchema = movesFileSchema('steading-moves');

export type BasicMoves = z.infer<typeof basicMovesSchema>;
export type SteadingMoves = z.infer<typeof steadingMovesSchema>;

export function schemaFor(relPath: string): z.ZodType | null {
	if (relPath === 'data/basic-moves.json') return basicMovesSchema;
	if (relPath === 'data/steading-moves.json') return steadingMovesSchema;
	if (relPath === 'data/end-of-session.json') return endOfSessionSchema;
	if (relPath === 'data/the-steading.json') return steadingSchema;
	if (relPath === 'data/the-gm.json') return gmSchema;
	if (relPath === 'data/insert-inventory.json') return inventoryInsertSchema;
	if (relPath === 'data/insert-followers.json') return insertFollowersSchema;
	if (relPath === 'data/insert-crew.json') return insertCrewSchema;
	if (relPath === 'data/insert-animal-companion.json') return insertAnimalCompanionSchema;
	if (relPath === 'data/insert-initiates-of-danu.json') return insertInitiatesOfDanuSchema;
	if (relPath === 'data/insert-invocations.json') return insertInvocationsSchema;
	if (relPath === 'data/insert-ghost.json') return insertGhostSchema;
	if (relPath === 'data/insert-revenant.json') return insertRevenantSchema;
	if (relPath === 'data/insert-thrall.json') return insertThrallSchema;
	if (/^data\/insert-[a-z-]+\.json$/.test(relPath)) return insertSchema;
	if (/^data\/the-[a-z-]+\.json$/.test(relPath)) return playbookSchema;
	// Generated rules reference (build_srd.py): one document tree per book.
	if (/^rules\/[a-z0-9-]+\.json$/.test(relPath)) return documentTreeSchema;
	return null;
}
