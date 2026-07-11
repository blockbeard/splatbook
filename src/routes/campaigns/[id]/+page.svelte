<!--
	Campaign page. Everyone seated sees the campaign; the GM also sees the invite
	link (a copyable, absolute URL built from the current origin) and can rotate
	it to revoke outstanding invites. Party roster + steading arrive in later
	commits.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data, form } = $props();

	// The action can hand back a fresh invite path; fall back to the loaded one.
	const invitePath = $derived(form?.rotated?.path ?? data.invite?.path ?? null);
	const inviteUrl = $derived(invitePath ? new URL(invitePath, page.url.origin).href : null);

	let copied = $state(false);
	async function copy() {
		if (!inviteUrl) return;
		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head>
	<title>{data.campaign.name} — Splatbook</title>
</svelte:head>

<div class="mb-6 flex items-baseline justify-between gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{data.campaign.name}</h1>
	<span class="text-xs text-muted uppercase" class:text-accent={data.isGm}>
		{data.role} · {data.campaign.gameName}
	</span>
</div>

{#if data.isGm && inviteUrl}
	<section class="rounded-md border border-border bg-surface p-4">
		<h2 class="text-sm font-semibold">Invite players</h2>
		<p class="mt-1 text-xs text-muted">
			Share this link. Anyone signed in who opens it joins as a player.
		</p>
		<div class="mt-3 flex gap-2">
			<input
				readonly
				value={inviteUrl}
				aria-label="Invite link"
				class="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs outline-none"
			/>
			<button
				type="button"
				onclick={copy}
				class="shrink-0 rounded-md border border-border px-3 py-2 text-sm hover:text-accent"
			>
				{copied ? 'Copied' : 'Copy'}
			</button>
		</div>

		<form method="POST" action="?/rotate" use:enhance class="mt-3">
			<button
				type="submit"
				class="text-xs text-muted hover:text-red-500 hover:underline"
				title="Invalidates the current link and issues a new one"
			>
				Rotate invite link
			</button>
		</form>
	</section>
{/if}

<section class="mt-6">
	<h2 class="text-sm font-semibold">Your characters</h2>
	{#if data.myCharacters.length === 0}
		<p class="mt-1 text-xs text-muted">
			You have no {data.campaign.gameName} characters yet. Build one, then attach it here.
		</p>
	{:else}
		<ul class="mt-2 divide-y divide-border rounded-md border border-border">
			{#each data.myCharacters as c (c.id)}
				<li class="flex items-center justify-between gap-4 px-4 py-2.5">
					<span class="min-w-0 truncate">{c.name || 'Unnamed character'}</span>
					{#if c.attachedHere}
						<form method="POST" action="?/detach" use:enhance>
							<input type="hidden" name="entityId" value={c.id} />
							<button type="submit" class="text-xs text-accent hover:underline">
								Attached · remove
							</button>
						</form>
					{:else}
						<form method="POST" action="?/attach" use:enhance>
							<input type="hidden" name="entityId" value={c.id} />
							<button
								type="submit"
								class="text-xs text-muted hover:text-accent hover:underline"
								title={c.attachedElsewhere
									? 'This will move the character from its current campaign'
									: undefined}
							>
								{c.attachedElsewhere ? 'Move here' : 'Attach'}
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
