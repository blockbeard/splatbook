import { error, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getGame } from '$lib/games';
import { fetchLinkIndex, fetchPage, isRedirect, isVisible } from '$lib/reference/load';
import { renderMarkdown } from '$lib/reference/render';
import type { PageLoad } from './$types';

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
 * Load one section from its own page artifact (phase 26): the body it renders,
 * the inline descendants that render beneath it, and the navigation around it
 * — breadcrumb ancestors, the child tree, document-order prev/next — all
 * precomputed at build time by `tools/build_pages.ts`. The body is rendered to
 * HTML here so wikilink resolution runs once, server-side.
 *
 * A section with no page of its own (deeper than the game's
 * `referencePageDepth`) gets a redirect stub instead, sending it to its host
 * page's anchor. That keeps every existing URL — search hits, wikilinks, old
 * deep links — live, and costs the same single fetch a real page does.
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

	const section = await fetchPage(params.game, params.section, fetch);
	if (!section) error(404, `No such rules section: "${params.section}"`);
	if (isRedirect(section)) {
		redirect(302, `${base}/${params.game}/reference/${section.redirectTo}#${params.section}`);
	}

	// Wikilinks resolve against the pack's prebuilt, unfiltered link index.
	// Before phase 26 this index was derived per request from whichever trees
	// the reader could see, so a game with no spoiler interstitial degraded
	// links into gated sections to plain labels. Both live games ship an
	// interstitial (and so used the unfiltered index anyway), and a live link
	// that lands on the opt-in beats a dead one: the label is shown either way,
	// so nothing is withheld by breaking the path to it.
	const linkIndex = await fetchLinkIndex(params.game, fetch);

	if (!isVisible(section, showSetting)) {
		const interstitialId = getGame(params.game)?.referenceSpoilers?.interstitialSectionId;
		const passage = interstitialId ? await fetchPage(params.game, interstitialId, fetch) : null;
		if (!passage || isRedirect(passage)) error(404, `No such rules section: "${params.section}"`);

		return {
			interstitial: true as const,
			requestedSectionId: params.section,
			docTitle: passage.docTitle,
			chapterId: passage.chapterId,
			section: { id: passage.id, title: passage.title },
			bodyHtml: renderMarkdown(passage.body, params.game, linkIndex, passage.kind),
			isContentsPage: false,
			ancestors: [],
			children: [],
			prev: null,
			next: null
		};
	}

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
	for (const inline of section.inline) {
		const level = Math.min(inline.level, 6);
		const id = escapeHtml(inline.id);
		bodyHtml +=
			`<h${level} id="${id}">` +
			`<a class="heading-link" href="#${id}">${escapeHtml(inline.title)}</a>` +
			`</h${level}>\n` +
			renderMarkdown(inline.body, params.game, linkIndex, inline.kind);
	}

	return {
		interstitial: false as const,
		docTitle: section.docTitle,
		chapterId: section.chapterId,
		section: { id: section.id, title: section.title },
		bodyHtml,
		isContentsPage: isFrontMatterOnly(bodyHtml) && section.children.length > 0,
		ancestors: section.ancestors,
		children: section.children,
		prev: section.prev,
		next: section.next
	};
};
