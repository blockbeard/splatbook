<script lang="ts">
	import { APP_NAME } from '$lib';
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta
		name="description"
		content="A game-agnostic framework for TTRPG companion apps, driven by per-game content packs."
	/>
</svelte:head>

<section class="mx-auto max-w-2xl py-12 text-center">
	<h1 class="text-4xl font-bold tracking-tight">
		{APP_NAME}<span class="text-accent">*</span>
	</h1>
	<p class="mt-4 text-lg text-muted">
		A game-agnostic framework for TTRPG companion apps — character builders, campaign trackers,
		and searchable rules, driven by per-game content packs.
	</p>
	<p class="mt-6 rounded border border-border bg-surface px-4 py-3 text-sm text-muted">
		Under construction. The first game module — <strong class="text-text">Ringwall</strong>, a
		companion for Stonetop — is on its way.
	</p>
</section>
