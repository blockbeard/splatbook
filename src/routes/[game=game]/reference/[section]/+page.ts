import { error, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getGame } from '$lib/games';
import {
	fetchTrees,
	findSection,
	ancestorsOf,
	childTreeOf,
	isVisible,
	type SectionRefNode
} from '$lib/reference/load';
import { buildLinkIndex, renderMarkdown } from '$lib/reference/render';
import type { PageLoad } from './$types';

/** `SectionRefNode` plus the page that hosts it — itself for page-level
 * sections, the nearest page ancestor for inline (deeper-than-pageDepth)
 * ones, whose links become in-page anchors. */
export interface PageChildNode extends Omit<SectionRefNode, 'children'> {
	pageId: string;
	children: PageChildNode[];
}

const escapeHtml = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * True when a page's body is only front matter — chapter ledes, epigraphs, the
 * boxed lead-in a kind-tagged heading produces — and carries no prose of its
 * own.
 *
 * These pages exist because the book has chapters and the reference gives every
 * heading a page: "Chapter 1: The Basics" and "The Omphalic Market" are a
 * lead-in and a list of what's inside, with no rule on them anywhere. They were
 * dressed exactly like a page that answers a question, so a reader mid-session
 * couldn't tell from the top of the screen whether they had arrived or were
 * still navigating. Knowing which kind of page this is lets the route promote
 * the child list into the contents page it actually is.
 *
 * Detected from the rendered HTML rather than the markdown because that's where
 * the question is settled: callouts have become `<aside>`s by now, whatever
 * shape they had in the source, and a game's `referenceOmitCallouts` has
 * already removed what it removes. Drop every aside and see whether any text
 * survives.
 */
const isFrontMatterOnly = (html: string): boolean =>
	html
		.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/g, '')
		.replace(/<[^>]+>/g, '')
		.trim() === '';

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

	// Page granularity (referencePageDepth): a section deeper than the game's
	// page depth has no page of its own — its canonical home is the nearest
	// page ancestor, where it renders inline under an anchor. Redirecting
	// keeps every existing URL (search hits, wikilinks, old deep links) live.
	const pageDepth = getGame(params.game)?.referencePageDepth ?? Infinity;
	if (section.level > pageDepth) {
		let p = index - 1;
		while (p >= 0 && tree.sections[p].level > pageDepth) p--;
		if (p >= 0) {
			redirect(302, `${base}/${params.game}/reference/${tree.sections[p].id}#${params.section}`);
		}
	}

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
			isContentsPage: false,
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
	// Body links resolve against the *unfiltered* trees when the game ships an
	// interstitial: a link into a gated section then stays a live link that
	// lands on the interstitial with the opt-in (HMtW's Index alone has 34
	// such links; degrading them to dead text hides nothing — the label still
	// shows — it just breaks the path to opting in). Without an interstitial a
	// gated link would 404, so those games keep the degrade-to-label behavior.
	const hasInterstitial = !!getGame(params.game)?.referenceSpoilers?.interstitialSectionId;
	const linkIndex = buildLinkIndex(hasInterstitial ? trees : visibleTrees);

	// A page renders its own body plus every inline descendant (deeper than
	// pageDepth, up to the next page-level section) as a real heading carrying
	// the section id as its anchor.
	//
	// The heading's text is a link to its own anchor, which is the whole of the
	// "share this rule" feature (phase 27). These headings are the granularity
	// people quote — a talent entry, an alchemical substance, one of the 52
	// items in "An incomplete list of pretty things" — and their URLs already
	// worked; there was just no way to obtain one short of reading the page
	// source. A link hands both platforms their native affordance: right-click
	// → Copy Link Address on desktop, long-press → Copy Link on touch, and
	// tapping it puts the anchor in the address bar, so the URL becomes the deep
	// link. No JS, no clipboard API, and — the thing that sank three richer
	// designs — no glyph added to prose that carries no icons.
	//
	// `#id` rather than an absolute href on purpose: it resolves against the
	// current page, so "Copy Link Address" yields the full URL while the markup
	// stays origin-agnostic (embed mode and the tailnet host included).
	let bodyHtml = renderMarkdown(section.body, params.game, linkIndex, section.kind);
	let inlineEnd = index + 1;
	while (inlineEnd < tree.sections.length && tree.sections[inlineEnd].level > pageDepth) {
		inlineEnd++;
	}
	for (const inline of tree.sections.slice(index + 1, inlineEnd)) {
		const level = Math.min(inline.level, 6);
		const id = escapeHtml(inline.id);
		bodyHtml +=
			`<h${level} id="${id}">` +
			`<a class="heading-link" href="#${id}">${escapeHtml(inline.title)}</a>` +
			`</h${level}>\n` +
			renderMarkdown(inline.body, params.game, linkIndex, inline.kind);
	}

	// Children keep the full tree for the "In this section" listing, each node
	// annotated with its hosting page so inline entries link as anchors.
	const withPageIds = (nodes: SectionRefNode[], parentPageId: string): PageChildNode[] =>
		nodes.map((n) => {
			const pageId = n.level <= pageDepth ? n.id : parentPageId;
			return { ...n, pageId, children: withPageIds(n.children, pageId) };
		});
	const children = withPageIds(childTreeOf(tree, index), section.id);

	// Prev/next walk pages, not every heading — inline sections aren't stops.
	const pages = tree.sections.filter((s) => s.level <= pageDepth);
	const pageIndex = pages.findIndex((s) => s.id === section.id);
	const pageRef = (s: (typeof pages)[number] | undefined) =>
		s ? { id: s.id, title: s.title } : null;

	return {
		interstitial: false as const,
		docTitle: tree.title,
		section: { id: section.id, title: section.title },
		bodyHtml,
		isContentsPage: isFrontMatterOnly(bodyHtml) && children.length > 0,
		ancestors: ancestorsOf(tree, index),
		children,
		prev: pageIndex > 0 ? pageRef(pages[pageIndex - 1]) : null,
		next: pageIndex >= 0 ? pageRef(pages[pageIndex + 1]) : null
	};
};
