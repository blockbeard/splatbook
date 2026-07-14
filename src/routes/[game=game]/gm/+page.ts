import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** `/[game=game]/gm` lands on the first guide section. */
export const load: PageLoad = async ({ params, parent }) => {
	const { sections } = await parent();
	const first = sections[0]?.id;
	if (first) redirect(307, `${base}/${params.game}/gm/${first}`);
};
