import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
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
 *
 * A gated section (`visibility: 'gm'`, Book II) the reader hasn't opted into
 * (`showSetting`, from the reference layout — commit 97) doesn't 404 outright:
 * if the game configured an `interstitialSectionId` (the book's own case for
 * why a reader might want to opt in), that passage renders in its place, with
 * the opt-in button underneath doing the deciding. A game with no such
 * section configured keeps the old flat 404 — same as before this existed.
 * Once opted in, revisiting the very same URL loads normally: the interstitial
 * is this same load rerunning against an updated `showSetting`, not a
 * separate page.
 */
export const load: PageLoad = async ({ params, fetch, parent }) => {
	const { showSetting } = await parent();
	const trees = await fetchTrees(params.game, fetch);
	const found = findSection(trees, params.section);
	if (!found) error(404, `No such rules section: "${params.section}"`);

	const { tree, index } = found;
	const section = tree.sections[index];

	if (!isVisible(section, showSetting)) {
		const interstitialId = getGame(params.game)?.referenceSpoilers?.interstitialSectionId;
		const passage = interstitialId ? findSection(trees, interstitialId) : undefined;
		if (!passage) error(404, `No such rules section: "${params.section}"`);

		const passageSection = passage.tree.sections[passage.index];
		return {
			interstitial: true as const,
			requestedSectionId: params.section,
			docTitle: passage.tree.title,
			section: { id: passageSection.id, title: passageSection.title },
			// Unfiltered link index: the passage is short and self-contained, and
			// a link that resolves to another gated page just shows its own
			// interstitial in turn — display-level gating, not a security
			// boundary that a dangling link would breach.
			bodyHtml: renderMarkdown(
				passageSection.body,
				params.game,
				buildLinkIndex(trees),
				passageSection.kind
			),
			ancestors: [],
			children: [],
			prev: null,
			next: null
		};
	}

	const visibleTrees = trees.map((t) => ({
		...t,
		sections: t.sections.filter((s) => isVisible(s, showSetting))
	}));
	const bodyHtml = renderMarkdown(
		section.body,
		params.game,
		buildLinkIndex(visibleTrees),
		section.kind
	);

	return {
		interstitial: false as const,
		docTitle: tree.title,
		section: { id: section.id, title: section.title },
		bodyHtml,
		ancestors: ancestorsOf(tree, index),
		children: childrenOf(tree, index),
		...siblingsInOrder(tree, index)
	};
};
