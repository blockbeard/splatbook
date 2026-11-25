/**
 * Zod schemas for the His Majesty the Worm content pack (phase 22, extended in
 * phase 29).
 *
 * Two kinds of file. The rules reference is generated document trees
 * (`build_srd.py`) validated with the shell's generic `documentTreeSchema`. The
 * card table's data under `data/` is hand-authored and validated strictly here,
 * because the engine consumes it directly and a typo in a suit id should fail
 * CI rather than surface as an empty menu mid-session.
 *
 * Kept separate from `index.ts` (which bundles theme CSS and landing assets) so
 * build tooling under plain tsx can import it — see `../schemas.ts`.
 */

import { z } from 'zod';
import { landingSchema } from '../../packs/landing';
import { documentTreeSchema } from '../../reference/document-tree';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case');

/** Where in the book a file's contents come from. */
const sourceSchema = z.strictObject({
	book: z.string().min(1),
	chapters: z.array(z.number().int().positive()),
	note: z.string().min(1)
});

/**
 * `data/deck.json` — the physical decks, from ch.1's composition and ch.7's
 * "Card values" sidebar. Values are the whole basis for sorting, for the doom
 * tiers, and for every card the table draws, so they are data rather than a
 * lookup buried in the engine.
 */
export const deckSchema = z.strictObject({
	schemaVersion: z.literal(1),
	source: sourceSchema,
	suits: z
		.array(z.strictObject({ id, name: z.string().min(1), glyph: z.string().min(1) }))
		.length(4),
	ranks: z
		.array(z.strictObject({ id, name: z.string().min(1), value: z.number().int().min(1).max(14) }))
		.length(14),
	minors: z
		.array(
			z.strictObject({
				id,
				suit: id,
				rank: id,
				value: z.number().int().min(1).max(14),
				name: z.string().min(1)
			})
		)
		.length(56),
	majors: z
		.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				numeral: z.string().min(1),
				value: z.number().int().min(0).max(21)
			})
		)
		.length(22),
	doomTiers: z
		.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				min: z.number().int(),
				max: z.number().int()
			})
		)
		.length(2),
	decks: z
		.array(
			z.strictObject({
				id,
				name: z.string().min(1),
				arcana: z.enum(['minor', 'major']),
				includesMajors: z.array(id).optional(),
				excludesMajors: z.array(id).optional(),
				note: z.string().min(1)
			})
		)
		.length(2),
	/**
	 * Where the pack keeps a picture for each card, by card id.
	 *
	 * The pack says where its own art lives rather than the app assuming a path,
	 * and it is optional so a pack without pictures still validates — the table
	 * falls back to the suit glyph, which is what it drew before there were any.
	 */
	art: z
		.strictObject({
			plates: z.strictObject({
				dir: z.string().min(1),
				ext: z.string().min(1),
				note: z.string().min(1).optional()
			})
		})
		.optional()
});

/** One entry in a menu of Challenge Actions. */
const actionSchema = z.strictObject({
	id,
	name: z.string().min(1),
	/** The rule in a sentence or two, shown under the action menu (phase 31). */
	summary: z.string().min(1).max(240),
	/** The reference page holding the rule itself; the pack test checks it exists. */
	rule: z.string().regex(/^[a-z0-9-]+$/),
	/** Vigilance, alone among the miscellaneous actions, cannot be paid for with
	 * a greater doom (ch.7, "Greater dooms"). */
	greaterDoomForbidden: z.boolean().optional(),
	/**
	 * How the table plays it, when not simply face up (phase 32): `ready` for the
	 * actions the book plays face down and keeps until triggered (Riposte,
	 * Dodge, Aid Another, Vigilance); `initiative` for Guard, whose card replaces
	 * your initiative.
	 */
	play: z.enum(['ready', 'initiative']).optional()
});

/**
 * `data/challenge.json` — hand sizes and the action catalogue.
 *
 * Note what is *not* here: any way to compute a total. An action's value is the
 * card plus an attribute, and this pack holds no character. The GM's modifiers
 * suggest a draw count; they never insist on one.
 */
export const challengeSchema = z.strictObject({
	schemaVersion: z.literal(1),
	source: sourceSchema,
	handSizes: z.strictObject({
		player: z.strictObject({
			default: z.number().int().positive(),
			note: z.string().min(1)
		}),
		gm: z.strictObject({
			base: z.number().int().positive(),
			note: z.string().min(1),
			modifiers: z.array(
				z.strictObject({
					id,
					label: z.string().min(1),
					/** Negative for a line that draws fewer, like the three-player house rule. */
					amount: z
						.number()
						.int()
						.refine((n) => n !== 0, 'a modifier that adds nothing is not a modifier'),
					/** `toggle` applies once when true; `count` applies once per instance. */
					kind: z.enum(['toggle', 'count']),
					/** A fact the table already knows, which fills this line in by itself. */
					auto: z.enum(['enemy-types', 'outnumber', 'twice', 'three-adventurers']).optional(),
					/** Not the book's: shown as a house rule. */
					house: z.boolean().optional()
				})
			),
			mulligan: z.strictObject({ label: z.string().min(1), note: z.string().min(1) })
		})
	}),
	actions: z.strictObject({
		free: z.array(actionSchema),
		bySuit: z.record(id, z.array(actionSchema)),
		anySuit: z.array(actionSchema),
		/**
		 * What only the GM can spend a card on: a creature's greater doom
		 * ability, or a greater doom discarded for favour (ch.7, "Greater
		 * dooms"). Here rather than in app code because they are game strings,
		 * and `requires` names the doom tier that pays for them.
		 */
		gmOnly: z.array(actionSchema.extend({ requires: z.enum(['lesser', 'greater']) }))
	}),
	/**
	 * Ch.7 step 5's assessment, said when everyone has had a turn: surrender if
	 * the guild has clearly won, ask about retreating if it is in a bad way. A
	 * prompt to say aloud, never a ruling. `rule.page` is a reference page id,
	 * checked against the generated reference by the pack test.
	 */
	endOfRound: z.strictObject({
		text: z.string().min(1),
		rule: z.strictObject({ label: z.string().min(1), page: z.string().regex(/^[a-z0-9-]+$/) })
	})
});

export function schemaFor(relPath: string): z.ZodType | null {
	// Generated rules reference (build_srd.py): the book, and the pack-authored
	// GM-note document the spoiler interstitial points at.
	if (/^rules\/[a-z0-9-]+\.json$/.test(relPath)) return documentTreeSchema;
	// Front-door copy — shell-owned schema (phase 22), pack-supplied words.
	if (relPath === 'landing.json') return landingSchema;
	// Card-table data (phase 29), hand-authored and validated strictly.
	if (relPath === 'data/deck.json') return deckSchema;
	if (relPath === 'data/challenge.json') return challengeSchema;
	return null;
}
