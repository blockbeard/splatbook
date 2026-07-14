<!--
	Campaign page. Everyone seated sees the party roster (members + attached
	characters) and the campaign steading; each member can attach their own
	characters. The GM additionally sees the invite link (copyable, rotatable) and
	can create the campaign steading.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import RollLog from '$lib/components/RollLog.svelte';

	let { data, form } = $props();

	// The action can hand back a fresh invite path; fall back to the loaded one.
	const invitePath = $derived(form?.rotated?.path ?? data.invite?.path ?? null);
	const inviteUrl = $derived(invitePath ? new URL(invitePath, page.url.origin).href : null);

	const sheetHref = (type: string, id: string) =>
		`${resolve('/[game=game]/[type]/sheet', { game: data.campaign.gameId, type })}?id=${id}`;

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
	<div class="flex items-baseline gap-3">
		{#if data.isGm && data.hasSessionMove}
			<!-- Ending the session marks XP on characters their players own, so it's
			     the GM's button. -->
			<a
				href={resolve('/campaigns/[id]/session', { id: data.campaign.id })}
				class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
			>
				End session
			</a>
		{/if}
		<span class="text-xs text-muted uppercase" class:text-accent={data.isGm}>
			{data.role} · {data.campaign.gameName}
		</span>
	</div>
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
	<h2 class="text-sm font-semibold">Party</h2>
	<ul class="mt-2 divide-y divide-border rounded-md border border-border">
		{#each data.party as member (member.userId)}
			<li class="px-4 py-3">
				<div class="flex items-center justify-between gap-4">
					<span class="font-medium">
						{member.name}
						{#if member.isYou}<span class="text-xs text-muted">(you)</span>{/if}
					</span>
					<span class="text-xs text-muted uppercase" class:text-accent={member.role === 'gm'}>
						{member.role}
					</span>
				</div>
				{#if member.characters.length > 0}
					<ul class="mt-1 ml-1 text-sm">
						{#each member.characters as char (char.id)}
							<li class="text-muted">
								{#if char.mine}
									<a href={sheetHref('character', char.id)} class="hover:text-accent">{char.name}</a
									>
								{:else}
									{char.name}
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-1 ml-1 text-xs text-muted italic">No character attached yet.</p>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<RollLog campaignId={data.campaign.id} initial={data.rolls} />

<section class="mt-6">
	<h2 class="text-sm font-semibold">Campaign steading</h2>
	{#if data.steading}
		<p class="mt-2 text-sm">
			<a
				href={resolve('/campaigns/[id]/steading', { id: data.campaign.id })}
				class="hover:text-accent"
			>
				{data.steading.name}
			</a>
		</p>
	{:else if data.isGm}
		<p class="mt-1 text-xs text-muted">No steading yet. Create one the whole party can see.</p>
		<form method="POST" action="?/createSteading" use:enhance class="mt-2">
			<button
				type="submit"
				class="rounded-md border border-border px-3 py-1.5 text-sm hover:text-accent"
			>
				Create campaign steading
			</button>
		</form>
	{:else}
		<p class="mt-1 text-xs text-muted">No steading yet.</p>
	{/if}
</section>

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
