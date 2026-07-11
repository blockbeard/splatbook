/**
 * The client-facing shape of a logged roll — what the campaign roll-log view
 * renders and what `/api/campaigns/[id]/rolls` returns. Kept client-safe (only a
 * `RollResult` from the dice core, `createdAt` flattened to epoch millis) so both
 * the Svelte component and the server can share one type; the server maps its
 * `RollView` to this with `toLogEntry` (in `$lib/server/db/rolls`).
 */

import type { RollResult } from '$lib/dice';

export interface RollLogEntry {
	id: string;
	actorName: string;
	label: string;
	result: RollResult;
	/** When the roll was made, epoch milliseconds. */
	at: number;
}
