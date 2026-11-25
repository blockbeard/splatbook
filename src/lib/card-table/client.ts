/**
 * Talking to a card table from the browser.
 *
 * Thin on purpose: the interesting decisions all live on the server, and this
 * only has to be honest about what came back.
 */

import type { TableSnapshot } from './client-types';

export interface CommandReply {
	ok: boolean;
	/** Present on success — the table as this seat may now see it. */
	view?: TableSnapshot & { seatId: string | null };
	/** Present on refusal. `conflict` is ordinary; the rest are terminal. */
	reason?: 'conflict' | 'rejected' | 'gone' | 'expired' | 'exhausted' | 'no-such-table';
	detail?: string;
}

/**
 * A key that is stable for one command and different for the next.
 *
 * The server treats it as a lock, so a command retried after a dropped response
 * lands once rather than moving two cards for one click. That means it must be
 * generated where the *intent* is — here, once per click — and reused across
 * retries of that same intent, never regenerated on the way out.
 */
export const newRequestKey = (): string => crypto.randomUUID();

export async function sendCommand(
	token: string,
	command: unknown,
	expectedVersion: number,
	requestHash: string
): Promise<CommandReply> {
	const res = await fetch(`/api/card-tables/${token}/commands`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ command, expectedVersion, requestHash })
	});
	const body = await res.json().catch(() => null);
	if (res.ok && body?.ok) return { ok: true, view: body };
	return { ok: false, reason: body?.reason ?? 'no-such-table', detail: body?.detail };
}

/**
 * Ask for anything after `version`. `null` means nothing has changed.
 *
 * `stamp` is the roster fingerprint from the last view this client was given.
 * Sent back, it lets the server answer `204` when neither the version nor the
 * roster has moved, without loading the table at all — which is nearly every
 * poll. Left out, the server always sends a full view.
 */
export async function fetchSince(
	token: string,
	version: number,
	stamp?: string
): Promise<TableSnapshot | null> {
	const query = new URLSearchParams({ since: String(version) });
	if (stamp) query.set('stamp', stamp);
	const res = await fetch(`/api/card-tables/${token}/sync?${query}`);
	if (res.status === 204 || !res.ok) return null;
	return (await res.json()) as TableSnapshot;
}
