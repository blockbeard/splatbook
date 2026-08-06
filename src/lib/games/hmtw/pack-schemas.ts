/**
 * Zod schemas for the His Majesty the Worm content pack (phase 22).
 *
 * A rules-reference pack: the only files are generated document trees
 * (`build_srd.py`), validated with the shell's generic `documentTreeSchema`.
 * Kept separate from `index.ts` (which will bundle theme CSS and, later,
 * landing assets) so build tooling under plain tsx can import it — see
 * `../schemas.ts`.
 */

import type { z } from 'zod';
import { documentTreeSchema } from '../../reference/document-tree';

export function schemaFor(relPath: string): z.ZodType | null {
	// Generated rules reference (build_srd.py): the book, and the pack-authored
	// GM-note document the spoiler interstitial points at.
	if (/^rules\/[a-z0-9-]+\.json$/.test(relPath)) return documentTreeSchema;
	return null;
}
