import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Liveness, plus a real round-trip to whichever database this deployment has
 * (SQLite on node/atlas, D1 on Cloudflare). Awaited, because D1 is async. */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		await locals.db.run(sql`select 1`);
		return json({ status: 'ok', db: 'ok' });
	} catch {
		return json({ status: 'degraded', db: 'unreachable' }, { status: 503 });
	}
};
