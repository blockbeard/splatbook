<!--
	Play/editor route — generic shell. Loads a saved entity (by `?id=`) or the
	local autosave draft, renders the entity type's play component, and autosaves
	whatever the game hands back: to the database when playing a saved entity,
	else to the same localStorage slot the sheet reads. Editor-first types
	(steadings) seed a fresh draft when there's nothing to load. The shell never
	inspects the entity shape.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { draftKey, loadDraft, saveDraft } from '$lib/wizard';
	import { draftToPayload, saveEntity } from '$lib/entities/client';

	let { data } = $props();

	const type = $derived(getGame(data.gameId)!.entityTypes[data.entityType]);
	const Play = $derived(type.playComponent!);
	const savedId = $derived(data.saved?.id ?? null);
	const localKey = $derived(draftKey(data.gameId, data.entityType, 'current'));
	const sheetPath = $derived(
		resolve('/g/[game]/[type]/sheet', { game: data.gameId, type: data.entityType })
	);
	const buildPath = $derived(
		resolve('/g/[game]/[type]/build', { game: data.gameId, type: data.entityType })
	);

	// Seed editable state once from the loaded entity, local draft, or — for
	// editor-first types — a fresh blank draft. `untrack` marks this as a
	// deliberate initial-value read (the page reloads on a new id).
	let character = $state<object | null>(
		untrack(() => {
			if (data.saved?.data) return data.saved.data;
			const local = browser
				? loadDraft<object>(localStorage, draftKey(data.gameId, data.entityType, 'current'))
				: null;
			if (local) return local;
			return data.editorFirst && type.newDraft ? type.newDraft() : null;
		})
	);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** Persist the current entity — debounced, to the DB or localStorage. */
	function persist(next: object): void {
		if (savedId) {
			saveState = 'saving';
			const payload = draftToPayload(data.gameId, data.entityType, next, { id: savedId });
			if (!payload) {
				saveState = 'error';
				return;
			}
			saveEntity(payload)
				.then(() => (saveState = 'saved'))
				.catch(() => (saveState = 'error'));
		} else if (browser) {
			saveDraft(localStorage, localKey, next);
			saveState = 'saved';
		}
	}

	/** The game handed us a new version: show it, then debounce a save. */
	function onChange(next: object): void {
		character = next;
		saveState = 'saving';
		clearTimeout(timer);
		timer = setTimeout(() => persist(next), 600);
	}

	const savedLabel = $derived(
		{ idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[saveState]
	);
</script>

<svelte:head>
	<title>{data.typeLabel} — {data.gameName}</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
	{#if data.hasSheet}
		<a
			href={savedId ? `${sheetPath}?id=${savedId}` : sheetPath}
			class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
		>
			← {data.typeLabel} sheet
		</a>
	{:else}
		<a
			href={resolve('/g/[game]', { game: data.gameId })}
			class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
		>
			← {data.gameName}
		</a>
	{/if}
	<span class="text-sm text-muted" aria-live="polite">{savedLabel}</span>
</div>

{#if !character}
	<p class="text-muted">
		No {data.typeLabel.toLowerCase()} to play.
		{#if type.wizardSteps?.length}
			<a href={buildPath} class="text-accent hover:underline">Build one first.</a>
		{/if}
	</p>
{:else}
	<Play {character} {onChange} />
{/if}
