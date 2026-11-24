/**
 * Getting a picture onto a card table, in the browser (phase 31).
 *
 * The server stores a picture as the `data:` URL it receives and checks only
 * its shape, size and first bytes — it cannot afford to re-encode one (see
 * `cardTablePictures` in the schema). So the browser does the work: it scales
 * the image so its long edge is at most `PICTURE_LONG_EDGE`, re-encodes it,
 * and steps the quality and then the size down until it fits the limit.
 * Re-encoding also strips whatever a camera wrote into the file.
 */

import { MAX_PICTURE_BYTES, PICTURE_LONG_EDGE } from '$lib/card-table-limits';

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
	new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const toDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

export class PictureTooLarge extends Error {}

/** A file the GM chose, made ready to send: a WebP or JPEG `data:` URL under the limit. */
export async function preparePicture(file: File | Blob): Promise<string> {
	const bitmap = await createImageBitmap(file);
	try {
		const longest = Math.max(bitmap.width, bitmap.height);
		for (const edge of [PICTURE_LONG_EDGE, 2048, 1600, 1200]) {
			const scale = Math.min(1, edge / longest);
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(bitmap.width * scale));
			canvas.height = Math.max(1, Math.round(bitmap.height * scale));
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('No canvas');
			// White under the picture: JPEG has no transparency, and a map with a
			// transparent background otherwise turns black.
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			for (const quality of [0.85, 0.75, 0.6]) {
				// Safari has not always encoded WebP from a canvas, and asking
				// quietly hands back a PNG — so check what actually came out.
				let blob = await toBlob(canvas, 'image/webp', quality);
				if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
				if (blob && blob.size <= MAX_PICTURE_BYTES) return toDataUrl(blob);
			}
		}
		throw new PictureTooLarge();
	} finally {
		bitmap.close();
	}
}

/** Put a prepared picture up. Resolves to the table view, or to why not. */
export async function sendPicture(
	token: string,
	dataUrl: string
): Promise<{ ok: true; view: unknown } | { ok: false; reason: string }> {
	const res = await fetch(`/api/card-tables/${token}/picture`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ dataUrl })
	});
	const body = await res.json().catch(() => null);
	if (res.ok && body?.ok) return { ok: true, view: body };
	return { ok: false, reason: body?.reason ?? (res.status === 413 ? 'too-large' : 'refused') };
}

/** The picture a table names, as a `data:` URL to show, or null if it has gone. */
export async function fetchPicture(token: string, id: string): Promise<string | null> {
	const res = await fetch(`/api/card-tables/${token}/picture?id=${encodeURIComponent(id)}`);
	if (!res.ok) return null;
	const text = await res.text();
	// Only ever an image: anything else the server could not have stored.
	return /^data:image\/(png|jpeg|webp);base64,/.test(text) ? text : null;
}
