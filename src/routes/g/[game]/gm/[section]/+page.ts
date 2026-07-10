import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * A single GM guide section. The heavy lifting (game lookup, data fetch, nav) is
 * the layout's; this just validates the section id against the guide's declared
 * sections and passes it through for the component to dispatch on.
 */
export const load: PageLoad = async ({ params, parent }) => {
	const { sections } = await parent();
	const section = sections.find((s) => s.id === params.section);
	if (!section) error(404, `No such GM guide section: "${params.section}"`);
	return { sectionId: section.id, sectionTitle: section.title };
};
