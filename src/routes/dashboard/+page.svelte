<!--
	Dashboard — the signed-in user's saved characters (and, later, steadings),
	grouped by game. Each row opens the saved sheet or offers duplicate / archive
	/ delete, all driven through the /api/entities endpoints with a reload after.
	Navigations here resolve the path then append an `?id=`/`?archived=` query;
	the typed-route lint rule can't see through that, so it's disabled for this
	file and the builder in eslint.config.js.
-->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { signIn } from '@auth/sveltekit/client';
	import { statusLabel } from '$lib/entities/dashboard';

	let { data } = $props();

	let busy = $state<string | null>(null);

	const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	const when = (iso: string) => dateFmt.format(new Date(iso));

	const openHref = (gameId: string, entityType: string, id: string) =>
		`${resolve('/[game=game]/[type]/sheet', { game: gameId, type: entityType })}?id=${id}`;

	async function act(id: string, run: () => Promise<Response>) {
		busy = id;
		try {
			const res = await run();
			if (res.ok) await invalidateAll();
		} finally {
			busy = null;
		}
	}

	const setStatus = (id: string, status: string) =>
		act(id, () =>
			fetch(`/api/entities/${id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status })
			})
		);

	const duplicate = (id: string) =>
		act(id, () => fetch(`/api/entities/${id}/duplicate`, { method: 'POST' }));

	async function remove(id: string, name: string) {
		if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
		await act(id, () => fetch(`/api/entities/${id}`, { method: 'DELETE' }));
	}
</script>

<svelte:head>
	<title>Your sheets — Splatbook</title>
</svelte:head>

<div class="mb-6 flex items-baseline justify-between gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">Your sheets</h1>
	{#if data.signedIn}
		<a
			href={data.showArchived ? resolve('/dashboard') : `${resolve('/dashboard')}?archived=true`}
			class="text-sm text-muted hover:text-text"
		>
			{data.showArchived ? 'Hide archived' : 'Show archived'}
		</a>
	{/if}
</div>

{#if !data.signedIn}
	<p class="text-muted">
		<button type="button" onclick={() => signIn()} class="text-accent hover:underline">
			Sign in
		</button>
		to save your sheets and see them here.
	</p>
{:else if data.groups.length === 0}
	<p class="text-muted">
		Nothing saved yet. Head to a game and build a character or steading — it'll appear here.
	</p>
{:else}
	{#each data.groups as group (group.gameId)}
		<section class="mb-8">
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
				{group.gameName}
			</h2>
			<ul class="divide-y divide-border rounded-md border border-border">
				{#each group.items as item (item.id)}
					<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
						<div class="min-w-0">
							<a
								href={openHref(item.gameId, item.entityType, item.id)}
								class="font-medium hover:text-accent hover:underline"
							>
								{item.name}
							</a>
							<span class="ml-2 text-xs text-muted">
								{item.typeLabel} · {statusLabel(item.status)} · updated {when(item.updatedAt)}
							</span>
						</div>
						<div class="flex shrink-0 items-center gap-2 text-sm">
							<a
								href={openHref(item.gameId, item.entityType, item.id)}
								class="rounded border border-border px-2 py-1 text-muted hover:text-text"
							>
								Open
							</a>
							<button
								type="button"
								disabled={busy === item.id}
								onclick={() => duplicate(item.id)}
								class="rounded border border-border px-2 py-1 text-muted hover:text-text disabled:opacity-40"
							>
								Duplicate
							</button>
							{#if item.status === 'archived'}
								<button
									type="button"
									disabled={busy === item.id}
									onclick={() => setStatus(item.id, 'ready')}
									class="rounded border border-border px-2 py-1 text-muted hover:text-text disabled:opacity-40"
								>
									Unarchive
								</button>
							{:else}
								<button
									type="button"
									disabled={busy === item.id}
									onclick={() => setStatus(item.id, 'archived')}
									class="rounded border border-border px-2 py-1 text-muted hover:text-text disabled:opacity-40"
								>
									Archive
								</button>
							{/if}
							<button
								type="button"
								disabled={busy === item.id}
								onclick={() => remove(item.id, item.name)}
								class="rounded border border-border px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950"
							>
								Delete
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}
