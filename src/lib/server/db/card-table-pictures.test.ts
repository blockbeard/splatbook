/**
 * A card table's picture: what the server accepts, and that every way a table
 * or a scene ends takes the picture with it — the six-week promise, and "take
 * it down", are only true if the bytes go and not merely the reference.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import {
	TABLE_RETENTION_MS,
	createCardTable,
	deleteCardTable,
	expireByToken,
	sweepExpiredTables
} from './card-tables.ts';
import { checkPicture, getPicture, keepOnlyPicture, putPicture } from './card-table-pictures.ts';
import { MAX_PICTURE_BYTES } from '../../card-table-limits.ts';

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const pad = (head: number[], length = 64) => [...head, ...new Array(length - head.length).fill(0)];
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const url = (mime: string, bytes: number[]) => `data:${mime};base64,${b64(bytes)}`;

describe('what a picture upload must be', () => {
	it('accepts the three raster types when their first bytes agree', () => {
		expect(checkPicture(url('image/png', PNG))).toMatchObject({ ok: true, mime: 'image/png' });
		expect(checkPicture(url('image/jpeg', JPEG))).toMatchObject({ ok: true, mime: 'image/jpeg' });
		expect(checkPicture(url('image/webp', WEBP))).toMatchObject({ ok: true, bytes: 64 });
	});

	it('refuses a type its bytes contradict', () => {
		expect(checkPicture(url('image/png', JPEG))).toEqual({ ok: false, reason: 'wrong-type' });
	});

	it('refuses SVG, and anything that is not a base64 image data: URL', () => {
		const svg = `data:image/svg+xml;base64,${btoa('<svg onload="alert(1)"/>')}`;
		expect(checkPicture(svg)).toEqual({ ok: false, reason: 'not-a-data-url' });
		expect(checkPicture('https://example.com/a.png')).toEqual({
			ok: false,
			reason: 'not-a-data-url'
		});
		expect(checkPicture('data:image/png;base64,not base64!')).toEqual({
			ok: false,
			reason: 'not-a-data-url'
		});
	});

	it('refuses one over the size limit without decoding it', () => {
		const big = `data:image/png;base64,${'A'.repeat(Math.ceil(MAX_PICTURE_BYTES / 3) * 4 + 400)}`;
		expect(checkPicture(big)).toEqual({ ok: false, reason: 'too-large' });
	});
});

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let owner: string;

beforeEach(async () => {
	db = freshDb();
	const [a] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	owner = a.id;
});

async function tableWithPicture(id = 'pic-1') {
	const made = await createCardTable(db, {
		gameId: 'hmtw',
		name: 'Arena',
		ownerId: owner,
		state: {},
		stateVersion: 12
	});
	if (!made.ok) throw new Error('setup');
	await putPicture(db, made.table.id, {
		id,
		mime: 'image/png',
		dataUrl: url('image/png', PNG),
		bytes: 64
	});
	return made.table;
}

const pictureRows = async (tableId: string) =>
	db.select().from(schema.cardTablePictures).where(eq(schema.cardTablePictures.tableId, tableId));

describe('a table’s picture', () => {
	it('is served only when it is the one asked for', async () => {
		const table = await tableWithPicture('pic-1');
		expect(await getPicture(db, table.id, 'pic-1')).toMatchObject({ mime: 'image/png' });
		expect(await getPicture(db, table.id, 'pic-0')).toBeUndefined();
	});

	it('is replaced, not added to, when a new one goes up', async () => {
		const table = await tableWithPicture('pic-1');
		await putPicture(db, table.id, {
			id: 'pic-2',
			mime: 'image/jpeg',
			dataUrl: url('image/jpeg', JPEG),
			bytes: 64
		});
		const rows = await pictureRows(table.id);
		expect(rows.map((r) => r.id)).toEqual(['pic-2']);
	});

	it('goes when the table stops naming it, and stays while it does', async () => {
		const table = await tableWithPicture('pic-1');
		await keepOnlyPicture(db, table.id, 'pic-1');
		expect(await pictureRows(table.id)).toHaveLength(1);
		await keepOnlyPicture(db, table.id, null);
		expect(await pictureRows(table.id)).toHaveLength(0);
	});

	it('goes with the table when its owner deletes it', async () => {
		const table = await tableWithPicture();
		expect(await deleteCardTable(db, table.id, owner)).toBe(true);
		expect(await pictureRows(table.id)).toHaveLength(0);
	});

	it('goes with the table when a stale link retires it', async () => {
		const table = await tableWithPicture();
		const later = Date.now() + TABLE_RETENTION_MS + 1000;
		expect(await expireByToken(db, table.roomToken, later)).toBe(true);
		expect(await pictureRows(table.id)).toHaveLength(0);
	});

	it('goes with the table when the sweep retires it', async () => {
		const table = await tableWithPicture();
		const later = Date.now() + TABLE_RETENTION_MS + 1000;
		expect(await sweepExpiredTables(db, 5, later)).toBe(1);
		expect(await pictureRows(table.id)).toHaveLength(0);
	});
});
