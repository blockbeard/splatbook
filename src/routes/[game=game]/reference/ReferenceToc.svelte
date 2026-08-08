<!--
	The rules contents tree, rendered in two places: the static sidebar on md+
	and the mobile drawer below it (phase 25). One implementation so the two can
	never drift — the disclosure state, the h3 cap, and the active-entry marking
	are decisions that belong to the tree, not to either host.

	`aria-current="page"` marks the active entry for assistive tech, and the
	drawer uses the same attribute to scroll the reader's position into view on
	open.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { TocDocument, TocSection } from '$lib/reference/load';

	let {
		toc,
		gameId,
		activeId
	}: { toc: TocDocument[]; gameId: string; activeId: string | undefined } = $props();

	/**
	 * The chapter owning the active section, across every doc — the one
	 * disclosure that should render open. Reads straight off the section's own
	 * `chapter` id (commit 90); no ancestor-walking needed.
	 */
	const activeChapterId = $derived.by(() => {
		for (const doc of toc) {
			const section = doc.sections.find((s) => s.id === activeId);
			if (section) return section.chapter;
		}
		return undefined;
	});

	/**
	 * A chapter's h2 sections with their h3s nested underneath. The tree is
	 * capped at h3 — deeper headings (h4+) are reachable from the section
	 * page's own "In this section" tree and in-page links, not listed here.
	 * A nav that lists every h5 is a list, not a map; but a flat h2 list hid
	 * the book's parts entirely (phase-22 staging finding).
	 */
	function h2sOf(
		doc: TocDocument,
		chapterId: string
	): { section: TocSection; subs: TocSection[] }[] {
		const out: { section: TocSection; subs: TocSection[] }[] = [];
		for (const s of doc.sections) {
			if (s.chapter !== chapterId) continue;
			if (s.level === 2) out.push({ section: s, subs: [] });
			else if (s.level === 3 && out.length) out[out.length - 1].subs.push(s);
		}
		return out;
	}

	const href = (id: string) =>
		resolve('/[game=game]/reference/[section]', { game: gameId, section: id });
</script>

<div class="reference-toc">
	{#each toc as doc (doc.id)}
		<div class="mt-4">
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">{doc.title}</p>
			<ul class="mt-1 text-sm">
				{#each doc.chapters as chapter (chapter.id)}
					{@const h2s = h2sOf(doc, chapter.id)}
					{@const active = chapter.id === activeId}
					<li>
						{#if h2s.length}
							<details open={chapter.id === activeChapterId}>
								<summary class="cursor-pointer list-none">
									<a
										href={href(chapter.id)}
										class="hover:text-accent"
										class:text-accent={active}
										class:font-medium={active}
										aria-current={active ? 'page' : undefined}
									>
										{chapter.title}
									</a>
								</summary>
								<ul class="border-l border-border pl-3">
									{#each h2s as entry (entry.section.id)}
										{@const sectionActive = entry.section.id === activeId}
										<li>
											<a
												href={href(entry.section.id)}
												class="block py-0.5 hover:text-accent"
												class:text-accent={sectionActive}
												class:font-medium={sectionActive}
												aria-current={sectionActive ? 'page' : undefined}
											>
												{entry.section.title}
											</a>
											{#if entry.subs.length}
												<ul class="border-l border-border pl-3 text-[0.92em]">
													{#each entry.subs as sub (sub.id)}
														{@const subActive = sub.id === activeId}
														<li>
															<a
																href={href(sub.id)}
																class="block py-0.5 text-muted hover:text-accent"
																class:text-accent={subActive}
																class:font-medium={subActive}
																aria-current={subActive ? 'page' : undefined}
															>
																{sub.title}
															</a>
														</li>
													{/each}
												</ul>
											{/if}
										</li>
									{/each}
								</ul>
							</details>
						{:else}
							<a
								href={href(chapter.id)}
								class="block py-0.5 hover:text-accent"
								class:text-accent={active}
								class:font-medium={active}
								aria-current={active ? 'page' : undefined}
							>
								{chapter.title}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>

<style>
	.reference-toc :global(summary::-webkit-details-marker) {
		display: none;
	}
	.reference-toc :global(summary) {
		position: relative;
		padding-left: 0.85rem;
	}
	.reference-toc :global(summary::before) {
		content: '▸';
		position: absolute;
		left: 0;
		color: var(--sb-muted, currentColor);
		transition: transform 0.12s ease;
	}
	.reference-toc :global(details[open] > summary::before) {
		transform: rotate(90deg);
	}
</style>
