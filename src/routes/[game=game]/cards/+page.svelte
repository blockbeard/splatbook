<!--
	Your card tables.

	The only page in this feature that needs an account, and the reason it does
	is worth being plain about on the page itself: starting a table is the one
	action somebody could otherwise do without limit.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	let { data, form } = $props();

	const when = (ms: number) =>
		new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(ms));
</script>

<svelte:head><title>Card tables — {data.gameName}</title></svelte:head>

<h1>Card tables</h1>

{#if !data.signedIn}
	<p>
		Sign in to start a table. Playing at one needs no account — you share the link and people pick a
		seat.
	</p>
	<p><a href={resolve('/auth/signin')}>Sign in</a></p>
{:else}
	<form method="POST" action="?/create" use:enhance class="new">
		<h2>Start a table</h2>
		<label for="table-name">What is this table called?</label>
		<!-- No ghost text in the field. "Thursday game" sitting in an empty input
		     reads as a table that already exists rather than as a prompt to type,
		     which is exactly how it was misread. The example goes beside the
		     label, where it is plainly an example. -->
		<input id="table-name" name="name" required autocomplete="off" />
		<p class="new__hint">Whatever you call it between yourselves — “Thursday game” does fine.</p>
		<button type="submit">Start the table</button>
		{#if form?.message}<p class="error">{form.message}</p>{/if}
	</form>

	{#if data.tables.length === 0}
		<p>No tables yet. Start one, then send the link to your players.</p>
	{:else}
		<ul class="tables">
			{#each data.tables as table (table.id)}
				<li>
					<a
						href={resolve('/[game=game]/cards/[token]', { game: data.gameId, token: table.token })}
					>
						{table.name}
					</a>
					<span class="tables__when">last played {when(table.lastActiveAt)}</span>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={table.id} />
						<button type="submit" class="quiet">Delete</button>
					</form>
				</li>
			{/each}
		</ul>
		<p class="note">
			A table is kept for six weeks after it was last played, then deleted. Deleting one here
			removes it and every seat at it straight away.
		</p>
	{/if}
{/if}

<style>
	.new {
		display: grid;
		gap: 0.4rem;
		justify-items: start;
		max-inline-size: 26rem;
		margin-block: 1rem 1.5rem;
	}
	.new h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.new input {
		inline-size: 100%;
		padding: 0.5rem;
		min-block-size: 2.75rem;
	}
	.new__hint {
		margin: 0;
		color: var(--sb-muted);
		font-size: 0.85rem;
	}
	.tables {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.tables li {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.tables__when,
	.note {
		color: var(--sb-muted);
		font-size: 0.9rem;
	}
	.quiet {
		background: none;
		border: 0;
		color: var(--sb-muted);
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
	}
	.error {
		color: var(--sb-danger);
	}
</style>
