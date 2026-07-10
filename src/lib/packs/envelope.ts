/**
 * Zod schemas for the *generic* pack envelope — the only shapes the shell
 * knows about. Everything else in a pack is validated by schemas the owning
 * game module registers through the harness (`./harness.ts`).
 */

import { z } from 'zod';
import type { PackManifest } from './types';

/** `manifest.json` — see `PackManifest` for field docs. */
export const manifestSchema = z.strictObject({
	id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
	name: z.string().min(1),
	version: z.string().min(1),
	license: z.string().min(1),
	attribution: z.string().min(1),
	files: z.array(z.string().min(1))
}) satisfies z.ZodType<PackManifest>;

/**
 * Generic document tree — the shape any game's rules/SRD text arrives in.
 * Deliberately minimal for now; phase 2 (reference & search) firms it up.
 */
export const documentTreeSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	sections: z.array(
		z.object({
			/** Stable section id — deep-link target. */
			id: z.string().min(1),
			title: z.string().min(1),
			/** Heading path from the document root, e.g. ["Moves", "Basic Moves"]. */
			path: z.array(z.string()),
			/** Section body, markdown. */
			body: z.string(),
			/** Print-page anchors covered by this section, if known. */
			pages: z.array(z.number().int()).optional(),
			/** Who may see this section. Defaults to player-visible. */
			visibility: z.enum(['player', 'gm']).default('player')
		})
	)
});

export type DocumentTree = z.infer<typeof documentTreeSchema>;
