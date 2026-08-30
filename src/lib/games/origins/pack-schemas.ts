/**
 * Zod schemas for the Origins 5.5e content pack (phase 28).
 *
 * Almost every file here is **generated** by `tools/build_origins_data.py` from
 * SRD 5.2.1 markdown, so these schemas do double duty: they type what the
 * builder consumes, and they are the contract a re-import has to keep. The
 * extractor is strict about parsing and these are strict about shape, which is
 * how a community-converted source gets to be trusted at runtime.
 *
 * Everything validates strictly — there is no "firm it up later" tier, because
 * the builder is the only consumer and it consumes all of it.
 *
 * Kept free of Svelte imports so build tooling under plain tsx can load it —
 * see `../schemas.ts`.
 */

import { z } from 'zod';
import { landingSchema } from '../../packs/landing';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case');
/** Prose fields — may carry Markdown emphasis. */
const markdown = z.string().min(1);
/** The six ability scores, as the pack abbreviates them. */
export const abilitySchema = z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
/** The three spell lists Magic Initiate can open. */
export const spellListSchema = z.enum(['cleric', 'druid', 'wizard']);

/**
 * A labelled starting-equipment option. Backgrounds offer A or B; Fighter,
 * Paladin and Ranger offer A, B, or C — hence a list rather than two fields.
 * `items` are display strings straight from the SRD ("4 Handaxes"), not item
 * ids: the SRD writes them as prose and inventing ids for them would be the
 * extractor guessing.
 */
const equipmentOptionSchema = z.strictObject({
	id: id,
	label: z.string().min(1),
	items: z.array(z.string().min(1)),
	gp: z.number().int().nonnegative()
});

const equipmentChoiceSchema = z.strictObject({
	options: z.array(equipmentOptionSchema).min(2)
});

// --- backgrounds.json -----------------------------------------------------

export const backgroundsSchema = z.strictObject({
	backgrounds: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				/** Three abilities; increase one by 2 and another by 1, or all three by 1. */
				abilityScores: z.array(abilitySchema).length(3),
				feat: z.strictObject({
					id: id,
					name: z.string().min(1),
					/** Present only for Magic Initiate, naming the list it opens. */
					spellList: spellListSchema.optional()
				}),
				skillProficiencies: z.array(z.string().min(1)).length(2),
				toolProficiency: z.string().min(1),
				equipment: equipmentChoiceSchema
			})
		)
		.min(1)
});

// --- species.json ---------------------------------------------------------

/**
 * A choice point inside a species trait. The SRD writes these as prose
 * ("Choose a lineage from the Elven Lineages table"); the pack's
 * `species-choices.json` overlay turns them into options a builder can offer.
 * Either an explicit `options` list or a `from` pool, never both.
 */
const speciesChoiceSchema = z
	.strictObject({
		id: id,
		/**
		 * The trait this choice belongs to, by its SRD name — checked against the
		 * species' own trait list by `pack.test.ts`. Absent when the choice
		 * belongs to a species *field* rather than a trait: Human and Tiefling
		 * choose their size, which the SRD prints on the Size line.
		 */
		trait: z.string().min(1).optional(),
		label: z.string().min(1),
		help: z.string().min(1).optional(),
		options: z
			.array(
				z.strictObject({
					id: z.string().min(1),
					name: z.string().min(1),
					note: markdown.optional()
				})
			)
			.min(2)
			.optional(),
		/** Draw options from elsewhere in the pack instead of listing them. */
		from: z.enum(['skills', 'origin-feats']).optional(),
		/** What picking this actually grants the character, when it grants anything. */
		grants: z.enum(['skill', 'feat', 'size']).optional()
	})
	.refine((c) => Boolean(c.options) !== Boolean(c.from), {
		message: 'a species choice needs exactly one of `options` or `from`'
	});

export const speciesSchema = z.strictObject({
	species: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				creatureType: z.string().min(1),
				size: z.string().min(1),
				/** The SRD's fuller size line, including its parenthetical height. */
				sizeNote: z.string().min(1),
				speed: z.number().int().positive(),
				traits: z
					.array(
						z.strictObject({
							name: z.string().min(1),
							text: markdown,
							/** A trait that *is* its table keeps it, as rows of cells. */
							table: z.array(z.array(z.string())).optional()
						})
					)
					.min(1),
				choices: z.array(speciesChoiceSchema).optional()
			})
		)
		.min(1)
});

// --- reference-classes.json -----------------------------------------------

export const referenceClassesSchema = z.strictObject({
	referenceClasses: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				// The four traits Origins borrows, and nothing else.
				hitDie: z.number().int().positive(),
				armorTraining: z.strictObject({
					light: z.boolean(),
					medium: z.boolean(),
					heavy: z.boolean(),
					shields: z.boolean(),
					text: z.string().min(1)
				}),
				weaponProficiencies: z.string().min(1),
				startingEquipment: equipmentChoiceSchema,
				/**
				 * Carried for display and deliberately not granted: a reference class
				 * gives no saving throws, no class skills, no features. The builder
				 * shows these so a player can see what they are *not* getting.
				 */
				notGranted: z.strictObject({
					primaryAbility: z.string(),
					savingThrowProficiencies: z.string(),
					skillProficiencies: z.string()
				})
			})
		)
		.length(12)
});

// --- feats.json -----------------------------------------------------------

export const featsSchema = z.strictObject({
	feats: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				text: markdown,
				/** The feat's named benefits, when it has more than one. */
				benefits: z.array(z.strictObject({ name: z.string().min(1), text: markdown }))
			})
		)
		.min(1)
});

// --- equipment.json -------------------------------------------------------

/** Costs are stored in copper so the builder can total a purse without floats. */
const costCp = z.number().int().nonnegative().nullable();
const weightLb = z.number().nonnegative().nullable();

export const equipmentSchema = z.strictObject({
	weapons: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				category: z.enum(['Simple', 'Martial']),
				kind: z.enum(['Melee', 'Ranged']),
				damageDice: z.string().nullable(),
				damageType: z.string().nullable(),
				damage: z.string().min(1),
				properties: z.array(z.string().min(1)),
				mastery: z.string().nullable(),
				weightLb: weightLb,
				costCp: costCp
			})
		)
		.min(1),
	armor: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				category: z.enum(['Light', 'Medium', 'Heavy', 'Shield']),
				/** The AC this armor sets. Null for a Shield, which adds instead. */
				baseAc: z.number().int().nullable(),
				/** What a Shield adds to AC. Null for body armor. */
				acBonus: z.number().int().nullable(),
				addsDex: z.boolean(),
				dexCap: z.number().int().nullable(),
				acText: z.string().min(1),
				minStrength: z.number().int().nullable(),
				stealthDisadvantage: z.boolean(),
				weightLb: weightLb,
				costCp: costCp
			})
		)
		.min(1),
	/** The equipment kits Origins tells you to add to a background's Option A. */
	packs: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				costCp: costCp,
				costText: z.string().min(1),
				text: markdown,
				contents: z.array(z.string().min(1))
			})
		)
		.min(1),
	gear: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				costCp: costCp,
				costText: z.string().min(1),
				text: markdown
			})
		)
		.min(1),
	tools: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				category: z.string().min(1),
				costCp: costCp,
				costText: z.string().min(1)
			})
		)
		.min(1)
});

// --- spells.json ----------------------------------------------------------

export const spellsSchema = z.strictObject({
	spells: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				/** Origins caps spells at level 1, so this is 0 or 1. */
				level: z.union([z.literal(0), z.literal(1)]),
				school: z.string().min(1),
				lists: z.array(spellListSchema).min(1),
				castingTime: z.string().min(1),
				/** Rituals cost nothing in Origins — they sidestep the once-per-rest limit. */
				ritual: z.boolean(),
				range: z.string().min(1),
				components: z.string().min(1),
				duration: z.string().min(1),
				concentration: z.boolean(),
				text: markdown
			})
		)
		.min(1)
});

// --- reference.json -------------------------------------------------------

export const referenceSchema = z.strictObject({
	abilities: z.array(z.strictObject({ id: abilitySchema, name: z.string().min(1) })).length(6),
	skills: z
		.array(
			z.strictObject({
				id: id,
				name: z.string().min(1),
				ability: abilitySchema,
				example: z.string()
			})
		)
		.length(18),
	languages: z.array(z.string().min(1)).min(1)
});

// --- origins-rules.json ---------------------------------------------------

/**
 * The hack's own rules — the only file here that is authored rather than
 * extracted, and the only one that carries Origins' departures from the SRD as
 * *data* rather than as engine constants. The engine takes these as arguments,
 * so changing a number is a pack edit, not a code change.
 */
export const originsRulesSchema = z.strictObject({
	$comment: z.string().optional(),
	title: z.string().min(1),
	subtitle: z.string().min(1),
	source: z.strictObject({
		author: z.string().min(1),
		url: z.string().url(),
		published: z.string().min(1)
	}),
	intro: markdown,
	rules: z.strictObject({
		/** Fixed: there are no levels, so there is nothing for it to scale with. */
		proficiencyBonus: z.number().int().positive(),
		referenceClass: z.strictObject({
			grants: z.array(z.enum(['hitDie', 'armorTraining', 'shields', 'weaponProficiencies'])),
			text: markdown,
			note: markdown
		}),
		equipment: z.strictObject({
			text: markdown,
			startingGold: z.strictObject({
				base: z.number().int().positive(),
				withMediumOrHeavyArmorTraining: z.number().int().positive(),
				text: markdown
			})
		}),
		hitPoints: z.strictObject({ method: z.enum(['roll']), text: markdown }),
		spellcasting: z.strictObject({
			maxSpellLevel: z.number().int().nonnegative(),
			lists: z.array(spellListSchema).min(1),
			text: markdown
		}),
		languages: z.strictObject({ count: z.number().int().nonnegative(), text: markdown })
	}),
	steps: z.array(z.strictObject({ id: id, title: z.string().min(1), text: markdown })).min(1),
	playerAdvice: z.strictObject({
		intro: markdown,
		points: z.array(markdown).min(1)
	}),
	abilityGeneration: z.strictObject({
		standardArray: z.array(z.number().int().positive()).length(6),
		pointBuy: z.strictObject({
			budget: z.number().int().positive(),
			min: z.number().int().positive(),
			max: z.number().int().positive(),
			costs: z.record(z.string(), z.number().int().nonnegative())
		}),
		roll: z.strictObject({
			notation: z.string().min(1),
			dropLowest: z.number().int().nonnegative(),
			count: z.number().int().positive()
		})
	})
});

export type OriginsRules = z.infer<typeof originsRulesSchema>;
export type Backgrounds = z.infer<typeof backgroundsSchema>;
export type Background = Backgrounds['backgrounds'][number];
export type SpeciesPack = z.infer<typeof speciesSchema>;
export type Species = SpeciesPack['species'][number];
export type SpeciesChoice = NonNullable<Species['choices']>[number];
export type ReferenceClasses = z.infer<typeof referenceClassesSchema>;
export type ReferenceClass = ReferenceClasses['referenceClasses'][number];
export type Feats = z.infer<typeof featsSchema>;
export type Feat = Feats['feats'][number];
export type Equipment = z.infer<typeof equipmentSchema>;
export type Weapon = Equipment['weapons'][number];
export type Armor = Equipment['armor'][number];
export type Spells = z.infer<typeof spellsSchema>;
export type Spell = Spells['spells'][number];
export type ReferenceData = z.infer<typeof referenceSchema>;
export type Skill = ReferenceData['skills'][number];
export type Ability = z.infer<typeof abilitySchema>;
export type SpellList = z.infer<typeof spellListSchema>;

const BY_FILE: Record<string, z.ZodType> = {
	'landing.json': landingSchema,
	'data/origins-rules.json': originsRulesSchema,
	'data/backgrounds.json': backgroundsSchema,
	'data/species.json': speciesSchema,
	'data/reference-classes.json': referenceClassesSchema,
	'data/feats.json': featsSchema,
	'data/equipment.json': equipmentSchema,
	'data/spells.json': spellsSchema,
	'data/reference.json': referenceSchema
};

export function schemaFor(relPath: string): z.ZodType | null {
	return BY_FILE[relPath] ?? null;
}
