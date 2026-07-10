<!--
	The steading's Residents table (phase 6, commit 47) — the NPCs who live here.
	Each row is name / occupation / notes; the pack's Welsh name list, prefilled
	occupations, and NPC trait list back <datalist> pickers so a GM can drop in a
	name or trait fast without them being hard-coded in the app. Presentational
	only: it emits the whole new rows array through `onChange`.
-->
<script lang="ts">
	import type { ResidentRow } from '../engine/steading';

	let {
		residents,
		names = [],
		occupations = [],
		traits = [],
		onChange
	}: {
		residents: ResidentRow[];
		names?: string[];
		occupations?: string[];
		traits?: string[];
		onChange: (rows: ResidentRow[]) => void;
	} = $props();

	const edit = (i: number, patch: Partial<ResidentRow>) =>
		onChange(residents.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	const remove = (i: number) => onChange(residents.filter((_, j) => j !== i));
	const add = () => onChange([...residents, { name: '', occupation: '', notes: '' }]);
</script>

<datalist id="resident-names">
	{#each names as n (n)}<option value={n}></option>{/each}
</datalist>
<datalist id="resident-occupations">
	{#each occupations as o (o)}<option value={o}></option>{/each}
</datalist>
<datalist id="resident-traits">
	{#each traits as t (t)}<option value={t}></option>{/each}
</datalist>

<ul class="space-y-2">
	{#each residents as r, i (i)}
		<li class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
			<input
				type="text"
				value={r.name}
				list="resident-names"
				placeholder="Name (pronouns)"
				oninput={(e) => edit(i, { name: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<input
				type="text"
				value={r.occupation}
				list="resident-occupations"
				placeholder="Occupation"
				oninput={(e) => edit(i, { occupation: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<input
				type="text"
				value={r.notes}
				list="resident-traits"
				placeholder="Traits, relations, etc."
				oninput={(e) => edit(i, { notes: e.currentTarget.value })}
				class="rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<button
				type="button"
				onclick={() => remove(i)}
				aria-label="Remove resident"
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
	+ Resident
</button>
