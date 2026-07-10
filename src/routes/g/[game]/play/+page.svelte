<!--
	Play-mode route — generic shell. Loads a saved entity (by `?id=`) or the local
	autosave draft, renders the game's play component, and autosaves whatever the
	game hands back: to the database when playing a saved entity, else to the same
	localStorage slot the sheet reads. The shell never inspects the entity shape.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { draftKey, loadDraft, saveDraft } from '$lib/wizard';
	import { draftToPayload, saveEntity } from '$lib/entities/client';

	let { data } = $props();

	const game = $derived(getGame(data.gameId)!);
	const Play = $derived(game.playComponent!);
	const savedId = $derived(data.saved?.id ?? null);
	const localKey = $derived(draftKey(data.gameId, 'character', 'current'));

	// Seed editable state once from the loaded entity or local draft. `untrack`
	// marks this as a deliberate initial-value read (the page reloads on a new id).
	let character = $state<object | null>(
		untrack(
			() =>
				data.saved?.data ??
				(browser
					? loadDraft<object>(localStorage, draftKey(data.gameId, 'character', 'current'))
					: null)
		)
	);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** Persist the current character — debounced, to the DB or localStorage. */
	function persist(next: object): void {
		if (savedId) {
			saveState = 'saving';
			const payload = draftToPayload(data.gameId, next, { id: savedId });
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

	/** The game handed us a new character: show it, then debounce a save. */
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
	<title>Play — {data.gameName}</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
	<a
		href={savedId
			? `${resolve('/g/[game]/sheet', { game: data.gameId })}?id=${savedId}`
			: resolve('/g/[game]/sheet', { game: data.gameId })}
		class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
	>
		← Character sheet
	</a>
	<span class="text-sm text-muted" aria-live="polite">{savedLabel}</span>
</div>

{#if !character}
	<p class="text-muted">
		No character to play. <a
			href={resolve('/g/[game]/build', { game: data.gameId })}
			class="text-accent hover:underline">Build one first.</a
		>
	</p>
{:else}
	<Play {character} {onChange} />
{/if}
