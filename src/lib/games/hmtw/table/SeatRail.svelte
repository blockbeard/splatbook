<!--
	Who is at the table, and what they are holding in the open.

	A seat shows its durable card face up, because ch.5's inspiration cards are
	held publicly — the table knows who has one, which is the whole point of the
	High Chant distributing them. Hands are shown as a count, never their
	contents, and a seat waiting on the GM is listed as waiting rather than
	hidden: a player wants to see that their request arrived.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import SeatName from './SeatName.svelte';
	import type { FaceIndex } from './faces';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import type { Pick } from '$lib/card-table/selection';

	let {
		table,
		seats,
		faces,
		mySeatId,
		isGm = false,
		selected = null,
		onSelect,
		onDrop
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		mySeatId: string | null;
		isGm?: boolean;
		selected?: Pick | null;
		onSelect?: (pick: Pick) => void;
		onDrop?: (zoneId: string) => void;
	} = $props();

	const admitted = $derived(seats.filter((s) => s.status === 'admitted'));
	const waiting = $derived(seats.filter((s) => s.status === 'pending'));

	const durableOf = (seatId: string) => table.zones[`seat:${seatId}:durable`];
	const handOf = (seatId: string) => table.zones[`seat:${seatId}:hand`];
</script>

<aside class="rail">
	<h2 class="ct-zone-label">At the table</h2>
	<ul class="rail__list">
		{#each admitted as seat (seat.id)}
			{@const durable = durableOf(seat.id)}
			{@const top = durable?.cards?.[0]}
			<li class="seat" class:seat--mine={seat.id === mySeatId}>
				<SeatName
					name={seat.name}
					isGm={seat.isGm}
					mine={seat.id === mySeatId}
					hand={handOf(seat.id)?.count ?? 0}
				/>

				{#if durable}
					<div class="seat__durable" class:ct-drop={!!selected}>
						{#if top}
							<Card
								face={faces[top] ?? null}
								pick={{ zone: durable.id, card: top }}
								selected={selected?.zone === durable.id}
								onSelect={(p) => (selected ? onDrop?.(durable.id) : onSelect?.(p))}
							/>
						{:else}
							<button
								type="button"
								class="seat__slot"
								aria-label={`${seat.name}'s inspiration card, empty`}
								onclick={() => onDrop?.(durable.id)}>Inspiration</button
							>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if waiting.length > 0}
		<h2 class="ct-zone-label">Waiting</h2>
		<ul class="rail__list">
			{#each waiting as seat (seat.id)}
				<li class="seat seat--waiting">
					<SeatName name={seat.name} />
					{#if isGm}
						<span class="seat__actions">
							<form method="POST" action="?/admit">
								<input type="hidden" name="seatId" value={seat.id} />
								<button type="submit" class="ct-btn ct-btn--primary">Let in</button>
							</form>
							<form method="POST" action="?/decline">
								<input type="hidden" name="seatId" value={seat.id} />
								<button type="submit" class="ct-btn ct-btn--quiet">Turn away</button>
							</form>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</aside>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-inline-size: 12rem;
	}
	.rail__list {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.seat {
		border-block-start: 1px solid var(--ct-rule);
		padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}
	.seat--mine {
		border-block-start-color: var(--ct-rule-strong);
	}
	.seat__durable {
		border-radius: 4px;
	}
	.seat__slot {
		inline-size: var(--ct-card-w);
		block-size: var(--ct-card-h);
		border: 1px dashed var(--ct-rule);
		border-radius: var(--ct-radius);
		background: none;
		color: var(--ct-quiet);
		font-family: 'IM Fell Great Primer SC', 'IM Fell English SC', Georgia, serif;
		font-size: 0.7rem;
		cursor: pointer;
	}
	.seat__actions {
		display: flex;
		gap: 0.5rem;
		margin-block-start: 0.3rem;
	}
</style>
