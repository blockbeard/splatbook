<!--
	Every Origins wizard step needs the pack, and every one of them would
	otherwise repeat the same load/error/spinner dance. This wraps it: it loads
	the pack once (the loader memoises, so later steps are instant) and renders
	its children with the result.

	Shell chrome, not game content — the words here are the app apologising for
	a failed fetch, which is the app's business, not the game's.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { loadPack, type OriginsPack } from '../pack/load';

	let { children }: { children: Snippet<[OriginsPack]> } = $props();

	let pack = $state<OriginsPack | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		loadPack(fetch)
			.then((p) => alive && (pack = p))
			.catch((e: unknown) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => {
			alive = false;
		};
	});
</script>

{#if loadError}
	<p class="mt-6 text-muted">Couldn’t load the rules data: {loadError}</p>
{:else if !pack}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	{@render children(pack)}
{/if}
