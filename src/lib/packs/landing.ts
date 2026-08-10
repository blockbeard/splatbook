/**
 * Optional pack landing copy (phase 22) — how a game's front door describes
 * itself, instead of the shell guessing. The shell owns this schema (it is
 * shell UI, not game rules); each game's `schemaFor` returns it for the
 * manifest-listed `landing.json`, so the validation harness covers it like
 * any other pack file. A pack without one gets the shell's honest defaults:
 * builder-speak only when the game actually has builders.
 *
 * Pure Zod on purpose: `validate:packs` runs under plain tsx through the
 * game modules' pack-schema resolvers, so nothing here may import `$app/*`.
 * The runtime fetch lives with the landing route.
 */

import { z } from 'zod';

export const landingSchema = z.strictObject({
	/**
	 * A short plate line *above* the game's name — what this site is, in the
	 * grammar of a book's title page ("Unofficial rules reference").
	 *
	 * It exists because the page was titled with the game's name and nothing
	 * else, which is exactly how the game's own publisher would title it: a
	 * visitor landing on `/hmtw` had no way to tell a fan-made reference from
	 * the official site. Naming the site first makes the game the subject of a
	 * sentence rather than the owner of the page.
	 */
	kicker: z.string().min(1).optional(),
	/** One line under the game's name — replaces the shell's generic pitch. */
	tagline: z.string().min(1),
	/** An optional short paragraph (plain prose) under the tagline. */
	blurb: z.string().min(1).optional(),
	/** Optional image (e.g. a licensed third-party-material logo), pack-relative
	 * or root-absolute src. */
	image: z
		.strictObject({
			src: z.string().min(1),
			alt: z.string().min(1)
		})
		.optional(),
	/**
	 * The book's own credits section, by reference-section id — linked from the
	 * colophon. The pack reproduces the game's text, so the people who made it
	 * are named in the text itself; this points at that page rather than making
	 * the shell keep a second, staler copy of the same list.
	 */
	creditsSectionId: z.string().min(1).optional(),
	/** Outbound promo/buy links, rendered as external links in pack order. */
	links: z
		.array(
			z.strictObject({
				label: z.string().min(1),
				url: z.string().url(),
				/** Small print under the link (e.g. an affiliate disclosure). */
				note: z.string().min(1).optional()
			})
		)
		.default([])
});

export type GameLanding = z.infer<typeof landingSchema>;
