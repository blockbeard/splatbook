/**
 * Projections of a document tree into the artifacts the reference actually
 * serves — a nav spine, and one file per page.
 *
 * This is the build-time half of the reference (phase 26). Nothing here runs
 * in a request: `tools/build_pages.ts` calls it over the packs' whole-book
 * trees and writes the results, and the routes fetch those results. It lives
 * in `$lib` rather than in the tool so the projections are unit-testable
 * without generating files first, and so the app and the build share one
 * definition of what a "page" is.
 *
 * Why the split exists at all: the reference's loads are *universal*, so a
 * whole-book fetch is paid twice — once by the Worker on a cold isolate
 * (SvelteKit inlines the fetched JSON into the HTML for hydration to replay,
 * which is how one section page came to weigh 1.43 MB) and once by every
 * browser that hydrates. Memoising the parse (the phase-25 mitigation) only
 * moved those bytes between the two. The cure is to stop asking for the book.
 */

import { buildSectionTree, type SectionNode } from './document-tree';
import type { DocumentChapter, DocumentSection, DocumentTree, Visibility } from './document-tree';

/** A section stripped to what the sidebar needs. No `body`, and no `path` —
 * `DocumentSection.path` is carried by the trees but read by nothing. */
export interface NavSection {
	id: string;
	title: string;
	level: number;
	chapter?: string;
}

/** One document's nav spine: its chapters and its (capped, pre-filtered) sections. */
export interface NavDocument {
	id: string;
	title: string;
	chapters: DocumentChapter[];
	sections: NavSection[];
}

/** A minimal section reference — breadcrumbs, child lists, prev/next. */
export interface SectionRef {
	id: string;
	title: string;
}

/**
 * A child entry with the page that hosts it: itself for page-level sections,
 * the nearest page ancestor for inline (deeper-than-pageDepth) ones, whose
 * links become in-page anchors.
 */
export interface PageChildNode extends SectionRef {
	level: number;
	pageId: string;
	children: PageChildNode[];
}

/** An inline descendant rendered on its ancestor's page, under its own anchor. */
export interface InlineSection {
	id: string;
	title: string;
	level: number;
	kind?: string;
	body: string;
}

/**
 * Everything one section page renders, minus the markdown-to-HTML pass.
 *
 * Bodies stay markdown rather than pre-rendered HTML: rendering depends on the
 * game's `referenceOmitCallouts` and on wikilink resolution, and keeping both
 * at request time leaves one implementation of each instead of a build-time
 * copy that can drift from what the route does.
 */
export interface ReferencePage {
	docTitle: string;
	chapterId?: string;
	visibility: Visibility;
	id: string;
	title: string;
	kind?: string;
	body: string;
	inline: InlineSection[];
	ancestors: SectionRef[];
	children: PageChildNode[];
	prev: SectionRef | null;
	next: SectionRef | null;
}

const ref = (s: DocumentSection): SectionRef => ({ id: s.id, title: s.title });

/** Ancestor chain (root→parent) of the section at `index`, by heading level. */
export function ancestorsOf(tree: DocumentTree, index: number): SectionRef[] {
	const out: SectionRef[] = [];
	let level = tree.sections[index].level;
	for (let i = index - 1; i >= 0 && level > 1; i--) {
		if (tree.sections[i].level < level) {
			out.unshift(ref(tree.sections[i]));
			level = tree.sections[i].level;
		}
	}
	return out;
}

/** The contiguous block of descendants after `index` (exclusive start, exclusive end). */
function descendantRange(tree: DocumentTree, index: number): [number, number] {
	const level = tree.sections[index].level;
	let end = index + 1;
	while (end < tree.sections.length && tree.sections[end].level > level) end++;
	return [index + 1, end];
}

/** The full descendant tree of the section at `index`, as nested refs. */
function childTreeOf(tree: DocumentTree, index: number): Omit<PageChildNode, 'pageId'>[] {
	const [start, end] = descendantRange(tree, index);
	const toRef = (n: SectionNode<DocumentSection>): Omit<PageChildNode, 'pageId'> => ({
		id: n.section.id,
		title: n.section.title,
		level: n.section.level,
		children: n.children.map(toRef) as PageChildNode[]
	});
	return buildSectionTree(tree.sections.slice(start, end)).map(toRef);
}

/**
 * The sidebar spine: chapters plus sections no deeper than `maxLevel`,
 * filtered to what this reader may see.
 *
 * Chapters whose sections were all filtered out are dropped with them — a
 * gated chapter must not list by name in the sidebar or on the chapter-card
 * landing.
 */
export function buildNav(
	trees: DocumentTree[],
	{ maxLevel, gmVisible }: { maxLevel: number; gmVisible: boolean }
): NavDocument[] {
	return trees
		.map((t) => {
			const sections = t.sections
				.filter((s) => (s.visibility !== 'gm' || gmVisible) && s.level <= maxLevel)
				.map(({ id, title, level, chapter }) => ({ id, title, level, chapter }));
			const surviving = new Set(sections.map((s) => s.chapter));
			return {
				id: t.id,
				title: t.title,
				chapters: (t.chapters ?? []).filter((c) => surviving.has(c.id)),
				sections
			};
		})
		.filter((doc) => doc.sections.length > 0);
}

/**
 * One `ReferencePage` per page-level section (`level <= pageDepth`), carrying
 * its own body plus every inline descendant up to the next page-level section.
 *
 * `prev`/`next` walk pages over the *unfiltered* list, which is deliberate and
 * matches the behaviour this replaces: a gated neighbour stays reachable and
 * answers with the spoiler interstitial rather than vanishing from the
 * sequence, so opting in is always one click from where you got stuck.
 */
export function buildPages(tree: DocumentTree, pageDepth: number): ReferencePage[] {
	const pages = tree.sections.filter((s) => s.level <= pageDepth);
	const pageOrder = new Map(pages.map((s, i) => [s.id, i]));

	const withPageIds = (
		nodes: Omit<PageChildNode, 'pageId'>[],
		parentPageId: string
	): PageChildNode[] =>
		nodes.map((n) => {
			const pageId = n.level <= pageDepth ? n.id : parentPageId;
			return { ...n, pageId, children: withPageIds(n.children, pageId) };
		});

	const out: ReferencePage[] = [];
	tree.sections.forEach((section, index) => {
		if (section.level > pageDepth) return;

		let inlineEnd = index + 1;
		while (inlineEnd < tree.sections.length && tree.sections[inlineEnd].level > pageDepth) {
			inlineEnd++;
		}
		const inline = tree.sections.slice(index + 1, inlineEnd).map((s) => ({
			id: s.id,
			title: s.title,
			level: s.level,
			...(s.kind ? { kind: s.kind } : {}),
			body: s.body
		}));

		const i = pageOrder.get(section.id) ?? -1;
		out.push({
			docTitle: tree.title,
			...(section.chapter ? { chapterId: section.chapter } : {}),
			visibility: section.visibility,
			id: section.id,
			title: section.title,
			...(section.kind ? { kind: section.kind } : {}),
			body: section.body,
			inline,
			ancestors: ancestorsOf(tree, index),
			children: withPageIds(childTreeOf(tree, index), section.id),
			prev: i > 0 ? ref(pages[i - 1]) : null,
			next: i >= 0 && i + 1 < pages.length ? ref(pages[i + 1]) : null
		});
	});
	return out;
}

/** What `rules/pages/<id>.json` holds for a section with no page of its own. */
export interface ReferenceRedirect {
	/** The page that hosts this section; it renders there under `#<id>`. */
	redirectTo: string;
}

/**
 * Deep section id → the page that hosts it, for sections below `pageDepth`.
 *
 * These ids stay live URLs (search hits, wikilinks, links shared before the
 * depth cap existed) and the route redirects them to `hostId#deepId`. Each
 * becomes its own ~60-byte file rather than one shared map: a wikilink into
 * an h4 is an ordinary click, not an error path, so it should cost the same
 * single fetch a real page does — and with every id resolvable, a miss means
 * genuinely-not-found, which is what makes a 404 a 404.
 */
export function buildDeepLinks(tree: DocumentTree, pageDepth: number): Record<string, string> {
	const out: Record<string, string> = {};
	let host: string | undefined;
	for (const section of tree.sections) {
		if (section.level <= pageDepth) host = section.id;
		else if (host) out[section.id] = host;
	}
	return out;
}

/**
 * The two properties flat per-page files depend on, checked rather than
 * assumed.
 *
 * Both hold today by construction, and both would break routing *silently* if
 * a future reimport changed how ids are minted — a deep link would 404, or one
 * section would overwrite another's file. Failing the build is the cheap
 * version of finding that out.
 */
export function assertPackInvariants(trees: DocumentTree[]): void {
	const seen = new Map<string, string>();
	for (const tree of trees) {
		for (const section of tree.sections) {
			// A section id becomes a filename under `rules/pages/`, so it must be
			// unique across the whole pack (not merely within its tree, which the
			// schema already enforces) and must not escape the directory.
			const clash = seen.get(section.id);
			if (clash) {
				throw new Error(
					`section id "${section.id}" appears in both "${clash}" and "${tree.id}" — ` +
						`page ids must be unique across a pack`
				);
			}
			seen.set(section.id, tree.id);
			if (!/^[a-z0-9][a-z0-9-]*$/.test(section.id)) {
				throw new Error(
					`section id "${section.id}" (in "${tree.id}") is not a safe file name — ` +
						`expected lowercase letters, digits and hyphens`
				);
			}
		}
	}
}
