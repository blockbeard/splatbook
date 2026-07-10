<!--
	A selectable card used throughout the Stonetop wizard (playbooks, backgrounds,
	instincts, origins, moves, possessions). Presentation only — the parent owns
	selection state and passes rendered content as children.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		selected = false,
		disabled = false,
		onclick,
		children
	}: {
		selected?: boolean;
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	{onclick}
	{disabled}
	aria-pressed={selected}
	class="flex h-full w-full flex-col rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 {selected
		? 'border-accent bg-accent/5 ring-1 ring-accent'
		: 'border-border hover:border-accent'}"
>
	{@render children()}
</button>
