/**
 * Curated pinned search terms (phase 22) — a hand-authored index of the
 * book's own vocabulary, resolved at build time and pinned above the fuzzy
 * search hits when the query matches.
 *
 * Source: `content/<game>/index-terms.json`, an array of
 * `{ term, targets: [...] }` where each target is either an internal
 * `{ file, anchor, label }` (resolved through the same link index wikilinks
 * use — `anchor` may be empty for the note itself, a heading, `^block-id`,
 * or a nested `Parent#Child`) or an external `{ url, label?, note? }`.
 *
 * `tools/build_search.ts` emits **two** derived artifacts, mirroring the
 * search-index split exactly: `pinned-terms.json` (player) and
 * `pinned-terms-gm.json` (GM targets only). The split happens at build time
 * because the term labels are themselves the spoiler — client-side filtering
 * would still ship them. A mixed term appears in both files (GM targets
 * stripped from the player copy); a term whose targets are all GM goes
 * GM-only. Resolution failures fail the build — a curated index with dead
 * anchors is worse than no index.
 */

import type { DocumentTree } from './document-tree';
import { buildLinkIndex, resolveTarget } from './inline';

/** One hand-authored target in `index-terms.json`. */
export type SourceTarget =
	{ file: string; anchor: string; label: string } | { url: string; label?: string; note?: string };

/** One hand-authored term entry in `index-terms.json`. */
export interface SourceTerm {
	term: string;
	targets: SourceTarget[];
}

/** A resolved target as the pinned artifacts carry it. */
export interface PinnedTarget {
	label: string;
	/** Internal section id — absent for an external target. */
	id?: string;
	/** External URL — absent for an internal target. */
	url?: string;
	/** Optional short explanation (external targets, e.g. why a link leaves the app). */
	note?: string;
	visibility: 'player' | 'gm';
}

/** One pinned term as the artifacts carry it. */
export interface PinnedTerm {
	term: string;
	targets: PinnedTarget[];
}

/**
 * Resolve a source index against a game's document trees and split it into
 * the player and GM artifacts. Throws (listing every failure) if any internal
 * target doesn't resolve.
 */
export function resolvePinnedTerms(
	source: SourceTerm[],
	trees: DocumentTree[]
): { player: PinnedTerm[]; gm: PinnedTerm[] } {
	const index = buildLinkIndex(trees);
	const visibility = new Map<string, 'player' | 'gm'>();
	for (const tree of trees) {
		for (const s of tree.sections) visibility.set(s.id, s.visibility);
	}

	const errors: string[] = [];
	const player: PinnedTerm[] = [];
	const gm: PinnedTerm[] = [];
	for (const entry of source) {
		const playerTargets: PinnedTarget[] = [];
		const gmTargets: PinnedTarget[] = [];
		for (const target of entry.targets) {
			if ('url' in target) {
				playerTargets.push({
					label: target.label ?? entry.term,
					url: target.url,
					...(target.note ? { note: target.note } : {}),
					visibility: 'player'
				});
				continue;
			}
			const wikiTarget = target.anchor ? `${target.file}#${target.anchor}` : target.file;
			const resolved = resolveTarget(index, wikiTarget);
			if (typeof resolved !== 'string') {
				errors.push(`"${entry.term}": unresolvable target [[${wikiTarget}]]`);
				continue;
			}
			const vis = visibility.get(resolved) ?? 'player';
			(vis === 'gm' ? gmTargets : playerTargets).push({
				label: target.label,
				id: resolved,
				visibility: vis
			});
		}
		if (playerTargets.length) player.push({ term: entry.term, targets: playerTargets });
		if (gmTargets.length) gm.push({ term: entry.term, targets: gmTargets });
	}
	if (errors.length) {
		throw new Error(
			`pinned terms: ${errors.length} unresolvable target(s)\n  ${errors.join('\n  ')}`
		);
	}
	return { player, gm };
}

/**
 * Merge the player artifact with the (opt-in) GM one for display: same-name
 * terms combine their target lists, GM-only terms append after, source order
 * otherwise preserved.
 */
export function mergePinnedTerms(
	player: PinnedTerm[] | null,
	gm: PinnedTerm[] | null
): PinnedTerm[] {
	if (!player) return gm ?? [];
	if (!gm) return player;
	const merged = player.map((t) => ({ ...t, targets: [...t.targets] }));
	const byTerm = new Map(merged.map((t) => [t.term, t]));
	for (const t of gm) {
		const existing = byTerm.get(t.term);
		if (existing) existing.targets.push(...t.targets);
		else merged.push(t);
	}
	return merged;
}

/**
 * The pinned terms a query surfaces: exact match first, then prefix, then
 * substring; alphabetical within a rank. Empty query pins nothing.
 */
export function matchPinnedTerms(terms: PinnedTerm[], query: string, limit = 5): PinnedTerm[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return terms
		.map((t) => {
			const lower = t.term.toLowerCase();
			const rank = lower === q ? 0 : lower.startsWith(q) ? 1 : lower.includes(q) ? 2 : -1;
			return { t, rank };
		})
		.filter((x) => x.rank >= 0)
		.sort((a, b) => a.rank - b.rank || a.t.term.localeCompare(b.t.term))
		.slice(0, limit)
		.map((x) => x.t);
}
