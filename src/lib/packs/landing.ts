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
