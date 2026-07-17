<!--
	End of session — the generic shell around the game's own ritual. It supplies
	the table, the write-through and the dice; the game's `sessionComponent` asks
	the questions and decides what they're worth. The shell never looks inside an
	entity.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import RollSurface from '$lib/components/RollSurface.svelte';
	import { roll as rollDice, type RollResult } from '$lib/dice';

	let { data } = $props();

	const Session = $derived(getGame(data.campaign.gameId)?.sessionComponent ?? null);
	const backHref = $derived(resolve('/campaigns/[id]', { id: data.campaign.id }));

	interface RollEntry {
		label: string;
		result: RollResult;
		actorName?: string;
		key: number;
	}
	let latest = $state<RollEntry | null>(null);
	let nextKey = 0;

	/** The steading rolls at the change of seasons; it goes to the shared log like
	 * any other roll, fronted by the steading's name. */
	function makeRoll(label: string, notation: string): void {
		const result = rollDice(notation);
		latest = { label, result, actorName: data.steading?.name, key: nextKey++ };

		fetch(`/api/campaigns/${data.campaign.id}/rolls`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ label, result, characterName: data.steading?.name ?? null })
		}).catch(() => {});
	}

	/** Persist an entity the game changed. The server re-checks that this is the
	 * GM's own table before it writes anything. */
	async function save(id: string, entity: object): Promise<void> {
		const body = new FormData();
		body.set('entityId', id);
		body.set('data', JSON.stringify(entity));

		const res = await fetch(`?/save`, { method: 'POST', body });
		if (!res.ok) throw new Error('Save failed');
	}

	/** Write this run into the session ledger (phase 17). Same GM re-check
	 * server-side; the shell assigns the session number and the date. */
	async function record(run: {
		triggers: unknown;
		awards: { entityId: string; name: string; xp: number }[];
		notes: string;
		privateNotes?: string;
	}): Promise<void> {
		const body = new FormData();
		body.set('triggers', JSON.stringify(run.triggers ?? {}));
		body.set('awards', JSON.stringify(run.awards));
		body.set('notes', run.notes);
		body.set('privateNotes', run.privateNotes ?? '');

		const res = await fetch(`?/record`, { method: 'POST', body });
		if (!res.ok) throw new Error('Record failed');
	}
</script>

<svelte:head>
	<title>End of session — {data.campaign.name}</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
	<a
		href={backHref}
		class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
	>
		← {data.campaign.name}
	</a>
</div>

{#if !Session}
	<p class="text-muted">{data.campaign.gameName} has no end-of-session move.</p>
{:else if data.characters.length === 0}
	<p class="text-muted">
		No characters at this table yet — attach one on the
		<a href={backHref} class="text-accent hover:underline">campaign page</a> first.
	</p>
{:else}
	<Session
		characters={data.characters}
		steading={data.steading}
		{save}
		{record}
		roll={makeRoll}
		notesKey={`splatbook:session-notes:${data.campaign.id}`}
	/>
{/if}

<RollSurface entry={latest} logged onDismiss={() => (latest = null)} />
