/**
 * Loading and navigation helpers for the rules reference.
 *
 * Trees are fetched from the served content pack (`/content-packs/<game>/…`).
 * The JSON is already validated at build/CI by `npm run validate:packs`, so the
 * runtime trusts it and skips re-parsing through Zod — the reference stays lean
 * and works client-side (and offline once cached).
 */

import { base } from '$app/paths';
import type { DocumentChapter, DocumentSection, DocumentTree } from './document-tree';
import type { PackManifest } from '$lib/packs/types';

/** The subset of `fetch` a SvelteKit `load` provides. */
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** A lightweight table-of-contents entry — a section without its body/pages. */
export type TocSection = Pick<
	DocumentSection,
	'id' | 'title' | 'level' | 'path' | 'visibility' | 'chapter'
>;

/** One document's TOC: its id/title/chapters plus its sections, stripped of bodies. */
export interface TocDocument {
	id: string;
	title: string;
	/** Chapters in reading order (one per source file) — the spine for the
	 * landing page's chapter cards and the sidebar's collapsible entries.
	 * Empty for a tree generated before commit 90/91's reimport. */
	chapters: DocumentChapter[];
	sections: TocSection[];
}

/** A minimal section reference for breadcrumbs, child lists, and prev/next. */
export interface SectionRef {
	id: string;
	title: string;
}

/**
 * Section-visibility predicate for the current viewer. GM-only sections (Book II)
 * are hidden unless `gmVisible` is true — the phase-9 gate, computed server-side
 * from campaign-GM membership (`isGmOfAnyCampaign`) and threaded down through the
 * reference layout's `gmContentVisible`. Defaults to hidden, so any caller that
 * forgets to pass the flag fails closed.
 */
export function isVisible(
	section: Pick<DocumentSection, 'visibility'>,
	gmVisible = false
): boolean {
	return section.visibility !== 'gm' || gmVisible;
}

async function getJson<T>(fetchFn: Fetcher, url: string): Promise<T> {
	const res = await fetchFn(url);
	if (!res.ok) throw new Error(`reference: failed to load ${url} (${res.status})`);
	return (await res.json()) as T;
}

/** Fetch every rules document tree listed in a game's pack manifest. */
export async function fetchTrees(gameId: string, fetchFn: Fetcher): Promise<DocumentTree[]> {
	const root = `${base}/content-packs/${gameId}`;
	const manifest = await getJson<PackManifest>(fetchFn, `${root}/manifest.json`);
	const ruleFiles = manifest.files.filter((f) => f.startsWith('rules/')).sort();
	return Promise.all(ruleFiles.map((f) => getJson<DocumentTree>(fetchFn, `${root}/${f}`)));
}

/** Project trees to their TOC form, optionally dropping sections that fail a filter. */
export function tocOf(
	trees: DocumentTree[],
	include: (s: DocumentSection) => boolean = () => true
): TocDocument[] {
	return trees.map((t) => ({
		id: t.id,
		title: t.title,
		chapters: t.chapters ?? [],
		sections: t.sections.filter(include).map(({ id, title, level, path, visibility, chapter }) => ({
			id,
			title,
			level,
			path,
			visibility,
			chapter
		}))
	}));
}

/** Locate a section by id across trees. */
export function findSection(
	trees: DocumentTree[],
	id: string
): { tree: DocumentTree; index: number } | undefined {
	for (const tree of trees) {
		const index = tree.sections.findIndex((s) => s.id === id);
		if (index !== -1) return { tree, index };
	}
	return undefined;
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

/** Immediate child sections of the section at `index` (the shallowest descendants). */
export function childrenOf(tree: DocumentTree, index: number): SectionRef[] {
	const [start, end] = descendantRange(tree, index);
	const block = tree.sections.slice(start, end);
	if (block.length === 0) return [];
	const min = Math.min(...block.map((s) => s.level));
	return block.filter((s) => s.level === min).map(ref);
}

/** Previous/next sections in document order within the same tree. */
export function siblingsInOrder(
	tree: DocumentTree,
	index: number
): { prev: SectionRef | null; next: SectionRef | null } {
	return {
		prev: index > 0 ? ref(tree.sections[index - 1]) : null,
		next: index < tree.sections.length - 1 ? ref(tree.sections[index + 1]) : null
	};
}
