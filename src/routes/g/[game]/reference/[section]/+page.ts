import { error } from '@sveltejs/kit';
import {
	fetchTrees,
	findSection,
	ancestorsOf,
	childrenOf,
	siblingsInOrder,
	isVisible
} from '$lib/reference/load';
import { buildLinkIndex, renderMarkdown } from '$lib/reference/render';
import type { PageLoad } from './$types';

/**
 * Load one section: its rendered body plus the navigation around it
 * (breadcrumb ancestors, immediate children, document-order prev/next). The
 * body is rendered to HTML here so wikilink resolution runs once, server-side.
 * GM-only sections are treated as not-found unless the viewer is a campaign GM
 * (`gmContentVisible` from the reference layout), and wikilinks resolve only
 * against content visible to this viewer so their pages don't dangle.
 */
export const load: PageLoad = async ({ params, fetch, parent }) => {
	const { gmContentVisible } = await parent();
	const trees = await fetchTrees(params.game, fetch);
	const found = findSection(trees, params.section);
	if (!found || !isVisible(found.tree.sections[found.index], gmContentVisible))
		error(404, `No such rules section: "${params.section}"`);

	const { tree, index } = found;
	const section = tree.sections[index];
	const visibleTrees = trees.map((t) => ({
		...t,
		sections: t.sections.filter((s) => isVisible(s, gmContentVisible))
	}));
	const bodyHtml = renderMarkdown(section.body, params.game, buildLinkIndex(visibleTrees));

	return {
		docTitle: tree.title,
		section: { id: section.id, title: section.title },
		bodyHtml,
		ancestors: ancestorsOf(tree, index),
		children: childrenOf(tree, index),
		...siblingsInOrder(tree, index)
	};
};
