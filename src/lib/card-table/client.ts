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

export async function fetchSince(token: string, version: number): Promise<TableSnapshot | null> {
	const res = await fetch(`/api/card-tables/${token}/sync?since=${version}`);
	if (!res.ok) return null;
	return (await res.json()) as TableSnapshot;
}
