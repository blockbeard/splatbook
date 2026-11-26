/**
 * Reading a command's reply (phase 33). Session 14's 1102 came back as
 * Cloudflare's HTML error page, the page read that as "no such table", and
 * everyone was told the table had stopped taking cards when it was fine. Only
 * the table's own answers are believed now.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSince, readReply, sendCommand } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('reading a reply', () => {
	it('takes a success with its view', () => {
		const reply = readReply(200, { ok: true, version: 4, state: {} });
		expect(reply.ok).toBe(true);
		expect(reply.view).toMatchObject({ version: 4 });
	});

	it('takes the table’s own refusals as they are', () => {
		expect(readReply(409, { ok: false, reason: 'conflict' })).toEqual({
			ok: false,
			reason: 'conflict',
			detail: undefined
		});
		expect(readReply(422, { ok: false, reason: 'rejected', detail: 'wrong-step' })).toEqual({
			ok: false,
			reason: 'rejected',
			detail: 'wrong-step'
		});
		expect(readReply(410, { ok: false, reason: 'expired' }).reason).toBe('expired');
	});

	it('says the table is gone only for a 404 or 410', () => {
		// The route's own `error(404, 'No such table.')` carries a message, no reason.
		expect(readReply(404, { message: 'No such table.' }).reason).toBe('no-such-table');
		expect(readReply(410, null).reason).toBe('no-such-table');
	});

	it('reads a missing seat as a refusal, not a closed table', () => {
		expect(readReply(403, { message: 'You have no seat here.' })).toEqual({
			ok: false,
			reason: 'rejected',
			detail: 'no-seat'
		});
	});

	it('takes anything else as no answer at all', () => {
		// Cloudflare's CPU-limit page: HTML, so no JSON body.
		expect(readReply(503, null).reason).toBe('unanswered');
		expect(readReply(500, { message: 'Internal Error' }).reason).toBe('unanswered');
		expect(readReply(502, null).reason).toBe('unanswered');
		// A 200 that isn't the table's success.
		expect(readReply(200, null).reason).toBe('unanswered');
	});
});

describe('sending a command', () => {
	it('reads a network failure as no answer', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
		expect(await sendCommand('t', { type: 'step-on' }, 1, 'key-12345')).toEqual({
			ok: false,
			reason: 'unanswered'
		});
	});

	it('reads an HTML error page as no answer', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('<html>Error 1102: Worker exceeded resource limits</html>', {
					status: 503,
					headers: { 'content-type': 'text/html' }
				})
			)
		);
		expect((await sendCommand('t', { type: 'step-on' }, 1, 'key-12345')).reason).toBe('unanswered');
	});
});

describe('a poll', () => {
	it('treats an error page as nothing new, not a closed table', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('<html>1102</html>', { status: 503 }))
		);
		expect(await fetchSince('t', 3)).toBeNull();
	});
});
