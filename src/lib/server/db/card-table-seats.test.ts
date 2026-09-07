/**
 * Seat identity tests. The points of interest: nobody is locked out of a table
 * with no GM; a vacant GM seat is claimable; re-seating hands a player back the
 * same row (and therefore the same cards) with a fresh ticket; and a secret is
 * only ever stored as a hash.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import { createCardTable } from './card-tables.ts';
import {
	admitSeat,
	claimGmSeat,
	gmSeatOf,
	removeSeat,
	requestSeat,
	reseat,
	resolveSeat,
	vacateGmSeat
} from './card-table-seats.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let tableId: string;
let ownerId: string;

beforeEach(async () => {
	db = freshDb();
	const [user] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	ownerId = user.id;
	const table = await createCardTable(db, {
		gameId: 'hmtw',
		name: 'Thursday',
		ownerId,
		state: {},
		stateVersion: 5
	});
	tableId = table.id;
});

/** The common opening: someone arrives first and takes the GM seat. */
async function seatedGm() {
	const ticket = await requestSeat(db, tableId, 'The GM');
	await claimGmSeat(db, tableId, ticket.seat.id);
	return ticket;
}

describe('arriving at a table', () => {
	it('admits the first person, because there is nobody to ask', async () => {
		// Joins need a GM's approval, so a table whose first arrival had to wait
		// would have nobody able to grant it.
		const ticket = await requestSeat(db, tableId, 'Grimwold');
		expect(ticket.seat.status).toBe('admitted');
	});

	it('makes everyone after that wait for the GM', async () => {
		await seatedGm();
		const ticket = await requestSeat(db, tableId, 'Grimwold');
		expect(ticket.seat.status).toBe('pending');
	});

	it('lets the GM admit, and turn away', async () => {
		const gm = await seatedGm();
		const first = await requestSeat(db, tableId, 'Grimwold');
		const second = await requestSeat(db, tableId, 'A stranger');

		expect((await admitSeat(db, tableId, first.seat.id, gm.seat.id))?.status).toBe('admitted');
		expect(await removeSeat(db, tableId, second.seat.id, gm.seat.id)).toBe(true);
		// A leaked room token buys a pending request, not a seat at a live table.
		const [gone] = await db
			.select()
			.from(schema.cardTableSeats)
			.where(eq(schema.cardTableSeats.id, second.seat.id));
		expect(gone).toBeUndefined();
	});

	it('lets nobody but the GM admit or remove', async () => {
		const gm = await seatedGm();
		const player = await requestSeat(db, tableId, 'Grimwold');
		await admitSeat(db, tableId, player.seat.id, gm.seat.id);
		const waiting = await requestSeat(db, tableId, 'Another');

		expect(await admitSeat(db, tableId, waiting.seat.id, player.seat.id)).toBeUndefined();
		expect(await removeSeat(db, tableId, waiting.seat.id, player.seat.id)).toBe(false);
	});
});

describe('the GM seat', () => {
	it('is claimable while vacant, and only while vacant', async () => {
		const gm = await seatedGm();
		const player = await requestSeat(db, tableId, 'Grimwold');
		expect(await claimGmSeat(db, tableId, player.seat.id)).toBeUndefined();

		await vacateGmSeat(db, tableId, gm.seat.id);
		expect(await claimGmSeat(db, tableId, player.seat.id)).toBeDefined();
		expect((await gmSeatOf(db, tableId))?.id).toBe(player.seat.id);
	});

	it('rescues a table whose GM lost their cookie', async () => {
		// The failure this rule exists for: with joins gated on approval and no
		// way to take a vacant seat, a GM who loses their claim locks out the
		// whole table including themselves.
		const gm = await seatedGm();
		const player = await requestSeat(db, tableId, 'Grimwold');
		await admitSeat(db, tableId, player.seat.id, gm.seat.id);

		await vacateGmSeat(db, tableId, gm.seat.id);
		await claimGmSeat(db, tableId, player.seat.id);

		// And the table can take new arrivals again.
		const newcomer = await requestSeat(db, tableId, 'Late arrival');
		expect(await admitSeat(db, tableId, newcomer.seat.id, player.seat.id)).toBeDefined();
	});

	it('admits the next arrival outright once the seat is empty', async () => {
		const gm = await seatedGm();
		await vacateGmSeat(db, tableId, gm.seat.id);
		expect((await requestSeat(db, tableId, 'Anyone')).seat.status).toBe('admitted');
	});
});

describe('proving a seat is yours', () => {
	it('accepts the ticket it issued, and nothing else', async () => {
		const ticket = await requestSeat(db, tableId, 'Grimwold');
		const claim = { seatId: ticket.seat.id, secret: ticket.secret };
		expect((await resolveSeat(db, tableId, claim))?.id).toBe(ticket.seat.id);
		expect(await resolveSeat(db, tableId, { ...claim, secret: 'wrong' })).toBeUndefined();
		expect(await resolveSeat(db, tableId, undefined)).toBeUndefined();
	});

	it('never stores the secret itself', async () => {
		// A leaked database must not be a set of keys to every table.
		const ticket = await requestSeat(db, tableId, 'Grimwold');
		const [row] = await db
			.select()
			.from(schema.cardTableSeats)
			.where(eq(schema.cardTableSeats.id, ticket.seat.id));
		expect(row.claimSecret).not.toBe(ticket.secret);
		expect(row.claimSecret).toMatch(/^[0-9a-f]{64}$/);
	});

	it('will not take a ticket issued for a different table', async () => {
		const other = await createCardTable(db, {
			gameId: 'hmtw',
			name: 'Other',
			ownerId,
			state: {},
			stateVersion: 5
		});
		const ticket = await requestSeat(db, tableId, 'Grimwold');
		expect(
			await resolveSeat(db, other.id, { seatId: ticket.seat.id, secret: ticket.secret })
		).toBeUndefined();
	});

	it('recognises a signed-in user without a ticket at all', async () => {
		// Which is how an account keeps its seat across devices.
		const ticket = await requestSeat(db, tableId, 'Grimwold', ownerId);
		expect((await resolveSeat(db, tableId, undefined, ownerId))?.id).toBe(ticket.seat.id);
	});
});

describe('re-seating', () => {
	it('hands back the same seat with a new ticket, and kills the old one', async () => {
		const gm = await seatedGm();
		const player = await requestSeat(db, tableId, 'Grimwold');
		await admitSeat(db, tableId, player.seat.id, gm.seat.id);

		const fresh = await reseat(db, tableId, player.seat.id, gm.seat.id);
		expect(fresh?.seat.id).toBe(player.seat.id);
		expect(fresh?.secret).not.toBe(player.secret);

		// The cleared cookie no longer works; the new ticket does.
		expect(
			await resolveSeat(db, tableId, { seatId: player.seat.id, secret: player.secret })
		).toBeUndefined();
		expect(
			await resolveSeat(db, tableId, { seatId: player.seat.id, secret: fresh!.secret })
		).toBeDefined();
	});

	it('keeps the seat’s own identity, which is where its cards hang', async () => {
		// Private zones are keyed to the seat row, so a returning player finds
		// their hand as they left it. This asserts the row survives untouched.
		const gm = await seatedGm();
		const player = await requestSeat(db, tableId, 'Grimwold');
		await admitSeat(db, tableId, player.seat.id, gm.seat.id);

		const fresh = await reseat(db, tableId, player.seat.id, gm.seat.id);
		expect(fresh?.seat.id).toBe(player.seat.id);
		expect(fresh?.seat.name).toBe('Grimwold');
		expect(fresh?.seat.status).toBe('admitted');
	});

	it('is the GM’s to do, which is what stops seat theft', async () => {
		const gm = await seatedGm();
		const player = await requestSeat(db, tableId, 'Grimwold');
		await admitSeat(db, tableId, player.seat.id, gm.seat.id);
		const thief = await requestSeat(db, tableId, 'Opportunist');

		expect(await reseat(db, tableId, player.seat.id, thief.seat.id)).toBeUndefined();
	});
});
