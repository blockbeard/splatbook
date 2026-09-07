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
	<!--
		One heading, one field, one button. The first version stacked a heading, a
		question, a hint and a button in four near-identical lines of the same
		serif, and reading it top to bottom told you almost nothing about which
		one you were supposed to act on.

		The field carries a plainly-grey "Table name" — a generic word for the
		thing, not an example of one. "Thursday game" in the box read as a table
		that already existed, which is a different failure from having no
		placeholder at all.
	-->
	<section class="new">
		<h2>Start a table</h2>
		<form method="POST" action="?/create" use:enhance>
			<label class="sr-only" for="table-name">Table name</label>
			<input id="table-name" name="name" placeholder="Table name" required autocomplete="off" />
			<button type="submit">Start</button>
		</form>
		{#if form?.message}<p class="error">{form.message}</p>{/if}
	</section>

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
		max-inline-size: 30rem;
		margin-block: 1.25rem 2rem;
	}
	.new h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	.new form {
		display: flex;
		gap: 0.5rem;
	}
	.new input {
		flex: 1;
		padding: 0.55rem 0.7rem;
		min-block-size: 2.75rem;
		border: 1px solid var(--sb-border);
		border-radius: 4px;
		background: var(--sb-surface);
		color: var(--sb-text);
		font: inherit;
	}
	.new input::placeholder {
		color: var(--sb-muted);
		opacity: 1;
	}
	.new button {
		padding: 0 1.1rem;
		min-block-size: 2.75rem;
		border: 1px solid var(--sb-text);
		border-radius: 4px;
		background: var(--sb-accent);
		color: var(--sb-accent-contrast);
		font: inherit;
		cursor: pointer;
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
