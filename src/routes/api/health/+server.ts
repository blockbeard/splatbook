import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

export function GET() {
	try {
		db.run(sql`select 1`);
		return json({ status: 'ok', db: 'ok' });
	} catch {
		return json({ status: 'degraded', db: 'unreachable' }, { status: 503 });
	}
}
