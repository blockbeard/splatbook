/**
 * Entity PDF endpoint (commit 120) — `GET /[game]/[type]/pdf?id=`. Generic
 * shell: the game module's entity type registers a `pdf` builder; this route
 * only authenticates, loads the entity owner-scoped (the same gate as any
 * other read), and hands the opaque blob plus the event's `fetch` through.
 * The shell never looks inside the blob or the bytes.
 */

import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import { getEntity } from '$lib/server/db/entities';
import { pdfResponse } from '$lib/pdf';
import { imposeSaddleStitch } from '$lib/pdf/imposition';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals, fetch }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to download a PDF.');

	const type = getGame(params.game)?.entityTypes[params.type];
	if (!type?.pdf) error(404, 'No PDF for this.');

	const id = url.searchParams.get('id');
	if (!id) error(400, 'Which one? Pass ?id=.');

	const entity = await getEntity(locals.db, id, session.user.id);
	if (!entity) error(404, 'No such entity.');

	const { bytes, filename } = await type.pdf(entity.data as object, fetch);

	// ?booklet=1 (commit 121): the same document imposed as a saddle-stitch
	// booklet — pages paired two-up onto landscape sheets in fold order, print
	// duplex and fold. Generic: imposition happens on the finished bytes, so
	// the game's layout code doesn't know booklets exist.
	if (url.searchParams.get('booklet') === '1') {
		return pdfResponse(await imposeSaddleStitch(bytes), filename.replace(/\.pdf$/, '-booklet.pdf'));
	}
	return pdfResponse(bytes, filename);
};
