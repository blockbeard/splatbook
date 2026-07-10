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
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { draftKey, loadDraft, saveDraft } from '$lib/wizard';
	import { draftToPayload, saveEntity } from '$lib/entities/client';

	let { data } = $props();

	const type = $derived(getGame(data.gameId)!.entityTypes[data.entityType]);
	const Play = $derived(type.playComponent!);
	// The entity's DB id, once it has one. Starts from `?id=`; an editor-first
	// type (steading) that's created here adopts the id the first save returns.
	// Deliberate one-time capture — the page reloads when the id changes.
	// svelte-ignore state_referenced_locally
	let liveId = $state<string | null>(data.saved?.id ?? null);
	const signedIn = $derived(!!page.data.session?.user);
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

	/**
	 * Persist the current entity — debounced. To the DB when it has an id; for a
	 * signed-in editor-first type with no id yet, create it in the DB and adopt
	 * the returned id (so it lands in the dashboard like a character). Otherwise
	 * fall back to the local autosave slot.
	 */
	function persist(next: object): void {
		if (liveId) {
			saveState = 'saving';
			const payload = draftToPayload(data.gameId, data.entityType, next, { id: liveId });
			if (!payload) {
				saveState = 'error';
				return;
			}
			saveEntity(payload)
				.then(() => (saveState = 'saved'))
				.catch(() => (saveState = 'error'));
		} else if (signedIn && data.editorFirst) {
			saveState = 'saving';
			const payload = draftToPayload(data.gameId, data.entityType, next, { status: 'ready' });
			if (!payload) {
				saveState = 'error';
				return;
			}
			saveEntity(payload)
				.then((saved) => {
					liveId = saved.id;
					saveState = 'saved';
					// Adopt the id in the URL so a reload loads it from the DB.
					if (browser) replaceState(`${page.url.pathname}?id=${saved.id}`, {});
				})
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
			href={liveId ? `${sheetPath}?id=${liveId}` : sheetPath}
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
