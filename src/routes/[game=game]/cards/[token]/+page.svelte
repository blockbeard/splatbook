<!--
	A card table.

	Three states, and which one you are in is the first thing the page answers:
	you have no seat and can ask for one; you have asked and are waiting; or you
	are sitting down and can play. Watching without a seat is allowed — somebody
	should be able to open the link and see what is going on before deciding to
	join — but acting is not.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import DecksMode from '$lib/games/hmtw/table/DecksMode.svelte';
	import { buildFaces } from '$lib/games/hmtw/table/faces';
	import { pollingTransport } from '$lib/card-table-sync';
	import { fetchSince, newRequestKey, sendCommand } from '$lib/card-table/client';
	import { MAX_SEAT_NAME_LENGTH } from '$lib/card-table-limits';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import '$lib/games/hmtw/table/table.css';

	let { data, form } = $props();

	const faces = $derived(buildFaces(data.pack['data/deck.json'] as never));

	// Seeded from the server render, then owned by the poll. `data` is reactive —
	// joining a seat reloads it — so an effect below adopts a server view that
	// has moved ahead of ours rather than leaving the page a second behind.
	// svelte-ignore state_referenced_locally
	let version = $state(data.view.version);
	// svelte-ignore state_referenced_locally
	let table = $state(data.view.state as ProjectedTable);
	// The roster moves without the version moving — somebody asking for a seat
	// writes no card — so it is its own state, refreshed by every poll.
	// svelte-ignore state_referenced_locally
	let seats = $state(data.view.seats);
	let busy = $state(false);
	let notice = $state<string | null>(null);

	$effect(() => {
		if (data.view.version > version) {
			version = data.view.version;
			table = data.view.state as ProjectedTable;
		}
	});

	const admitted = $derived(data.mySeat?.status === 'admitted');

	onMount(() => {
		const token = data.token;
		const transport = pollingTransport({
			fetchSince: (v) => fetchSince(token, v),
			onUpdate: (snapshot) => {
				version = snapshot.version;
				table = snapshot.state as ProjectedTable;
				if (snapshot.seats) seats = snapshot.seats;
			},
			isHidden: () => document.hidden,
			// Decks mode is the quiet one; the Challenge is where a beat of delay
			// would show, and it will say so when it exists.
			isBusy: () => false,
			version
		});
		transport.start();
		return () => transport.stop();
	});

	async function run(command: unknown) {
		if (busy) return;
		busy = true;
		notice = null;
		// One key per intent, reused if we retry: the server treats it as a lock,
		// so regenerating it on a retry would move two cards for one click.
		const key = newRequestKey();
		const reply = await sendCommand(data.token, command, version, key);
		if (reply.ok && reply.view) {
			version = reply.view.version;
			table = reply.view.state as ProjectedTable;
			if (reply.view.seats) seats = reply.view.seats;
		} else if (reply.reason === 'conflict') {
			// Ordinary: somebody got there first. Re-sync and let them try again,
			// rather than telling them off for it.
			const fresh = await fetchSince(data.token, 0);
			if (fresh) {
				version = fresh.version;
				table = fresh.state as ProjectedTable;
				if (fresh.seats) seats = fresh.seats;
			}
			notice = 'Someone got there first.';
		} else {
			notice = 'This table is no longer taking cards.';
		}
		busy = false;
	}
</script>

<svelte:head><title>{data.name} — card table</title></svelte:head>

<div class="ct ct-page">
	<header class="ct-page__head">
		<h1>{data.name}</h1>
		{#if data.mySeat === null}
			<p class="ct-page__watching">You are watching.</p>
		{/if}
	</header>

	{#if data.mySeat === null}
		<form
			method="POST"
			action="?/join"
			use:enhance={() =>
				async ({ update }) => {
					await update();
					await invalidateAll();
				}}
			class="join"
		>
			<label for="seat-name">Your character's name</label>
			<input
				id="seat-name"
				name="name"
				maxlength={MAX_SEAT_NAME_LENGTH}
				required
				autocomplete="off"
			/>
			<p class="join__hint">
				This is shown to everyone at the table. It is the only thing the table stores about you —
				use your character's name, not your own.
			</p>
			{#if form?.message}<p class="join__error">{form.message}</p>{/if}
			<button type="submit">Ask for a seat</button>
		</form>
	{:else if !admitted}
		<p class="waiting">Waiting for the GM to let you in. You can watch in the meantime.</p>
	{/if}

	{#if data.mySeat && admitted && table.gmSeat === null}
		<form method="POST" action="?/claimGm" use:enhance class="claim">
			<p>Nobody is running this table.</p>
			<button type="submit">Take the GM's chair</button>
		</form>
	{/if}

	{#if notice}<p class="notice">{notice}</p>{/if}

	<DecksMode
		{table}
		{seats}
		{faces}
		mySeatId={data.mySeat?.id ?? null}
		canAct={admitted}
		{busy}
		onCommand={run}
	/>
</div>

<style>
	.ct-page {
		min-block-size: 100vh;
	}
	.ct-page__head {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding: 1.25rem 1.25rem 0;
	}
	h1 {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-weight: 400;
		font-size: 1.5rem;
		margin: 0;
		color: var(--ct-card);
	}
	.ct-page__watching,
	.waiting {
		color: rgb(236 231 219 / 55%);
		margin: 0;
	}
	.join,
	.claim {
		margin: 1rem 1.25rem;
		padding: 1rem;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
		max-inline-size: 26rem;
		display: grid;
		gap: 0.5rem;
	}
	.join label {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 0.85rem;
	}
	.join input {
		background: rgb(0 0 0 / 25%);
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-card);
		font: inherit;
		padding: 0.5rem;
		min-block-size: 2.75rem;
	}
	.join__hint {
		margin: 0;
		font-size: 0.8rem;
		color: rgb(236 231 219 / 55%);
	}
	.join__error,
	.notice {
		color: var(--ct-light);
		margin: 0.5rem 1.25rem;
	}
	.join button,
	.claim button {
		justify-self: start;
		background: none;
		border: 1px solid var(--ct-light-soft);
		border-radius: 3px;
		color: var(--ct-light);
		font: inherit;
		padding: 0.5rem 1rem;
		min-block-size: 2.75rem;
		cursor: pointer;
	}
	.waiting {
		margin: 1rem 1.25rem;
	}
</style>
