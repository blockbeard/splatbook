<!--
	A selectable card: the shape every Origins choice takes — a background, a
	species, a reference class, a spell. Extracted because the builder is almost
	entirely made of these, and a single component keeps the selected state,
	keyboard affordance and `aria-pressed` consistent across every step.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		selected = false,
		onselect,
		title,
		subtitle,
		disabled = false,
		children
	}: {
		selected?: boolean;
		onselect: () => void;
		title: string;
		subtitle?: string;
		disabled?: boolean;
		children?: Snippet;
	} = $props();
</script>

<button
	type="button"
	onclick={onselect}
	{disabled}
	aria-pressed={selected}
	class="flex h-full w-full flex-col rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 {selected
		? 'border-accent bg-accent/5 ring-1 ring-accent'
		: 'border-border hover:border-accent'}"
>
	<span class="font-semibold">{title}</span>
	{#if subtitle}
		<span class="mt-1 text-sm text-muted">{subtitle}</span>
	{/if}
	{#if children}
		<div class="mt-2 text-sm text-muted">{@render children()}</div>
	{/if}
</button>
