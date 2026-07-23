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

/** Section lookups for resolving wikilink targets: by heading title, and by
 * named block id (`^clash`) — the vault's newer, stable cross-reference form. */
export interface LinkIndex {
	byTitle: Map<string, string[]>;
	byBlockId: Map<string, string[]>;
}

/** The JSON shape `link-index.json` carries — `LinkIndex` with plain objects. */
export interface SerializedLinkIndex {
	byTitle: Record<string, string[]>;
	byBlockId: Record<string, string[]>;
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const IMAGE_EMBED = /!\[\[[^\]]*\]\]/g;

const norm = (s: string): string => s.replace(/[*_`]/g, '').trim().toLowerCase();
const slug = (s: string): string =>
	norm(s)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

function addTo(map: Map<string, string[]>, key: string, id: string): void {
	const ids = map.get(key);
	if (ids) ids.push(id);
	else map.set(key, [id]);
}

export function buildLinkIndex(trees: DocumentTree[]): LinkIndex {
	const byTitle: Map<string, string[]> = new Map();
	const byBlockId: Map<string, string[]> = new Map();
	for (const tree of trees) {
		for (const section of tree.sections) {
			addTo(byTitle, norm(section.title), section.id);
			for (const m of section.body.matchAll(/^>?[ \t]*\^([\w-]+)[ \t]*$/gm)) {
				addTo(byBlockId, m[1].toLowerCase(), section.id);
			}
		}
	}
	return { byTitle, byBlockId };
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

/**
 * The section id a wikilink target names, or `null`. `[[Note#Heading|Label]]`
 * matches by heading title (preferring a section whose id came from the linked
 * note); `[[Note#^blockId|Label]]` by the note's own named block id.
 */
export function resolveTarget(index: LinkIndex, target: string): string | null {
	const hash = target.indexOf('#');
	const note = hash >= 0 ? target.slice(0, hash) : target;
	const heading = hash >= 0 ? target.slice(hash + 1) : '';
	const ids = heading.startsWith('^')
		? index.byBlockId.get(heading.slice(1).toLowerCase())
		: index.byTitle.get(norm(heading || note));
	if (!ids || ids.length === 0) return null;
	if (note && heading) {
		const prefix = slug(note);
		const preferred = ids.find((id) => id === prefix || id.startsWith(`${prefix}--`));
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
		const id = index ? resolveTarget(index, target) : null;
		return id ? `[${label}](${hrefFor(id)})` : label;
	});
}
