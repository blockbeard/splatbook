<!--
	Header sign-in / sign-out control. Reads the session from page data (provided
	by the root +layout.server.ts) and uses the @auth/sveltekit client helpers.
	With only dev-login enabled, `signIn()` opens a one-button sign-in page.
-->
<script lang="ts">
	import { signIn, signOut } from '@auth/sveltekit/client';
	import { page } from '$app/state';

	const user = $derived(page.data.session?.user);
</script>

{#if user}
	<span class="hidden text-muted sm:inline" title={user.email ?? undefined}>
		{user.name ?? user.email}
	</span>
	<button
		type="button"
		onclick={() => signOut()}
		class="rounded border border-border bg-surface px-2 py-1 text-sm text-muted hover:text-text"
	>
		Sign out
	</button>
{:else}
	<button
		type="button"
		onclick={() => signIn()}
		class="rounded border border-border bg-surface px-2 py-1 text-sm text-muted hover:text-text"
	>
		Sign in
	</button>
{/if}
