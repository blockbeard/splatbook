<!--
	Join-by-invite confirmation. Signed in, a single button seats you as a player;
	signed out, it prompts sign-in (which returns here, token intact).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { signIn } from '@auth/sveltekit/client';

	let { data } = $props();
</script>

<svelte:head>
	<title>Join {data.campaign.name} — Splatbook</title>
</svelte:head>

<div class="mx-auto max-w-md rounded-md border border-border bg-surface p-6 text-center">
	<p class="text-sm text-muted">You’ve been invited to join</p>
	<h1 class="mt-1 text-2xl font-semibold tracking-tight">{data.campaign.name}</h1>
	<p class="mt-1 text-xs text-muted">{data.campaign.gameName}</p>

	{#if data.signedIn}
		<form method="POST" action="?/join" use:enhance class="mt-6">
			<button
				type="submit"
				class="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
			>
				Join as player
			</button>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => signIn(undefined, { redirectTo: page.url.pathname })}
			class="mt-6 rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
		>
			Sign in to join
		</button>
	{/if}
</div>
