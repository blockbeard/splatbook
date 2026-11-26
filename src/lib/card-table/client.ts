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
	/**
	 * Present on refusal. `conflict` is ordinary; `unanswered` means the table
	 * never gave an answer of its own (a server error, a CPU-limit page, the
	 * network) and says nothing about the table; the rest are terminal.
	 */
	reason?:
		'conflict' | 'rejected' | 'gone' | 'expired' | 'exhausted' | 'no-such-table' | 'unanswered';
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
	let res: Response;
	try {
		res = await fetch(`/api/card-tables/${token}/commands`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ command, expectedVersion, requestHash })
		});
	} catch {
		// The network, not the table.
		return { ok: false, reason: 'unanswered' };
	}
	return readReply(res.status, await res.json().catch(() => null));
}

/**
 * What a reply to a command means.
 *
 * Only an answer from the table itself is believed. Session 14 (phase 33): a
 * Cloudflare CPU-limit page came back as HTML, which used to read as "no such
 * table", and the page told everyone the table had stopped taking cards when
 * it was fine. Now only a 404 or 410 says the table is gone; anything without
 * a reason of the table's own is `unanswered`.
 */
export function readReply(status: number, body: unknown): CommandReply {
	const json = (body && typeof body === 'object' ? body : null) as {
		ok?: boolean;
		reason?: CommandReply['reason'];
		detail?: string;
	} | null;
	if (status >= 200 && status < 300 && json?.ok) {
		return { ok: true, view: json as unknown as CommandReply['view'] };
	}
	if (json?.reason) return { ok: false, reason: json.reason, detail: json.detail };
	// The route's own refusals that carry no reason: `error(404)`, `error(403)`.
	if (status === 404 || status === 410) return { ok: false, reason: 'no-such-table' };
	if (status === 403) return { ok: false, reason: 'rejected', detail: 'no-seat' };
	return { ok: false, reason: 'unanswered' };
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
