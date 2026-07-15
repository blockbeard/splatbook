<!--
	Arcana authoring — the generic shell around the game's own tool. It
	supplies the table and the write-through; the game's `arcanaGmComponent`
	decides what a card looks like. The shell never looks inside an entity.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';

	let { data } = $props();

	const ArcanaGm = $derived(getGame(data.campaign.gameId)?.arcanaGmComponent ?? null);
	const backHref = $derived(resolve('/campaigns/[id]', { id: data.campaign.id }));

	/** Persist an entity the game changed. The server re-checks that this is the
	 * GM's own table before it writes anything. */
	async function save(id: string, entity: object): Promise<void> {
		const body = new FormData();
		body.set('entityId', id);
		body.set('data', JSON.stringify(entity));

		const res = await fetch(`?/save`, { method: 'POST', body });
		if (!res.ok) throw new Error('Save failed');
	}
</script>

<svelte:head>
	<title>Arcana — {data.campaign.name}</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
	<a
		href={backHref}
		class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
	>
		← {data.campaign.name}
	</a>
</div>

{#if !ArcanaGm}
	<p class="text-muted">{data.campaign.gameName} has no Arcana-authoring tool.</p>
{:else if data.characters.length === 0}
	<p class="text-muted">
		No characters at this table yet — attach one on the
		<a href={backHref} class="text-accent hover:underline">campaign page</a> first.
	</p>
{:else}
	<ArcanaGm characters={data.characters} {save} />
{/if}
