/**
 * A card table's picture: checked on the way in, stored as text, served as is.
 *
 * See `cardTablePictures` in schema.ts for why it is a base64 `data:` URL and
 * not a BLOB. The check here is the whole of the server's trust in an upload:
 * it must be exactly one of three raster types, its first bytes must say so,
 * and it must be under the size limit. Never SVG — an SVG is a document that
 * can carry script, and nothing here needs one.
 */

import { and, eq, ne } from 'drizzle-orm';
import type { Db } from './entities.ts';
import { cardTablePictures } from './schema.ts';
import { MAX_PICTURE_BYTES } from '../../card-table-limits.ts';

export const PICTURE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type PictureMime = (typeof PICTURE_MIMES)[number];

export type PictureCheck =
	| { ok: true; mime: PictureMime; bytes: number }
	| { ok: false; reason: 'not-a-data-url' | 'not-an-image' | 'too-large' | 'wrong-type' };

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** What the first bytes of each type must be. */
function looksLike(mime: PictureMime, head: Uint8Array): boolean {
	const at = (i: number, ...bytes: number[]) => bytes.every((b, k) => head[i + k] === b);
	if (mime === 'image/png') return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
	if (mime === 'image/jpeg') return at(0, 0xff, 0xd8, 0xff);
	// RIFF....WEBP
	return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
}

/**
 * Check an uploaded `data:` URL without decoding all of it: the shape and
 * alphabet by one regular expression, the size by arithmetic on the length,
 * and the type by decoding the first twelve bytes only.
 */
export function checkPicture(dataUrl: string): PictureCheck {
	const maxChars = Math.ceil(MAX_PICTURE_BYTES / 3) * 4 + 40;
	if (dataUrl.length > maxChars) return { ok: false, reason: 'too-large' };
	const match = DATA_URL.exec(dataUrl);
	if (!match) return { ok: false, reason: 'not-a-data-url' };
	const mime = match[1] as PictureMime;
	const body = match[2];
	const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
	const bytes = (body.length / 4) * 3 - padding;
	if (body.length % 4 !== 0 || bytes < 16) return { ok: false, reason: 'not-an-image' };
	if (bytes > MAX_PICTURE_BYTES) return { ok: false, reason: 'too-large' };
	const head = Uint8Array.from(atob(body.slice(0, 16)), (c) => c.charCodeAt(0));
	if (!looksLike(mime, head)) return { ok: false, reason: 'wrong-type' };
	return { ok: true, mime, bytes };
}

/** Put up a table's picture, replacing whatever it had. */
export async function putPicture(
	db: Db,
	tableId: string,
	picture: { id: string; mime: PictureMime; dataUrl: string; bytes: number }
): Promise<void> {
	await db
		.insert(cardTablePictures)
		.values({ tableId, ...picture })
		.onConflictDoUpdate({
			target: cardTablePictures.tableId,
			set: { id: picture.id, mime: picture.mime, dataUrl: picture.dataUrl, bytes: picture.bytes }
		});
}

/** A table's picture, if it is the one asked for. */
export async function getPicture(
	db: Db,
	tableId: string,
	id: string
): Promise<{ mime: string; dataUrl: string } | undefined> {
	const rows = await db
		.select({ mime: cardTablePictures.mime, dataUrl: cardTablePictures.dataUrl })
		.from(cardTablePictures)
		.where(and(eq(cardTablePictures.tableId, tableId), eq(cardTablePictures.id, id)))
		.limit(1);
	return rows[0];
}

/**
 * Delete a table's picture unless it is the one the state still names. Called
 * when a command changes which picture the table refers to — a new scene, a
 * reset, taking it down — so the bytes go with the reference.
 */
export async function keepOnlyPicture(db: Db, tableId: string, keep: string | null): Promise<void> {
	await db
		.delete(cardTablePictures)
		.where(
			keep === null
				? eq(cardTablePictures.tableId, tableId)
				: and(eq(cardTablePictures.tableId, tableId), ne(cardTablePictures.id, keep))
		);
}
