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
	import ChallengeMode from '$lib/games/hmtw/table/ChallengeMode.svelte';
	import { buildFaces } from '$lib/games/hmtw/table/faces';
	import { pollingTransport } from '$lib/card-table-sync';
	import { fetchSince, newRequestKey, sendCommand } from '$lib/card-table/client';
	import { reverseOf, type PublicEvent } from '$lib/games/hmtw/table/undo';
	import { announce } from '$lib/games/hmtw/table/announce';
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
	// svelte-ignore state_referenced_locally
	let polledSeatId = $state<string | null>(data.view.seatId);
	let busy = $state(false);
	/**
	 * What has happened since this page opened.
	 *
	 * Only since: the page load asks for no history, so "put that card back"
	 * can only reverse a move somebody here actually saw. Trimmed to a short
	 * tail because nothing reads further back than the most recent move.
	 */
	let events = $state<PublicEvent[]>([]);
	/**
	 * A passing word, or a standing one. Losing a race is passing — it clears
	 * itself, because "someone got there first" is news for a moment and clutter
	 * after that. A table that has stopped taking cards is standing, and stays.
	 */
	let notice = $state<{ text: string; passing: boolean } | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	/** The last thing worth saying out loud. Read by the live region below. */
	let said = $state('');

	// A passing note outliving the page it belonged to is nobody's idea of tidy.
	$effect(() => () => clearTimeout(noticeTimer));

	function say(text: string, passing: boolean) {
		clearTimeout(noticeTimer);
		notice = { text, passing };
		if (passing) noticeTimer = setTimeout(() => (notice = null), 4000);
	}

	const EVENT_TAIL = 40;
	/** The highest event version already folded in — the tail's own cursor. */
	let seenTo = $state(0);
	/**
	 * Fold new events onto the tail, in order, once each.
	 *
	 * A poll and a command overlap freely: a poll asking from v4 can come back
	 * with v5 and v6 *after* the reply to our own command already added v5, v6
	 * and v7. Appending blind would leave v6 as the last thing that happened and
	 * "put that card back" would reverse the wrong move. Versions only ever go
	 * up, so the cursor settles it.
	 */
	function remember(incoming: PublicEvent[] | undefined) {
		const fresh = (incoming ?? []).filter((e) => e.version > seenTo);
		if (fresh.length === 0) return;
		fresh.sort((a, b) => a.version - b.version);
		seenTo = fresh[fresh.length - 1].version;
		events = [...events, ...fresh].slice(-EVENT_TAIL);
		// Everything on this table moves because somebody else moved it. Sighted
		// players catch that from the corner of an eye; this is the same news for
		// anyone who cannot, and the count-up in particular is how the table says
		// your turn has come.
		said = announce(fresh, (id) => seats.find((s) => s.id === id)?.name ?? 'Someone') ?? said;
	}

	$effect(() => {
		if (data.view.version > version) {
			version = data.view.version;
			table = data.view.state as ProjectedTable;
		}
	});

	/**
	 * Whose seat this is, and whether it is sitting — read from the *polled*
	 * roster rather than the page load.
	 *
	 * Taking it from `data` meant being let in did nothing until you reloaded:
	 * the GM admitted you, the roster updated, and your own client carried on
	 * believing it was still waiting. The sync already carries both the roster
	 * and your seat id, so this follows them.
	 */
	const mySeatId = $derived(polledSeatId ?? data.mySeat?.id ?? null);
	const mySeat = $derived(seats.find((s) => s.id === mySeatId) ?? null);
	const admitted = $derived(mySeat?.status === 'admitted');
	const isGm = $derived(admitted && table.gmSeat === mySeatId);

	/** The move that would put the last card back, if it is one you may make. */
	const reversal = $derived(admitted ? reverseOf(events, mySeatId) : null);

	onMount(() => {
		const token = data.token;
		const transport = pollingTransport({
			fetchSince: (v) => fetchSince(token, v),
			onUpdate: (snapshot) => {
				version = snapshot.version;
				table = snapshot.state as ProjectedTable;
				if (snapshot.seats) seats = snapshot.seats;
				if (snapshot.seatId) polledSeatId = snapshot.seatId;
				remember(snapshot.events);
			},
			isHidden: () => document.hidden,
			// Decks mode is the quiet one; the Challenge is where a beat of delay
			// would show, and it will say so when it exists.
			// A Challenge is where a beat of delay shows, so it is asked about more
			// often; the decks are quiet enough for the slower cadence.
			isBusy: () => table.mode === 'challenge',
			version
		});
		transport.start();
		return () => transport.stop();
	});

	/**
	 * Leaving a Challenge sweeps the table to the discards, so it asks first.
	 * This is the one control here that destroys work, and a misclick costing a
	 * readied Dodge and five hands is how people stop trusting an app.
	 */
	function leaveChallenge() {
		if (table.mode === 'decks') return;
		const ok = confirm(
			'End the Challenge? Every card on the table goes to the discards. Inspiration cards stay.'
		);
		if (ok) run({ type: 'set-mode', mode: 'decks' });
	}

	/** Everything back in the decks, shuffled. Destroys work, so it asks first. */
	function resetTable() {
		const ok = confirm(
			'Reset the table? Every card goes back into the decks and both are shuffled — hands, inspiration, enemies and all.'
		);
		if (ok) run({ type: 'reset-table' });
	}

	async function run(command: unknown) {
		if (busy) return;
		busy = true;
		clearTimeout(noticeTimer);
		notice = null;
		// One key per intent, reused if we retry: the server treats it as a lock,
		// so regenerating it on a retry would move two cards for one click.
		const key = newRequestKey();
		const reply = await sendCommand(data.token, command, version, key);
		if (reply.ok && reply.view) {
			version = reply.view.version;
			table = reply.view.state as ProjectedTable;
			if (reply.view.seats) seats = reply.view.seats;
			remember(reply.view.events);
		} else if (reply.reason === 'conflict') {
			// Ordinary, and with open reach the *likely* outcome: two people
			// reached for the same card and one of them got there first. Catch up
			// and let them look, rather than telling them off for it. Asking from
			// our own version rather than zero keeps the event tail the recent
			// end of the log instead of the oldest fifty.
			const fresh = await fetchSince(data.token, version);
			if (fresh) {
				version = fresh.version;
				table = fresh.state as ProjectedTable;
				if (fresh.seats) seats = fresh.seats;
				remember(fresh.events);
			}
			say('Someone got there first. This is the table as it stands now.', true);
		} else {
			say('This table is no longer taking cards.', false);
		}
		busy = false;
	}
</script>

<svelte:head><title>{data.name} — card table</title></svelte:head>

<div class="ct ct-page">
	<header class="ct-page__head">
		<h1>{data.name}</h1>
		{#if mySeat === null}
			<p class="ct-page__watching">You are watching.</p>
		{/if}
	</header>

	{#if mySeat === null}
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

	{#if mySeat && admitted && table.gmSeat === null}
		<form method="POST" action="?/claimGm" use:enhance class="claim">
			<p>Nobody is running this table.</p>
			<button type="submit">Take the GM's chair</button>
		</form>
	{/if}

	<p class="notice" class:notice--on={notice !== null} aria-live="polite">
		{notice?.text ?? ''}
	</p>

	<!--
		What just happened, for somebody who cannot see it happen. Polite, so it
		waits for a gap rather than cutting across whatever is being read, and
		off-screen because everyone else can see the table itself.
	-->
	<p class="sr-only" aria-live="polite" aria-atomic="true">{said}</p>

	{#if admitted}
		<div class="modes">
			{#if isGm}
				<!-- Switching is the GM's: leaving a Challenge sweeps every hand on
				     the table, which is not something one player does to everyone. -->
				<button type="button" class:on={table.mode === 'decks'} onclick={leaveChallenge}>
					Decks
				</button>
				<button
					type="button"
					class:on={table.mode === 'challenge'}
					onclick={() => run({ type: 'set-mode', mode: 'challenge' })}>Challenge</button
				>
			{:else}
				<span class="modes__state">{table.mode === 'challenge' ? 'Challenge' : 'Decks'}</span>
			{/if}
			<!-- The undo this table has: pick the card up and put it back. Anybody
			     may, which is why nothing here refuses a misplay in the first
			     place. It hides itself when the last move touched a hand that is
			     not yours, since that is the one place reach stops. -->
			{#if reversal}
				<button
					type="button"
					class="modes__undo"
					disabled={busy}
					onclick={() => reversal && run(reversal.command)}>{reversal.label}</button
				>
			{/if}
			{#if isGm}
				<!-- Last, and alone on the right: this one throws work away, and it
				     should never sit under a thumb aiming for the undo. -->
				<button type="button" class="modes__reset" onclick={resetTable}>Reset the table</button>
			{/if}
		</div>
	{/if}

	{#if table.mode === 'challenge'}
		<ChallengeMode
			{table}
			{seats}
			{faces}
			challengePack={data.pack['data/challenge.json'] as never}
			waiting={seats.filter((s) => s.status === 'pending')}
			{mySeatId}
			canAct={admitted}
			{busy}
			onCommand={run}
		/>
	{:else}
		<DecksMode {table} {seats} {faces} {mySeatId} canAct={admitted} {busy} onCommand={run} />
	{/if}
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
		color: inherit;
	}
	.ct-page__watching,
	.waiting {
		color: var(--ct-quiet);
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
		background: transparent;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: inherit;
		font: inherit;
		padding: 0.5rem;
		min-block-size: 2.75rem;
	}
	.join__hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ct-quiet);
	}
	.join__error {
		color: var(--ct-mark);
		margin: 0.5rem 1.25rem;
	}
	/* Always in the layout, so a passing word does not shove the table down a
	   line and back up again — the surest way to make somebody misclick. */
	.notice {
		margin: 0.5rem 1.25rem;
		min-block-size: 1.25rem;
		font-size: 0.85rem;
		color: var(--ct-quiet);
		opacity: 0;
		transition: opacity 200ms ease;
	}
	.notice--on {
		opacity: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.notice {
			transition: none;
		}
	}
	.join button,
	.claim button {
		justify-self: start;
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-mark);
		font: inherit;
		padding: 0.5rem 1rem;
		min-block-size: 2.75rem;
		cursor: pointer;
	}
	.waiting {
		margin: 1rem 1.25rem;
	}
	.modes {
		display: flex;
		gap: 0.4rem;
		padding: 0 1.25rem;
		/* 1.4.10: without this the reset button's `margin-inline-start: auto`
		   pushed the row 23px past a 320px viewport, which is a horizontal
		   scrollbar on the narrowest phone the criterion asks about. */
		flex-wrap: wrap;
	}
	.modes button {
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		/* Was a bone-coloured literal left over from the rejected palette, which
		   on the light table came out at 1.36:1 — very nearly invisible, and the
		   clearest sign that this rule had never been looked at in both rooms. */
		color: var(--ct-quiet);
		font: inherit;
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		padding: 0.35rem 0.9rem;
		min-block-size: 2.75rem;
		cursor: pointer;
	}
	.modes button.on {
		border-color: var(--ct-mark);
		color: var(--ct-mark);
	}
	.modes__reset {
		margin-inline-start: auto;
	}
	.modes button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.modes__state {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		color: var(--ct-quiet);
		align-self: center;
	}
</style>
