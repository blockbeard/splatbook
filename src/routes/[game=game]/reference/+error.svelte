<!--
	The reference's own error page.

	Without one, a bad section id fell through to SvelteKit's default: "404 —
	No such rules section" as bare text on an otherwise empty page, with no
	contents, no search box and no link back into the book. On a product whose
	pitch is "searchable, deep-linkable", the failure mode of a shared link was
	the one page offering no way to recover — and because every heading is its
	own page here, a stale anchor from a renamed heading is routine rather than
	an edge case.

	Living inside `reference/` means the layout still renders around it, so the
	contents tree and the search box are already on screen; this only has to
	say what happened and point at them. The layout's own load has succeeded by
	definition — the error came from the page below it.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const gameId = $derived(page.params.game as string);
	const isMissingSection = $derived(page.status === 404);
</script>

<svelte:head>
	<title
		>{isMissingSection ? 'Section not found' : 'Something went wrong'} — {page.data.gameName}</title
	>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="reference-body max-w-prose">
	{#if isMissingSection}
		<h1 class="text-2xl font-bold tracking-tight">That section isn’t here</h1>
		<p class="mt-3">
			It may have been renamed, or the link may be from an older version of the rules. Every heading
			has its own page, so titles do move between editions.
		</p>
		<p class="mt-3">
			Search the rules for what you were after, or pick a chapter from the contents — both are
			already on this page.
		</p>
	{:else}
		<h1 class="text-2xl font-bold tracking-tight">The rules didn’t load</h1>
		<p class="mt-3">
			{page.error?.message ?? 'Something went wrong on our end.'}
		</p>
		<p class="mt-3">Reloading usually clears it. The contents and search are still here.</p>
	{/if}
</div>

<!-- Outside `.reference-body` on purpose: this is app chrome, not book prose,
     and a game's link styling is scoped to that class. HMtW sets
     `.reference-body a { color: var(--sb-text) }`, which beats the utility's
     `text-accent-contrast` on specificity and painted this button's label
     black on a black ground. Same reasoning keeps "In this section" out of the
     article on the section route. -->
<p class="mt-6">
	<a
		href={resolve('/[game=game]/reference', { game: gameId })}
		class="inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90"
	>
		Back to the contents
	</a>
</p>
