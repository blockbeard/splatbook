import { error } from '@sveltejs/kit';
import {
	fetchTrees,
	findSection,
	ancestorsOf,
	childrenOf,
	siblingsInOrder
} from '$lib/reference/load';
import { buildLinkIndex, renderMarkdown } from '$lib/reference/render';
import type { PageLoad } from './$types';

/**
 * Load one section: its rendered body plus the navigation around it
 * (breadcrumb ancestors, immediate children, document-order prev/next). The
 * body is rendered to HTML here so wikilink resolution runs once, server-side.
 */
export const load: PageLoad = async ({ params, fetch }) => {
	const trees = await fetchTrees(params.game, fetch);
	const found = findSection(trees, params.section);
	if (!found) error(404, `No such rules section: "${params.section}"`);

	const { tree, index } = found;
	const section = tree.sections[index];
	const bodyHtml = renderMarkdown(section.body, params.game, buildLinkIndex(trees));

	return {
		docTitle: tree.title,
		section: { id: section.id, title: section.title },
		bodyHtml,
		ancestors: ancestorsOf(tree, index),
		children: childrenOf(tree, index),
		...siblingsInOrder(tree, index)
	};
};
