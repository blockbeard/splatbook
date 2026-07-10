<!--
	Travel times, made scannable with a live filter: type a place and the origin
	groups collapse to just the routes that mention it (in the "from" heading or a
	destination). No filter → everything shows. View state only.
-->
<script lang="ts">
	interface TravelGroup {
		from: string;
		entries: (readonly [string, string])[];
	}

	let { groups }: { groups: readonly TravelGroup[] } = $props();

	let query = $state('');
	const q = $derived(query.trim().toLowerCase());

	const filtered = $derived(
		q === ''
			? groups.map((g) => ({ from: g.from, entries: g.entries }))
			: groups
					.map((g) => {
						const fromMatch = g.from.toLowerCase().includes(q);
						const entries = fromMatch
							? g.entries
							: g.entries.filter(([dest]) => dest.toLowerCase().includes(q));
						return { from: g.from, entries };
					})
					.filter((g) => g.entries.length > 0)
	);
</script>

<div class="mt-2">
	<input
		type="search"
		bind:value={query}
		placeholder="Filter by place…"
		aria-label="Filter travel times"
		class="w-full max-w-xs rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
	/>

	{#if filtered.length === 0}
		<p class="mt-3 text-sm text-muted">No routes mention “{query}”.</p>
	{:else}
		<div class="mt-3 space-y-4">
			{#each filtered as group (group.from)}
				<div>
					<p class="text-sm font-medium">{group.from}</p>
					<table class="gm-table mt-1 w-full text-sm">
						<tbody>
							{#each group.entries as [dest, time], i (i)}
								<tr>
									<td>{dest}</td>
									<td class="whitespace-nowrap">{time}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.gm-table :global(td) {
		border: 1px solid var(--sb-border, currentColor);
		padding: 0.25rem 0.5rem;
		text-align: left;
		vertical-align: top;
	}
</style>
