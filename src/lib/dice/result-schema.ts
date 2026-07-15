/**
 * A Zod validator for a {@link RollResult} — used at the trust boundary where a
 * roll arrives from the browser to be stored in a campaign's log (the roll UI
 * computes the result client-side, so the server must not take its shape on
 * faith). Kept out of the pure core (`roll.ts`/`notation.ts` never import it) so
 * the engine stays dependency-free; this is an optional adjunct for callers that
 * persist or accept rolls over the wire.
 *
 * The bounds are deliberately generous but finite — enough for any real dice
 * expression, small enough that a hostile client can't stuff the log.
 */

import { z } from 'zod';
import type { RollResult } from './roll';

const dieRoll = z.strictObject({
	sides: z.number().int().min(1).max(1000),
	value: z.number().int().min(1).max(1000),
	kept: z.boolean()
});

/** Validates the dice engine's `RollResult`. `satisfies` ties it to the type so
 * the two can't drift. */
export const rollResultSchema = z.strictObject({
	notation: z.string().min(1).max(100),
	mode: z.enum(['normal', 'advantage', 'disadvantage']),
	dice: z.array(dieRoll).min(1).max(100),
	modifier: z.number().int().min(-1000).max(1000),
	bonus: z.number().int().min(-1000).max(1000),
	total: z.number().int().min(-1000).max(10000)
}) satisfies z.ZodType<RollResult>;
