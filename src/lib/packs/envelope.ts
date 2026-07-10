/**
 * Zod schemas for the *generic* pack envelope — the only shapes the shell
 * knows about. Everything else in a pack is validated by schemas the owning
 * game module registers through the harness (`./harness.ts`).
 *
 * The generic *document-tree* format (a game's rules/SRD text) lives with the
 * reference subsystem that consumes it: `$lib/reference/document-tree`.
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
