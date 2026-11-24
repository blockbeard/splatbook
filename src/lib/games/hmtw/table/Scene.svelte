<!--
	The scene: the zones the GM named, and who is standing in each.

	The summary leads, because it answers the question the whiteboard used to:
	where is everybody? It is also ch.7's "as the new round begins, restate where
	every character is" — read off the screen instead of said out loud each round.
	The drop-downs that set it live with each combatant, next to the person they
	move; this panel only reads them back.

	The zone list is the GM's, in a native <details> like the deal panel, so it is
	one line until the GM wants it. Removing a zone somebody is standing in asks
	first: they become unplaced, and re-adding a zone of the same name does not put
	them back.
-->
<script lang="ts">
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { placeablePeople, strandedBy, whoIsWhere } from './scene-view';

	let {
		table,
		seats,
		isGm = false,
		busy = false,
		onCommand
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		isGm?: boolean;
		busy?: boolean;
		onCommand: (command: unknown) => void;
	} = $props();

	const rows = $derived(whoIsWhere(table, seats));
	const people = $derived(placeablePeople(table, seats));

	let editing = $state(false);
	let draft = $state<{ id: string; name: string }[]>([]);
	const newZone = () => ({ id: `z-${crypto.randomUUID().slice(0, 8)}`, name: '' });

	/** Seed the editor from the table each time it opens, so it never edits a stale list. */
	function toggled(open: boolean) {
		if (!open) return;
		draft = table.scene.zones.length
			? table.scene.zones.map((z) => ({ ...z }))
			: [newZone(), newZone()];
	}

	function save() {
		const zones = draft.map((z) => ({ id: z.id, name: z.name.trim() })).filter((z) => z.name);
		const stranded = strandedBy(
			table,
			zones.map((z) => z.id),
			people
		);
		if (stranded.length > 0) {
			const names = stranded.map((p) => p.label).join(', ');
			const ok = confirm(
				`Remove those zones? ${names} will not be placed anywhere, and adding the zone again will not put them back.`
			);
			if (!ok) return;
		}
		onCommand({ type: 'set-scene-zones', zones });
		editing = false;
	}

	function newScene() {
		const ok = confirm('Start a new scene? The zones go, and nobody is placed anywhere.');
		if (ok) onCommand({ type: 'clear-scene' });
	}
</script>

<section class="scene" aria-labelledby="scene-heading">
	<h2 id="scene-heading" class="ct-zone-label">Where everyone is</h2>

	{#if rows.length === 0}
		<p class="scene__empty">
			{isGm ? 'No zones yet. Name them to set the scene.' : 'The GM has not named the zones yet.'}
		</p>
	{:else}
		<dl class="scene__rows">
			{#each rows as row (row.zone?.id ?? 'not-placed')}
				<div class="scene__row" class:scene__row--unplaced={row.zone === null}>
					<dt>{row.zone?.name ?? 'Not placed'}</dt>
					<dd>
						{#if row.people.length === 0}
							<span class="scene__nobody">nobody</span>
						{:else}
							{#each row.people as person, i (person.id)}
								<!-- The separator is an expression, not template whitespace, which
								     Svelte trims: "Zombie B,Zombie C" was the result. -->
								<span class="scene__who" class:scene__who--down={person.down}
									>{person.label}{#if person.down}<span class="sr-only">, down</span>{/if}</span
								>{i < row.people.length - 1 ? ', ' : ''}
							{/each}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if isGm}
		<div class="scene__gm">
			<details
				class="scene__edit"
				bind:open={editing}
				ontoggle={(e) => toggled((e.currentTarget as HTMLDetailsElement).open)}
			>
				<summary>{table.scene.zones.length ? 'Change the zones…' : 'Name the zones…'}</summary>
				<form class="scene__form" onsubmit={(e) => (e.preventDefault(), save())}>
					<ol class="scene__list">
						{#each draft as zone, i (zone.id)}
							<li>
								<label class="sr-only" for={`zone-${zone.id}`}>Zone {i + 1}</label>
								<input
									id={`zone-${zone.id}`}
									class="ct-field"
									bind:value={zone.name}
									maxlength="40"
									placeholder={i === 0 ? 'Arena' : i === 1 ? "King's Pillar" : ''}
									autocomplete="off"
								/>
								<button
									type="button"
									class="ct-btn ct-btn--quiet"
									aria-label={`Remove zone ${zone.name || i + 1}`}
									onclick={() => (draft = draft.filter((z) => z.id !== zone.id))}>Remove</button
								>
							</li>
						{/each}
					</ol>
					<div class="scene__form-actions">
						<button
							type="button"
							class="ct-btn"
							disabled={draft.length >= 20}
							onclick={() => (draft = [...draft, newZone()])}>Add a zone</button
						>
						<button type="submit" class="ct-btn ct-btn--primary" disabled={busy}
							>Save the zones</button
						>
					</div>
				</form>
			</details>
			{#if table.scene.zones.length > 0}
				<!-- Destructive, so quiet, apart, and it asks. -->
				<button type="button" class="ct-btn ct-btn--quiet scene__new" onclick={newScene}
					>New scene</button
				>
			{/if}
		</div>
	{/if}
</section>

<style>
	.scene {
		display: grid;
		gap: 0.6rem;
	}
	.scene h2 {
		margin: 0;
	}
	.scene__empty {
		margin: 0;
		color: var(--ct-quiet);
	}
	.scene__rows {
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}
	.scene__row {
		display: grid;
		grid-template-columns: minmax(6rem, max-content) 1fr;
		gap: 0.75rem;
		align-items: baseline;
	}
	.scene__row dt {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		color: var(--ct-mark);
	}
	.scene__row dd {
		margin: 0;
		font-family: 'IM Fell English', Georgia, serif;
		font-size: 1.05rem;
	}
	.scene__row--unplaced dt,
	.scene__row--unplaced dd {
		color: var(--ct-quiet);
	}
	.scene__nobody {
		color: var(--ct-quiet);
		font-style: italic;
	}
	.scene__who--down {
		text-decoration: line-through;
		color: var(--ct-quiet);
	}
	.scene__gm {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.scene__edit > summary {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		cursor: pointer;
		inline-size: fit-content;
		padding: 0.5rem 0.9rem;
		min-block-size: 2.75rem;
		display: flex;
		align-items: center;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-mark);
	}
	.scene__form {
		display: grid;
		gap: 0.6rem;
		margin-block-start: 0.75rem;
	}
	.scene__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.4rem;
	}
	.scene__list li {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.scene__form-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	/* Apart from the editor, so "Save" and "New scene" are never side by side. */
	.scene__new {
		margin-inline-start: auto;
	}
</style>
