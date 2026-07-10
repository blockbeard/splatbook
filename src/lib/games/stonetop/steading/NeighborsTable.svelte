<!--
	The Neighbors table (phase 6, commit 47) — NPCs from the surrounding places
	(Marshedge, Gordin's Delve, the Steplands…). Each row is name / home /
	occupation / notes; `home` is a select of the pack's places, and the name
	field offers that place's own name list as a <datalist> (falling back to the
	full set). Presentational only; emits the whole rows array through `onChange`.
-->
<script lang="ts">
	import type { NeighborRow } from '../engine/steading';

	interface Place {
		name: string;
		names: string[];
	}

	let {
		neighbors,
		places = [],
		onChange
	}: {
		neighbors: NeighborRow[];
		places?: Place[];
		onChange: (rows: NeighborRow[]) => void;
	} = $props();

	const edit = (i: number, patch: Partial<NeighborRow>) =>
		onChange(neighbors.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	const remove = (i: number) => onChange(neighbors.filter((_, j) => j !== i));
	const add = () => onChange([...neighbors, { name: '', home: '', occupation: '', notes: '' }]);

	// Per-place name lists → <datalist>s; a row points at its home's list.
	const listId = (home: string) => `neighbor-names-${home.replace(/\W+/g, '-').toLowerCase()}`;
	const withNames = $derived(places.filter((p) => p.names.length));
</script>

{#each withNames as p (p.name)}
	<datalist id={listId(p.name)}>
		{#each p.names as n (n)}<option value={n}></option>{/each}
	</datalist>
{/each}

<ul class="space-y-2">
	{#each neighbors as r, i (i)}
		<li class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_2fr_auto]">
			<input
				type="text"
				value={r.name}
				list={listId(r.home)}
				placeholder="Name (pronouns)"
				oninput={(e) => edit(i, { name: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<select
				value={r.home}
				onchange={(e) => edit(i, { home: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			>
				<option value="">Home…</option>
				{#each places as p (p.name)}
					<option value={p.name}>{p.name}</option>
				{/each}
			</select>
			<input
				type="text"
				value={r.occupation}
				placeholder="Occupation"
				oninput={(e) => edit(i, { occupation: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<input
				type="text"
				value={r.notes}
				placeholder="Traits, relations, etc."
				oninput={(e) => edit(i, { notes: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<button
				type="button"
				onclick={() => remove(i)}
				aria-label="Remove neighbour"
				class="shrink-0 rounded border border-border px-2 py-1 text-sm text-muted hover:text-danger"
			>
				×
			</button>
		</li>
	{/each}
</ul>

<button
	type="button"
	onclick={add}
	class="mt-2 rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
>
	+ Neighbour
</button>
