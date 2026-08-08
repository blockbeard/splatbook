<!--
	The search route. Everything about searching lives in ReferenceSearch (phase
	25) so the mobile bar's panel runs the same code; this page is the heading,
	the initial query from `?q=`, and the shareable-URL variant.
-->
<script lang="ts">
	import { page } from '$app/state';
	import ReferenceSearch from '../ReferenceSearch.svelte';

	let { data } = $props();

	let query = $state(page.url.searchParams.get('q') ?? '');
</script>

<svelte:head>
	<title>Search — {data.gameName} rules</title>
</svelte:head>

<h1 class="text-2xl font-bold tracking-tight">Search the rules</h1>

<ReferenceSearch
	bind:query
	gameId={data.gameId}
	gameName={data.gameName}
	showSetting={data.showSetting}
	badge={data.spoilers?.badge ?? 'GM'}
	variant="page"
/>
