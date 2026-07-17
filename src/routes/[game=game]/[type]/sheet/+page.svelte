<!--
	Entity sheet view — generic shell. Loads the autosaved draft from the same
	localStorage slot the builder/editor writes, and renders the entity type's
	sheet component from the registry. A toolbar (hidden when printing) offers
	print and a link back to the builder (create-flow types) or editor. Print CSS
	drops the site chrome so the sheet prints clean.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { draftKey, loadDraft } from '$lib/wizard';
	import { printSheet } from '$lib/print';

	let { data } = $props();

	const Sheet = $derived(getGame(data.gameId)!.entityTypes[data.entityType].sheetComponent!);
	// A generated document, not a print dialog (commit 120) — only for a saved
	// entity (the endpoint loads by id) and only when the game builds one.
	const hasPdf = $derived(!!getGame(data.gameId)!.entityTypes[data.entityType].pdf);
	const pdfPath = $derived(
		resolve('/[game=game]/[type]/pdf', { game: data.gameId, type: data.entityType })
	);
	// Preserve the saved-entity id (if any) when jumping to the editor, so edits
	// autosave to the same entity instead of the local draft slot.
	const savedId = $derived(page.url.searchParams.get('id'));
	const playPath = $derived(
		resolve('/[game=game]/[type]/play', { game: data.gameId, type: data.entityType })
	);
	const buildPath = $derived(
		resolve('/[game=game]/[type]/build', { game: data.gameId, type: data.entityType })
	);
	const playHref = $derived(savedId ? `${playPath}?id=${savedId}` : playPath);
	// The editor is where you go "back" for editor-first types; the builder for
	// create-flow types.
	const editLabel = $derived(data.hasWizard ? 'Play mode' : `Edit ${data.typeLabel.toLowerCase()}`);
	// A saved entity (loaded by `?id=`) wins; otherwise read the local autosave.
	const character = $derived(
		data.saved?.data ??
			(browser
				? loadDraft<object>(localStorage, draftKey(data.gameId, data.entityType, 'current'))
				: null)
	);

	// Arriving with `?print=1` means "the play view sent me here to make a PDF":
	// print once the sheet is actually on the page. Guarded so it fires once.
	let printed = $state(false);
	$effect(() => {
		if (printed || !browser || !character) return;
		if (page.url.searchParams.get('print') !== '1') return;
		printed = true;
		// A frame's grace so the sheet (and its fonts) are laid out before the
		// print dialog snapshots the page.
		requestAnimationFrame(() => setTimeout(() => printSheet(), 150));
	});
</script>

<svelte:head>
	<title>{data.typeLabel} sheet — {data.gameName}</title>
</svelte:head>

<div class="sheet-toolbar mb-6 flex items-center justify-between">
	{#if data.hasWizard}
		<a
			href={buildPath}
			class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
		>
			← Back to builder
		</a>
	{:else if data.hasPlay}
		<a
			href={playHref}
			class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
		>
			← {editLabel}
		</a>
	{:else}
		<span></span>
	{/if}
	<div class="flex items-center gap-2">
		{#if data.hasWizard && data.hasPlay}
			<a
				href={playHref}
				class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
			>
				{editLabel}
			</a>
		{/if}
		{#if hasPdf && savedId}
			<a
				href="{pdfPath}?id={savedId}"
				class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
			>
				Download PDF
			</a>
			<!-- The same document folded (commit 121): duplex, flip on short edge,
			     fold, staple — the physical-playbook shape. -->
			<a
				href="{pdfPath}?id={savedId}&booklet=1"
				class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
			>
				Booklet
			</a>
		{/if}
		<button
			type="button"
			onclick={() => printSheet()}
			class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
		>
			Print / Save as PDF
		</button>
	</div>
</div>

{#if !character}
	<p class="text-muted">
		No {data.typeLabel.toLowerCase()} in progress.
		{#if data.hasWizard}
			<a href={buildPath} class="text-accent hover:underline">Start building one.</a>
		{:else if data.hasPlay}
			<a href={playPath} class="text-accent hover:underline">Start one.</a>
		{/if}
	</p>
{:else}
	<Sheet {character} />
{/if}
