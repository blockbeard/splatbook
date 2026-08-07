<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { invalidate } from '$app/navigation';
	import { embed } from '$lib/embed.svelte';
	import { getLocalPreference, readShowSetting } from '$lib/preferences';
	import type { TocDocument, TocSection } from '$lib/reference/load';
	import SpoilerToggle from './SpoilerToggle.svelte';

	let { data, children } = $props();

	// A signed-out visitor returning with a previously-set localStorage
	// preference: SSR couldn't read it (no localStorage on the server), so
	// the first paint defaulted closed. Reconcile once on mount — this only
	// does anything when the two actually disagree, so a first-time visitor
	// with nothing stored triggers no extra work.
	onMount(() => {
		if (page.data.session?.user?.id) return;
		const stored =
			readShowSetting(data.gameId, (k) => getLocalPreference(localStorage, k)) === 'true';
		if (stored !== data.showSetting) invalidate('reference:showSetting');
	});

	const activeId = $derived(page.params.section);

	/**
	 * The chapter owning the active section, across every doc — the one
	 * disclosure that should render open. Reads straight off the section's own
	 * `chapter` id (commit 90); no ancestor-walking needed.
	 */
	const activeChapterId = $derived.by(() => {
		for (const doc of data.toc) {
			const section = doc.sections.find((s) => s.id === activeId);
			if (section) return section.chapter;
		}
		return undefined;
	});

	/**
	 * A chapter's h2 sections with their h3s nested underneath. The sidebar
	 * is capped at h3 — deeper headings (h4+) are reachable from the section
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
		resolve('/[game=game]/reference/[section]', { game: data.gameId, section: id });
</script>

<div class="flex flex-col gap-8 md:flex-row md:gap-10">
	<nav
		class="reference-toc shrink-0 md:w-72 md:border-r md:border-border md:pr-6"
		aria-label="Rules contents"
	>
		<a
			href={resolve('/[game=game]/reference', { game: data.gameId })}
			class="block text-sm font-semibold tracking-tight hover:text-accent"
		>
			{data.gameName} rules
		</a>
		<!-- Below md the whole TOC stacks above the content, so the search box
		     sticks to the top of the screen while the reader scrolls; on md+
		     it lives in the sidebar and behaves normally. -->
		<form
			action={resolve('/[game=game]/reference/search', { game: data.gameId })}
			class="sticky top-0 z-10 -mx-1 mt-3 bg-bg px-1 py-2 md:static md:m-0 md:mt-3 md:p-0"
			role="search"
		>
			<input
				name="q"
				type="search"
				placeholder="Search rules…"
				aria-label="Search the rules"
				class="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
			/>
			{#if embed.active}
				<!-- SvelteKit intercepts this GET form but replaces the whole query
				     string with the form fields — without this, a search submit in
				     embed mode drops ?embed=1 and a mid-session reload resurrects
				     the app chrome. -->
				<input type="hidden" name="embed" value="1" />
			{/if}
		</form>
		{#if data.spoilers}
			<!-- The opt-in lives here in the sidebar — every reference page, not
			     just search results — so the TOC itself offers the path to Book II. -->
			<div class="mt-2">
				<SpoilerToggle checked={data.showSetting} label={data.spoilers.toggleLabel} />
			</div>
		{/if}
		{#each data.toc as doc (doc.id)}
			<div class="mt-4">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted">{doc.title}</p>
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
								>
									{chapter.title}
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
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
