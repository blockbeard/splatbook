<!--
	A small editable string list — add, edit in place, remove. Used for the
	steading's Resources, Fortifications and Assets (phase 6, commit 46). Purely
	presentational: it holds no state, emitting the whole new array through
	`onChange` so the editor can run it into the steading via a pure engine op.
	Write-ins are just added rows, so the printed "write-in" lines need no special
	handling — `writeInsHint` only surfaces how many blanks the sheet suggests.
-->
<script lang="ts">
	let {
		items,
		onChange,
		addLabel = 'Add',
		placeholder = '',
		writeInsHint
	}: {
		items: string[];
		onChange: (items: string[]) => void;
		addLabel?: string;
		placeholder?: string;
		writeInsHint?: number;
	} = $props();

	const edit = (i: number, value: string) => onChange(items.map((it, j) => (j === i ? value : it)));
	const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
	const add = () => onChange([...items, '']);
</script>

<ul class="space-y-1">
	{#each items as item, i (i)}
		<li class="flex items-center gap-2">
			<input
				type="text"
				value={item}
				{placeholder}
				oninput={(e) => edit(i, e.currentTarget.value)}
				class="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<button
				type="button"
				onclick={() => remove(i)}
				aria-label="Remove"
				class="shrink-0 rounded border border-border px-2 py-1 text-sm text-muted hover:text-danger"
			>
				×
			</button>
		</li>
	{/each}
</ul>

<div class="mt-2 flex items-center gap-3">
	<button
		type="button"
		onclick={add}
		class="rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
	>
		+ {addLabel}
	</button>
	{#if writeInsHint}
		<span class="text-xs text-muted">Sheet suggests {writeInsHint} write-in line(s)</span>
	{/if}
</div>
