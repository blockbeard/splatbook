<!--
	A nested "choose N" pick (the pack's sub-choice): a prompt, any fixed
	entries, toggleable options, and an optional free-text write-in. Controlled —
	the parent holds the ChoiceSelection and receives changes via `onchange`.
	Selection rules live in the engine (`choices.ts`), not here.
-->
<script lang="ts">
	import type { SubChoice } from '../../pack-schemas';
	import type { ChoiceSelection } from '../../engine';
	import {
		canPickMore,
		isSelectionValid,
		selectionCount,
		toggleOption
	} from '../../engine/choices';
	import Markdown from './Markdown.svelte';

	let {
		choice,
		selection,
		onchange
	}: {
		choice: SubChoice;
		selection?: ChoiceSelection;
		onchange: (selection: ChoiceSelection) => void;
	} = $props();

	const current = $derived<ChoiceSelection>(selection ?? { selected: [] });
	const count = $derived(selectionCount(selection));
	const valid = $derived(isSelectionValid(choice, selection));
	const atMax = $derived(!canPickMore(choice, selection));

	function toggle(label: string): void {
		onchange(toggleOption(choice, current, label));
	}

	function setWriteIn(value: string): void {
		onchange({ ...current, writeIn: value });
	}
</script>

<fieldset class="mt-4">
	<legend class="text-sm font-medium">
		{choice.prompt}
		<span class="ml-1 font-normal text-muted" class:text-accent={valid}>({count}/{choice.max})</span
		>
	</legend>

	{#if choice.fixed?.length}
		<ul class="mt-2 list-disc pl-5 text-sm text-muted">
			{#each choice.fixed as line (line)}
				<li><Markdown text={line} inline /></li>
			{/each}
		</ul>
	{/if}

	<div class="mt-2 flex flex-col gap-2">
		{#each choice.options as option (option.label)}
			{#if option.writeIn}
				<input
					type="text"
					value={current.writeIn ?? ''}
					oninput={(e) => setWriteIn(e.currentTarget.value)}
					placeholder={option.label || 'Write your own…'}
					class="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
				/>
			{:else}
				{@const on = current.selected.includes(option.label)}
				<button
					type="button"
					onclick={() => toggle(option.label)}
					disabled={!on && atMax}
					aria-pressed={on}
					class="rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 {on
						? 'border-accent bg-accent/5 ring-1 ring-accent'
						: 'border-border hover:border-accent'}"
				>
					<Markdown text={option.label} inline />
				</button>
			{/if}
		{/each}
	</div>
</fieldset>
