<!--
	One GM guide section. The guide component is game code (not serialisable), so
	it's pulled from the registry here rather than through the load boundary; the
	layout supplied the reference `data` and this page the validated `sectionId`.
-->
<script lang="ts">
	import { getGame } from '$lib/games';

	let { data } = $props();

	const Guide = $derived(getGame(data.gameId)!.gmGuide!.component);
</script>

<svelte:head>
	<title>{data.sectionTitle} — {data.gameName} GM guide</title>
</svelte:head>

<article>
	<h1 class="text-2xl font-bold tracking-tight">{data.sectionTitle}</h1>
	<div class="mt-4">
		<Guide data={data.data} section={data.sectionId} />
	</div>
</article>
