<!--
	Ghost and Revenant (commit 104) share this one component — the pack shape
	is identical (`undeadInsertSchema`), so the insert id and its fetcher come
	in as props rather than duplicating the same markup twice. Not a "+" tab:
	both are narratively gained (dying a particular way), so PlayMode gives
	the player a plain attach button rather than gating on an auto-attach rule.
-->
<script lang="ts">
	import type { GhostInsert } from '../pack-schemas';
	import {
		setTerriblePurpose,
		setUndeadInstinct,
		toggleFinalConsequence,
		toggleUndeadConsequence,
		undeadStateOf,
		type StonetopCharacter
	} from '../engine';
	import Markdown from '../wizard/components/Markdown.svelte';

	let {
		character,
		onChange,
		insertId,
		fetchInsert
	}: {
		character: StonetopCharacter;
		onChange: (next: StonetopCharacter) => void;
		insertId: string;
		fetchInsert: (fetchFn: typeof fetch) => Promise<GhostInsert>;
	} = $props();

	let insert = $state<GhostInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const undead = $derived(undeadStateOf(character, insertId));
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load {insertId}: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-6">
		<div>
			<h2 class="text-lg font-semibold">{insert.name}</h2>
			<p class="mt-1 text-sm text-muted"><Markdown text={insert.gainedWhen} /></p>
		</div>

		<fieldset>
			<legend class="text-sm font-medium">Instinct</legend>
			<p class="mt-1 text-xs text-muted">{insert.instincts.text}</p>
			<div class="mt-2 space-y-2">
				{#each insert.instincts.options as option (option.id)}
					{@const on = undead.instinctId === option.id}
					<button
						type="button"
						onclick={() => onChange(setUndeadInstinct(character, insertId, option.id))}
						aria-pressed={on}
						class="w-full rounded-md border px-3 py-2 text-left text-sm {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-medium">{option.name}.</span>
						{option.text}
					</button>
				{/each}
			</div>
		</fieldset>

		<section>
			<h3 class="text-sm font-medium">Moves</h3>
			<p class="mt-1 text-xs text-muted">{insert.moves.text}</p>
			<div class="mt-2 space-y-2">
				{#each insert.moves.list as move (move.id)}
					<div class="rounded-lg border border-border p-3">
						<div class="font-semibold">{move.name}</div>
						<div class="mt-1 text-sm text-muted"><Markdown text={move.text} /></div>
					</div>
				{/each}
			</div>
		</section>

		<fieldset>
			<legend class="text-sm font-medium">Terrible Purpose</legend>
			<p class="mt-1 text-xs text-muted">{insert.terriblePurpose.prompt}</p>
			<div class="mt-2 space-y-2">
				{#each insert.terriblePurpose.options as option (option.id)}
					{@const on = undead.terriblePurposeId === option.id}
					<button
						type="button"
						onclick={() => onChange(setTerriblePurpose(character, insertId, option.id))}
						aria-pressed={on}
						class="w-full rounded-md border px-3 py-2 text-left text-sm {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-medium">{option.name}.</span>
						<Markdown text={option.text} inline />
					</button>
				{/each}
			</div>
		</fieldset>

		<section>
			<h3 class="text-sm font-medium">Consequences</h3>
			<p class="mt-1 text-xs text-muted">{insert.consequences.text}</p>
			<div class="mt-2 space-y-2">
				{#each insert.consequences.list as entry (entry.id)}
					{@const on = undead.consequences.includes(entry.id)}
					{@const locked =
						!on &&
						!(entry.requires?.consequences ?? []).every((id) => undead.consequences.includes(id))}
					<button
						type="button"
						onclick={() =>
							onChange(toggleUndeadConsequence(character, insertId, insert!, entry.id))}
						disabled={locked}
						aria-pressed={on}
						class="w-full rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-medium">{entry.name}.</span>
						<Markdown text={entry.text} inline />
					</button>
				{/each}
			</div>

			<button
				type="button"
				onclick={() => onChange(toggleFinalConsequence(character, insertId))}
				aria-pressed={undead.finalMarked}
				class="mt-3 w-full rounded-md border px-3 py-2 text-left text-sm {undead.finalMarked
					? 'border-danger bg-danger/10 ring-1 ring-danger'
					: 'border-border hover:border-danger'}"
			>
				<span class="font-medium">{insert.consequences.final.name}.</span>
				{insert.consequences.final.text}
			</button>
		</section>
	</div>
{/if}
