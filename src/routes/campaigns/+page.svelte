<!--
	Campaigns — the signed-in user's tables, with a form to start a new one.
	Creating seats you as GM and redirects to the campaign page (where the invite
	link lives). The party-at-a-glance view is enriched in commit 61.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { signIn } from '@auth/sveltekit/client';

	let { data, form } = $props();

	const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	const when = (iso: string) => dateFmt.format(new Date(iso));

	const href = (id: string) => resolve('/campaigns/[id]', { id });

	// One game today, so the picker collapses to a single hidden field.
	const soleGame = $derived(data.games.length === 1 ? data.games[0] : null);
</script>

<svelte:head>
	<title>Campaigns — Splatbook</title>
</svelte:head>

<h1 class="mb-6 text-2xl font-semibold tracking-tight">Campaigns</h1>

{#if !data.signedIn}
	<p class="text-muted">
		<button type="button" class="text-accent hover:underline" onclick={() => signIn()}>
			Sign in
		</button>
		to start or join a campaign.
	</p>
{:else}
	{#if data.campaigns.length === 0}
		<p class="text-muted">You’re not in any campaigns yet. Start one below.</p>
	{:else}
		<ul class="divide-y divide-border rounded-md border border-border">
			{#each data.campaigns as c (c.id)}
				<li class="flex items-center justify-between gap-4 px-4 py-3">
					<a href={href(c.id)} class="min-w-0 hover:text-accent">
						<span class="font-medium">{c.name}</span>
						<span class="ml-2 text-xs text-muted">{c.gameName}</span>
					</a>
					<div class="flex items-center gap-3 text-xs text-muted">
						<span
							class="rounded border border-border px-1.5 py-0.5 uppercase tracking-wide"
							class:text-accent={c.role === 'gm'}
						>
							{c.role}
						</span>
						<span>Updated {when(c.updatedAt)}</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.games.length > 0}
		<form method="POST" action="?/create" use:enhance class="mt-8 max-w-md">
			<h2 class="text-lg font-semibold">Start a campaign</h2>
			<label class="mt-3 block text-sm">
				<span class="text-muted">Name</span>
				<input
					name="name"
					type="text"
					required
					placeholder="Ringwall"
					class="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
				/>
			</label>

			{#if soleGame}
				<input type="hidden" name="gameId" value={soleGame.id} />
			{:else}
				<label class="mt-3 block text-sm">
					<span class="text-muted">Game</span>
					<select
						name="gameId"
						class="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
					>
						{#each data.games as g (g.id)}
							<option value={g.id}>{g.name}</option>
						{/each}
					</select>
				</label>
			{/if}

			{#if form?.create?.error}
				<p class="mt-2 text-sm text-red-500">{form.create.error}</p>
			{/if}

			<button
				type="submit"
				class="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20"
			>
				Create campaign
			</button>
		</form>
	{/if}
{/if}
