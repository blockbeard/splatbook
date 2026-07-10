/**
 * The document-tree format — how any game's rules/SRD text arrives in a
 * content pack so the shell can browse and search it.
 *
 * Generic on purpose: a pack ships one JSON document tree per book/section of
 * its rules (e.g. Stonetop's Book I and Book II), the game module points its
 * `schemaFor` resolver at `documentTreeSchema` for those files, and the
 * reference subsystem renders and indexes them without knowing anything about
 * the game. See `docs/content-packs.md`.
 *
 * Shape: a flat, document-ordered list of sections. Hierarchy is carried by
 * `level` (heading depth) plus `path` (ancestor titles), so the tree can be
 * rebuilt for a TOC (see `buildSectionTree`) while search stays trivially
 * linear. Each section's `id` is its stable deep-link target.
 */

import { z } from 'zod';

/** Who may see a section. The GM gate (phase 9) turns `gm` into a real permission. */
export const VISIBILITY = ['player', 'gm'] as const;
export type Visibility = (typeof VISIBILITY)[number];

/** One section: a heading and the prose directly under it (excluding descendants). */
export const documentSectionSchema = z.strictObject({
	/** Stable id, unique within the tree — the deep-link target (`…/reference/<id>`). */
	id: z.string().min(1),
	/** Heading text. */
	title: z.string().min(1),
	/** Heading depth, 1–6. Drives TOC nesting. */
	level: z.number().int().min(1).max(6),
	/** Titles of ancestor sections, root→parent. Breadcrumb = `[...path, title]`. */
	path: z.array(z.string()),
	/** This section's own body markdown — the text before the next heading. */
	body: z.string(),
	/** Print-page anchors this section covers, if known. */
	pages: z.array(z.number().int().positive()).optional(),
	/** Visibility; defaults to player-visible. */
	visibility: z.enum(VISIBILITY).default('player')
});

/** A whole document tree — one book or SRD section of a game's rules. */
export const documentTreeSchema = z
	.strictObject({
		/** Document id, unique within the pack (e.g. "book-i"). */
		id: z.string().min(1),
		/** Display title (e.g. "Book I: Stonetop"). */
		title: z.string().min(1),
		/** Sections in document order. */
		sections: z.array(documentSectionSchema)
	})
	.superRefine((tree, ctx) => {
		const seen = new Set<string>();
		tree.sections.forEach((section, i) => {
			if (seen.has(section.id)) {
				ctx.addIssue({
					code: 'custom',
					message: `duplicate section id "${section.id}" — ids must be unique within a tree`,
					path: ['sections', i, 'id']
				});
			}
			seen.add(section.id);
		});
	});

export type DocumentSection = z.infer<typeof documentSectionSchema>;
export type DocumentTree = z.infer<typeof documentTreeSchema>;

/** A section plus its descendants, for rendering a TOC. */
export interface SectionNode {
	section: DocumentSection;
	children: SectionNode[];
}

/**
 * Rebuild the nesting from a flat, document-ordered section list using `level`.
 * A section is a child of the most recent preceding section with a lower level;
 * sections with no such ancestor become roots. Robust to skipped heading levels.
 */
export function buildSectionTree(sections: readonly DocumentSection[]): SectionNode[] {
	const roots: SectionNode[] = [];
	const stack: SectionNode[] = [];
	for (const section of sections) {
		const node: SectionNode = { section, children: [] };
		while (stack.length && stack[stack.length - 1].section.level >= section.level) {
			stack.pop();
		}
		if (stack.length) stack[stack.length - 1].children.push(node);
		else roots.push(node);
		stack.push(node);
	}
	return roots;
}

/** Look a section up by id. */
export function findSection(tree: DocumentTree, id: string): DocumentSection | undefined {
	return tree.sections.find((s) => s.id === id);
}
