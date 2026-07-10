/**
 * Render a section's body markdown to HTML, resolving Obsidian-style wikilinks
 * to in-app reference deep-links where their target can be identified.
 *
 * A wikilink `[[Note#Heading|Label]]` is matched to a section by heading title
 * (preferring one whose id came from the linked note); resolved links become
 * `…/reference/<id>`, unresolved ones fall back to their label as plain text so
 * the prose never shows raw `[[…]]` syntax. Pack content is first-party, so the
 * marked output is trusted (rendered with `{@html}`).
 */

import { marked } from 'marked';
import { base } from '$app/paths';
import type { DocumentTree } from './document-tree';

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const IMAGE_EMBED = /!\[\[[^\]]*\]\]/g;

const norm = (s: string): string => s.replace(/[*_`]/g, '').trim().toLowerCase();
const slug = (s: string): string =>
	norm(s)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/** Title → section ids, for resolving wikilink targets. */
export type LinkIndex = Map<string, string[]>;

export function buildLinkIndex(trees: DocumentTree[]): LinkIndex {
	const byTitle: LinkIndex = new Map();
	for (const tree of trees) {
		for (const section of tree.sections) {
			const key = norm(section.title);
			const ids = byTitle.get(key);
			if (ids) ids.push(section.id);
			else byTitle.set(key, [section.id]);
		}
	}
	return byTitle;
}

function resolveTarget(index: LinkIndex, target: string): string | null {
	const hash = target.indexOf('#');
	const note = hash >= 0 ? target.slice(0, hash) : target;
	const heading = hash >= 0 ? target.slice(hash + 1) : '';
	// Prefer the heading; a note-only link points at that note's opening section.
	const ids = index.get(norm(heading || note));
	if (!ids || ids.length === 0) return null;
	if (note && heading) {
		const prefix = slug(note);
		const preferred = ids.find((id) => id === prefix || id.startsWith(`${prefix}--`));
		if (preferred) return preferred;
	}
	return ids[0];
}

/** Convert body markdown (with wikilinks) to trusted HTML for a game's reference. */
export function renderMarkdown(body: string, gameId: string, index: LinkIndex): string {
	const withLinks = body.replace(IMAGE_EMBED, '').replace(WIKILINK, (_m, rawTarget, rawLabel) => {
		const target = String(rawTarget).trim();
		const label = String(rawLabel ?? target.split('#').pop() ?? target).trim();
		const id = resolveTarget(index, target);
		return id ? `[${label}](${base}/g/${gameId}/reference/${id})` : label;
	});
	return marked.parse(withLinks, { async: false });
}
