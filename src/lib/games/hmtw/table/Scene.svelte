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

	The picture (phase 31) sits above the list: a Miro drawing screenshotted, or
	one of the book's zone pictures. It is for looking at; the list is the record.
	It is fetched by id when the table names a new one, shown at a height that
	leaves the fight on screen, and opened full size in a dialog by "Look closer".
	Only the GM puts one up or takes it down, and taking it down asks first.
-->
<script lang="ts">
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { placeablePeople, strandedBy, whoIsWhere } from './scene-view';
	import { PictureTooLarge, fetchPicture, preparePicture } from '$lib/card-table/picture';

	let {
		table,
		seats,
		isGm = false,
		busy = false,
		onCommand,
		token = '',
		onPicture
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		isGm?: boolean;
		busy?: boolean;
		onCommand: (command: unknown) => void;
		token?: string;
		onPicture?: (dataUrl: string) => Promise<string | null>;
	} = $props();

	/** The picture as a `data:` URL, once fetched. Local to this browser. */
	let picture = $state<string | null>(null);
	let pictureFor = '';
	let pictureNote = $state('');
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let closer = $state<HTMLDialogElement | null>(null);

	/** Fetch the picture when the table names a different one, and only then. */
	$effect(() => {
		const id = table.scene.picture?.id ?? '';
		if (id === pictureFor) return;
		pictureFor = id;
		if (!id || !token) {
			picture = null;
			return;
		}
		fetchPicture(token, id).then((url) => {
			if (pictureFor === id) picture = url;
		});
	});

	const pictureAlt = $derived(
		table.scene.zones.length
			? `The GM's picture of the scene: ${table.scene.zones.map((z) => z.name).join(', ')}`
			: "The GM's picture of the scene"
	);

	async function chosen(file: File | undefined) {
		if (!file || !onPicture) return;
		uploading = true;
		pictureNote = 'Putting the picture up…';
		try {
			const dataUrl = await preparePicture(file);
			const why = await onPicture(dataUrl);
			pictureNote = why ?? 'The picture is up.';
		} catch (e) {
			pictureNote =
				e instanceof PictureTooLarge
					? 'That picture is too large, even made smaller.'
					: 'That file could not be read as a picture.';
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function takeDown() {
		if (confirm('Take the picture down? It is deleted, not hidden.')) {
			onCommand({ type: 'clear-scene-picture' });
			pictureNote = '';
		}
	}

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
		const ok = confirm(
			'Start a new scene? The zones go, nobody is placed anywhere, and the picture is deleted.'
		);
		if (ok) onCommand({ type: 'clear-scene' });
	}
</script>

<section class="scene" aria-labelledby="scene-heading">
	<h2 id="scene-heading" class="ct-zone-label">Where everyone is</h2>

	{#if picture}
		<figure class="scene__picture">
			<img src={picture} alt={pictureAlt} />
			<figcaption>
				<button type="button" class="ct-btn ct-btn--quiet" onclick={() => closer?.showModal()}
					>Look closer</button
				>
			</figcaption>
		</figure>
		<dialog class="scene__closer" bind:this={closer} aria-label={pictureAlt}>
			<img src={picture} alt={pictureAlt} />
			<form method="dialog">
				<button type="submit" class="ct-btn">Close</button>
			</form>
		</dialog>
	{/if}

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
			{#if onPicture}
				<input
					bind:this={fileInput}
					type="file"
					accept="image/*"
					hidden
					onchange={(e) => chosen((e.currentTarget as HTMLInputElement).files?.[0])}
				/>
				<button
					type="button"
					class="ct-btn"
					disabled={busy || uploading}
					onclick={() => fileInput?.click()}
				>
					{table.scene.picture ? 'Change the picture…' : 'Put up a picture…'}
				</button>
				{#if table.scene.picture}
					<button type="button" class="ct-btn ct-btn--quiet" disabled={busy} onclick={takeDown}
						>Take it down</button
					>
				{/if}
			{/if}
			{#if table.scene.zones.length > 0 || table.scene.picture}
				<!-- Destructive, so quiet, apart, and it asks. -->
				<button type="button" class="ct-btn ct-btn--quiet scene__new" onclick={newScene}
					>New scene</button
				>
			{/if}
		</div>
		<p class="scene__note" role="status">{pictureNote}</p>
	{/if}
</section>

<style>
	.scene__picture {
		margin: 0;
		display: grid;
		gap: 0.35rem;
		justify-items: start;
	}
	/* Big enough to read a zone's name off; small enough to leave the fight on screen. */
	.scene__picture img {
		display: block;
		max-inline-size: 100%;
		max-block-size: 45vh;
		object-fit: contain;
		border: 1px solid var(--ct-rule);
		border-radius: 3px;
	}
	.scene__closer {
		max-inline-size: 96vw;
		max-block-size: 94vh;
		padding: 0.75rem;
		background: var(--ct-table-low);
		color: inherit;
		border: 1px solid var(--ct-rule-strong);
	}
	.scene__closer img {
		display: block;
		max-inline-size: 100%;
		max-block-size: 84vh;
		object-fit: contain;
		margin-block-end: 0.5rem;
	}
	.scene__closer::backdrop {
		background: rgb(0 0 0 / 0.7);
	}
	.scene__note {
		margin: 0;
		color: var(--ct-quiet);
		font-size: 0.85rem;
	}
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
