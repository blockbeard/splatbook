<!--
	The creatures in one enemy group: where each stands, how hurt it is, and
	whether it is still up.

	A group of one — the King of Swords — shows its creature openly, because that
	creature *is* the group and its Health is the thing everyone is watching. A
	larger group folds to one line ("Zombie · 3 of 4 up · Arena 2, Pillar 1") and
	opens to edit. Eight skeletons with a drop-down and four buttons each would
	otherwise bury the round under bookkeeping, which is the inversion phase 29
	spent a batch of design commits undoing.

	Everything here is anyone's except splitting and merging, which are how the
	GM divides their own enemies. Health and Defense changes say what they change
	*from*, so two people pressing the same button at once cannot apply one hit
	twice.
-->
<script lang="ts">
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { creatureLabel } from '../engine/creatures';
	import ZonePicker from './ZonePicker.svelte';

	type Group = ProjectedTable['opponents'][number];

	let {
		group,
		table,
		isGm = false,
		canAct = false,
		busy = false,
		onCommand
	}: {
		group: Group;
		table: ProjectedTable;
		isGm?: boolean;
		canAct?: boolean;
		busy?: boolean;
		onCommand: (command: unknown) => void;
	} = $props();

	let addMore = $state(1);
	/** Creatures the GM has ticked to split off. Local to this browser. */
	let picked = $state<string[]>([]);

	const disabled = $derived(!canAct || busy);
	const label = (id: string) => creatureLabel(table.opponents, id) ?? group.name;
	const zoneName = (id: string | null | undefined) =>
		table.scene.zones.find((z) => z.id === id)?.name ?? null;

	/** "Arena 2, Pillar 1" — where the creatures still up are standing. */
	const whereSummary = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const c of group.creatures) {
			if (c.down) continue;
			const name = zoneName(table.scene.at[c.id]) ?? 'not placed';
			counts[name] = (counts[name] ?? 0) + 1;
		}
		return Object.entries(counts)
			.map(([name, n]) => `${name} ${n}`)
			.join(', ');
	});

	function step(
		creature: string,
		pool: number,
		stat: 'health' | 'defense',
		from: number,
		by: number
	) {
		onCommand({ type: 'set-hd', creature, pool, stat, from, to: from + by });
	}

	function split() {
		if (picked.length === 0 || picked.length >= group.creatures.length) return;
		onCommand({
			type: 'split-opponent',
			id: group.id,
			newId: `${group.family}-${Date.now().toString(36)}`,
			creatures: picked
		});
		picked = [];
	}
</script>

{#snippet creatureRow(creature: Group['creatures'][number])}
	{@const name = label(creature.id)}
	<li class="cr" class:cr--down={creature.down}>
		<div class="cr__head">
			{#if isGm && group.creatures.length > 1}
				<label class="cr__pick">
					<input
						type="checkbox"
						checked={picked.includes(creature.id)}
						onchange={(e) =>
							(picked = (e.currentTarget as HTMLInputElement).checked
								? [...picked, creature.id]
								: picked.filter((id) => id !== creature.id))}
					/>
					<span class="sr-only">Choose {name} to split off</span>
				</label>
			{/if}
			<!-- A group of one is named by the heading above it; saying "King of
			     Swords" twice was the first thing a screenshot showed. -->
			{#if group.creatures.length > 1}
				<span class="cr__name"
					>{name}{#if creature.down}<span class="sr-only">, down</span>{/if}</span
				>
			{:else if creature.down}
				<span class="cr__name">Down</span>
			{/if}
			<ZonePicker
				who={creature.id}
				label={name}
				zones={table.scene.zones}
				at={table.scene.at[creature.id]}
				disabled={disabled || !isGm}
				{onCommand}
			/>
		</div>
		{#each creature.pools as pool, i (i)}
			<div class="cr__pool">
				{#if pool.name}<span class="cr__pool-name">{pool.name}</span>{/if}
				{#each [['health', 'Health', pool.health, pool.healthMax], ['defense', 'Defense', pool.defense, pool.defenseMax]] as const as [stat, word, value, max] (stat)}
					{#if max > 0 || stat === 'health'}
						<span class="cr__stat">
							<span class="cr__stat-word">{word}</span>
							<strong>{value}</strong><span class="cr__max">/{max}</span>
							<button
								type="button"
								class="ct-btn cr__step"
								aria-label={`${name}: ${word} down one`}
								disabled={disabled || value <= 0}
								onclick={() => step(creature.id, i, stat, value, -1)}>−</button
							>
							<button
								type="button"
								class="ct-btn cr__step"
								aria-label={`${name}: ${word} up one`}
								disabled={disabled || value >= max}
								onclick={() => step(creature.id, i, stat, value, 1)}>+</button
							>
						</span>
					{/if}
				{/each}
			</div>
		{/each}
		<div class="cr__actions">
			<button
				type="button"
				class="ct-btn ct-btn--quiet"
				disabled={disabled || (table.enemyHealth === 'hidden' && !isGm)}
				onclick={() => onCommand({ type: 'set-down', creature: creature.id, down: !creature.down })}
				>{creature.down ? 'Back up' : 'Down'}</button
			>
			{#if isGm && group.creatures.length > 1}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					aria-label={`Take ${name} off the table`}
					{disabled}
					onclick={() => {
						if (
							confirm(
								`Take ${name} off the table? This is for one added by mistake; for one that died, use Down.`
							)
						)
							onCommand({ type: 'remove-creature', creature: creature.id });
					}}>Remove</button
				>
			{/if}
		</div>
	</li>
{/snippet}

{#snippet groupControls()}
	{#if isGm}
		<div class="crs__gm">
			<form
				class="crs__more"
				onsubmit={(e) => (
					e.preventDefault(),
					onCommand({ type: 'add-creatures', id: group.id, count: addMore })
				)}
			>
				<label>
					Add
					<input
						type="number"
						min="1"
						max="52"
						class="ct-field ct-field--number"
						bind:value={addMore}
					/>
					more
				</label>
				<button type="submit" class="ct-btn" {disabled}>Add</button>
			</form>
			{#if group.creatures.length > 1}
				<button
					type="button"
					class="ct-btn"
					disabled={disabled || picked.length === 0 || picked.length >= group.creatures.length}
					onclick={split}
					>Split off {picked.length || ''} to act on {picked.length === 1 ? 'its' : 'their'} own</button
				>
			{/if}
			{#if group.splitFrom}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					{disabled}
					onclick={() => onCommand({ type: 'merge-opponent', id: group.id })}
					>Rejoin the rest</button
				>
			{/if}
		</div>
	{/if}
{/snippet}

{#if group.creatures.length === 1}
	<ul class="crs crs--one">
		{@render creatureRow(group.creatures[0])}
	</ul>
	{@render groupControls()}
{:else}
	<details class="crs__fold">
		<summary>
			<span>{group.count} of {group.creatures.length} up</span>
			{#if table.scene.zones.length > 0 && whereSummary}<span class="crs__where"
					>· {whereSummary}</span
				>{/if}
		</summary>
		<ul class="crs">
			{#each group.creatures as creature (creature.id)}
				{@render creatureRow(creature)}
			{/each}
		</ul>
		{@render groupControls()}
	</details>
{/if}

<style>
	.crs {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.crs--one {
		margin: 0 0 0.5rem;
	}
	.crs__fold > summary {
		cursor: pointer;
		min-block-size: 2.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		color: var(--ct-mark);
		font-size: var(--ct-step-label);
	}
	.crs__where {
		color: var(--ct-quiet);
	}
	.cr {
		display: grid;
		gap: 0.3rem;
		border-block-start: 1px solid var(--ct-rule);
		padding-block-start: 0.4rem;
	}
	.cr__head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.cr__name {
		font-family: 'IM Fell English', Georgia, serif;
		min-inline-size: 5rem;
	}
	/* Down is crossed out, not hidden — and said, for anyone not looking. */
	.cr--down .cr__name {
		text-decoration: line-through;
		color: var(--ct-quiet);
	}
	.cr__pick {
		display: inline-flex;
		align-items: center;
		min-block-size: 2.75rem;
		min-inline-size: 2.75rem;
		justify-content: center;
	}
	.cr__pick input {
		inline-size: 1.1rem;
		block-size: 1.1rem;
	}
	.cr__pool {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.9rem;
		align-items: center;
	}
	.cr__pool-name {
		color: var(--ct-quiet);
		font-size: var(--ct-step-label);
	}
	.cr__stat {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.cr__stat-word {
		color: var(--ct-quiet);
		font-size: var(--ct-step-label);
	}
	.cr__stat strong {
		font-weight: 400;
		font-size: 1.1rem;
		color: var(--ct-mark);
		min-inline-size: 1.2em;
		text-align: end;
	}
	.cr__max {
		color: var(--ct-quiet);
		font-size: var(--ct-step-label);
	}
	.cr__step {
		min-inline-size: 2.75rem;
		padding-inline: 0;
	}
	.cr__actions,
	.crs__gm,
	.crs__more {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.crs__gm {
		margin-block-start: 0.6rem;
	}
	label {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.9rem;
	}
</style>
