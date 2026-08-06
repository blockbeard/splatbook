/**
 * Wikilink resolution without a document tree — the piece of the reference
 * renderer every *other* surface needs (phase 21).
 *
 * The full renderer (`render.ts`) turns a section's body into HTML, and it can
 * afford to: the reference routes already hold every `DocumentTree`. But pack
 * *data* quotes the same vault text — a basic move ends "see
 * `[[06 - Player Moves#^clash|Clash]]`", a steading asset bolds a phrase — and
 * the move cards, gear rows, and steading lines that print it hold no trees at
 * all. Fetching ~3 MB of rules JSON to resolve a handful of links would be
 * absurd, so the link lookups live here, tree-free:
 *
 *  - `buildLinkIndex(trees)` still derives the lookups from trees (the
 *    reference routes and the build tool both use it), and
 *  - `serializeLinkIndex`/`deserializeLinkIndex` round-trip it through the
 *    compact `link-index.json` artifact `tools/build_search.ts` emits next to
 *    the search index — a derived file, never hand-edited, absent from the
 *    manifest like its sibling.
 *  - `resolveWikilinks(text, index, hrefFor)` rewrites `[[…]]` links to plain
 *    markdown links (`[label](href)`), leaving everything else untouched, so
 *    the result renders through whatever markdown component the caller
 *    already uses. `hrefFor` keeps routing the caller's problem — this module
 *    imports nothing from the app and runs in node tooling unchanged.
 *
 * Unresolvable links degrade to their label as plain text: the prose must
 * never show raw `[[…]]` syntax.
 */

import type { DocumentTree } from './document-tree';

/** What a wikilink can resolve to: an internal section id, or an external
 * URL (phase 22 — e.g. a curated term pointing at an official course page).
 * External targets render as real outbound links (`target="_blank"`). */
export type LinkTarget = string | { url: string };

/** Section lookups for resolving wikilink targets: by heading title, and by
 * named block id (`^clash`) — the vault's newer, stable cross-reference form. */
export interface LinkIndex {
	byTitle: Map<string, LinkTarget[]>;
	byBlockId: Map<string, LinkTarget[]>;
}

/** The JSON shape `link-index.json` carries — `LinkIndex` with plain objects. */
export interface SerializedLinkIndex {
	byTitle: Record<string, LinkTarget[]>;
	byBlockId: Record<string, LinkTarget[]>;
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const IMAGE_EMBED = /!\[\[[^\]]*\]\]/g;

const norm = (s: string): string => s.replace(/[*_`]/g, '').trim().toLowerCase();
const slug = (s: string): string =>
	norm(s)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

function addTo(map: Map<string, LinkTarget[]>, key: string, id: LinkTarget): void {
	const ids = map.get(key);
	if (ids) ids.push(id);
	else map.set(key, [id]);
}

export function buildLinkIndex(trees: DocumentTree[]): LinkIndex {
	const byTitle: Map<string, string[]> = new Map();
	const byBlockId: Map<string, string[]> = new Map();
	const ordered: { id: string; titleNorm: string }[] = [];
	for (const tree of trees) {
		for (const section of tree.sections) {
			addTo(byTitle, norm(section.title), section.id);
			ordered.push({ id: section.id, titleNorm: norm(section.title) });
			for (const m of section.body.matchAll(/^>?[ \t]*\^([\w-]+)[ \t]*$/gm)) {
				addTo(byBlockId, m[1].toLowerCase(), section.id);
			}
			// Obsidian also allows a block id *trailing* its block's last line
			// ("…a reactive Underworld. ^create-meatgrinder" — HMtW's only form).
			// `[^\s>]` keeps this from re-matching standalone/quoted-only lines
			// the pass above already handled.
			for (const m of section.body.matchAll(/[^\s>][ \t]+\^([\w-]+)[ \t]*$/gm)) {
				addTo(byBlockId, m[1].toLowerCase(), section.id);
			}
		}
	}
	// Obsidian nested anchors (`[[Note#Parent#Child]]`) scope each part to
	// after the previous one in document order — needed when the child's title
	// is duplicated (HMtW's "1. Draw Challenge cards" appears three times in
	// chapter 7). They can't be resolved from a flat title map, so precompute
	// them here: scan the bodies for the nested links that actually exist and
	// index each full fragment as a composite title key. Corpora without
	// nested links (stonetop) add no keys, keeping their artifact unchanged.
	for (const tree of trees) {
		for (const section of tree.sections) {
			for (const m of section.body.matchAll(WIKILINK)) {
				const target = m[1].trim();
				const hash = target.indexOf('#');
				if (hash < 0) continue;
				const frag = target.slice(hash + 1);
				if (!frag.includes('#') || frag.startsWith('^')) continue;
				const key = norm(frag);
				if (byTitle.has(key)) continue;
				const id = resolveNestedAnchor(ordered, target.slice(0, hash), frag);
				if (id) byTitle.set(key, [id]);
			}
		}
	}
	return { byTitle, byBlockId };
}

/** Document-order scoped resolution of a nested fragment ("Parent#Child"):
 * each part matches the first section titled that way after the previous
 * part's position, restricted to the linked note's own sections when the
 * link names one. Returns the last part's section id, or null. */
function resolveNestedAnchor(
	ordered: { id: string; titleNorm: string }[],
	note: string,
	frag: string
): string | null {
	const prefix = slug(note);
	const scoped = prefix
		? ordered.filter((s) => s.id === prefix || s.id.startsWith(`${prefix}--`))
		: ordered;
	let pos = -1;
	for (const part of frag.split('#').map(norm)) {
		pos = scoped.findIndex((s, i) => i > pos && s.titleNorm === part);
		if (pos < 0) return null;
	}
	return scoped[pos].id;
}

export function serializeLinkIndex(index: LinkIndex): SerializedLinkIndex {
	return {
		byTitle: Object.fromEntries(index.byTitle),
		byBlockId: Object.fromEntries(index.byBlockId)
	};
}

export function deserializeLinkIndex(data: SerializedLinkIndex): LinkIndex {
	return {
		byTitle: new Map(Object.entries(data.byTitle)),
		byBlockId: new Map(Object.entries(data.byBlockId))
	};
}

/** Every section id in an index — a chapter's opening section id is exactly
 * the slug of its source note's stem, which is what a note-only wikilink
 * (`[[15 - Appendix E - …|label]]`) names. Derived lazily and cached per
 * index object, so the serialized artifact doesn't change shape. */
const sectionIdsCache = new WeakMap<LinkIndex, Set<string>>();
function sectionIds(index: LinkIndex): Set<string> {
	let ids = sectionIdsCache.get(index);
	if (!ids) {
		ids = new Set<string>();
		for (const list of index.byTitle.values()) {
			for (const id of list) if (typeof id === 'string') ids.add(id);
		}
		sectionIdsCache.set(index, ids);
	}
	return ids;
}

/**
 * The section id a wikilink target names, or `null`. `[[Note#Heading|Label]]`
 * matches by heading title (preferring a section whose id came from the linked
 * note); `[[Note#^blockId|Label]]` by the note's own named block id. A bare
 * `[[Note|Label]]` link falls back to the note's own opening section (whose id
 * is the slug of the note's stem) when no section title matches the note name.
 * The result can also be an external `{ url }` target (phase 22).
 */
export function resolveTarget(index: LinkIndex, target: string): LinkTarget | null {
	const hash = target.indexOf('#');
	const note = hash >= 0 ? target.slice(0, hash) : target;
	const heading = hash >= 0 ? target.slice(hash + 1) : '';
	const ids = heading.startsWith('^')
		? index.byBlockId.get(heading.slice(1).toLowerCase())
		: index.byTitle.get(norm(heading || note));
	if (!ids || ids.length === 0) {
		if (!heading && note) {
			const chapterId = slug(note);
			if (sectionIds(index).has(chapterId)) return chapterId;
		}
		return null;
	}
	if (note && heading) {
		const prefix = slug(note);
		const preferred = ids.find(
			(id) => typeof id === 'string' && (id === prefix || id.startsWith(`${prefix}--`))
		);
		if (preferred) return preferred;
	}
	return ids[0];
}

/**
 * Rewrite a pack string's wikilinks as markdown links, and drop image embeds.
 * Resolved links become `[label](hrefFor(sectionId))`; unresolved ones (or all
 * of them, when the caller has no index yet — `index: null` is fine, so a
 * surface can render text before its link fetch lands) fall back to the bare
 * label. The rest of the string passes through for the caller's own markdown
 * rendering.
 */
export function resolveWikilinks(
	text: string,
	index: LinkIndex | null,
	hrefFor: (sectionId: string) => string
): string {
	return text.replace(IMAGE_EMBED, '').replace(WIKILINK, (_m, rawTarget, rawLabel) => {
		const target = String(rawTarget).trim();
		const label = String(rawLabel ?? target.split('#').pop() ?? target).trim();
		const resolved = index ? resolveTarget(index, target) : null;
		if (resolved === null) return label;
		const href = typeof resolved === 'string' ? hrefFor(resolved) : resolved.url;
		return `[${label}](${href})`;
	});
}
