/**
 * Put a playable card table in the local database, for looking at one.
 *
 * There is no dev sign-in, and the table page is most of what phase 29 builds,
 * so this is how you get to it: it seeds an owner, a table, an admitted GM and
 * one player waiting to be let in, then prints the room token and both seat
 * tickets.
 *
 *   npx tsx tools/seed-card-table.ts
 *
 * The tickets go in the `sb_seats` cookie as `<token>.<seatId>.<secret>`, space
 * separated for more than one table. Development only — it writes to local.db.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readFile } from 'node:fs/promises';
import * as schema from '../src/lib/server/db/schema.ts';
import { createCardTable } from '../src/lib/server/db/card-tables.ts';
import { requestSeat, claimGmSeat } from '../src/lib/server/db/card-table-seats.ts';
import { hmtwCardTable } from '../src/lib/games/hmtw/card-table.ts';

async function main() {
const db = drizzle(new Database('local.db'), { schema });
migrate(db, { migrationsFolder: './drizzle' });
const [user] = await db.insert(schema.users).values({ email: `dev-${Date.now()}@x` }).returning();
const module = hmtwCardTable;
const pack = Object.fromEntries(
	await Promise.all(
		module.packFiles.map(async (f) => [
			f,
			JSON.parse(await readFile(`static/content-packs/hmtw/${f}`, 'utf8'))
		])
	)
);
const opening = module.create(
	pack as never,
	() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
);
const created = await createCardTable(db as never, {
	gameId: 'hmtw',
	name: 'Thursday game',
	ownerId: user.id,
	state: opening.state,
	stateVersion: opening.stateVersion
});
if (!created.ok) throw new Error(created.reason);
const gm = await requestSeat(db as never, created.table.id, 'Aldis the Wry');
if (!gm.ok) throw new Error(gm.reason);
await claimGmSeat(db as never, created.table.id, gm.ticket.seat.id);
const p2 = await requestSeat(db as never, created.table.id, 'Grimwold');
console.log(JSON.stringify({ token: created.table.roomToken, gm: gm.ticket, p2: p2.ok ? p2.ticket : null }));
}
main();
