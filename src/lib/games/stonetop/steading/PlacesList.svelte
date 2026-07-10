<!--
	The Places of Interest list — marker + name rows keyed to the steading map
	(phase 6, commit 46). Adding a place suggests the next unused write-in marker
	from the pack (G, H, I…). Presentational only; emits the whole new array.
-->
<script lang="ts">
	import type { PlaceOfInterest } from '../engine/steading';

	let {
		places,
		writeInMarkers = [],
		onChange
	}: {
		places: PlaceOfInterest[];
		writeInMarkers?: string[];
		onChange: (places: PlaceOfInterest[]) => void;
	} = $props();

	const edit = (i: number, patch: Partial<PlaceOfInterest>) =>
		onChange(places.map((p, j) => (j === i ? { ...p, ...patch } : p)));
	const remove = (i: number) => onChange(places.filter((_, j) => j !== i));
	const add = () => {
		const used = new Set(places.map((p) => p.marker));
		const next = writeInMarkers.find((m) => !used.has(m)) ?? '';
		onChange([...places, { marker: next, name: '' }]);
	};
</script>

<ul class="space-y-1">
	{#each places as place, i (i)}
		<li class="flex items-center gap-2">
			<input
				type="text"
				value={place.marker}
				aria-label="Marker"
				oninput={(e) => edit(i, { marker: e.currentTarget.value })}
				class="w-12 rounded border border-border bg-transparent px-2 py-1 text-center text-sm font-mono focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<input
				type="text"
				value={place.name}
				aria-label="Place name"
				placeholder="Place of interest"
				oninput={(e) => edit(i, { name: e.currentTarget.value })}
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

<button
	type="button"
	onclick={add}
	class="mt-2 rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
>
	+ Place
</button>
