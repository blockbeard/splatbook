<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.gameName}</title>
</svelte:head>

<section class="mx-auto max-w-2xl py-12 text-center">
	<h1 class="text-4xl font-bold tracking-tight">{data.gameName}</h1>
	<p class="mt-4 text-lg text-muted">
		The home of {data.gameName} — reference, character builder, and campaign tools land here as their
		phases arrive.
	</p>
</section>
