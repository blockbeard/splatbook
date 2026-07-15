<!--
	Thrall (commit 104), the third narratively-gained undead insert. Unlike
	Ghost/Revenant, its granted moves include a tracked resource (Favor,
	0-3) — tracked directly on this insert's thrall, since insert-granted
	moves never enter `character.moves` and so never reach the playbook
	move-tracker sync.
-->
<script lang="ts">
	import type { ThrallInsert } from '../pack-schemas';
	import {
		setThrallFavor,
		thrallStateOf,
		toggleThrallMark,
		updateThrall,
		type StonetopCharacter
	} from '../engine';
	import { fetchThrallInsert } from '../pack/inserts';
	import Markdown from '../wizard/components/Markdown.svelte';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<ThrallInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchThrallInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const thrall = $derived(thrallStateOf(character));
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load Thrall: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-6">
		<div>
			<h2 class="text-lg font-semibold">Thrall</h2>
			<p class="mt-1 text-sm text-muted"><Markdown text={insert.gainedWhen} /></p>
		</div>

		<label class="block text-sm font-medium">
			{insert.master.prompt}
			<input
				type="text"
				value={thrall.masterName}
				oninput={(e) => onChange(updateThrall(character, { masterName: e.currentTarget.value }))}
				class="mt-1 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
		</label>

		<div>
			<div class="text-sm font-medium">Impulse</div>
			<p class="mt-1 text-xs text-muted">{insert.impulse.text}</p>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each insert.impulse.options as option (option)}
					<button
						type="button"
						onclick={() => onChange(updateThrall(character, { impulse: option }))}
						aria-pressed={thrall.impulse === option}
						class="rounded-md border px-2 py-1 text-xs {thrall.impulse === option
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{option}
					</button>
				{/each}
			</div>
			<input
				type="text"
				value={thrall.impulse}
				placeholder="Write your own…"
				oninput={(e) => onChange(updateThrall(character, { impulse: e.currentTarget.value }))}
				class="mt-2 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
		</div>

		<fieldset>
			<legend class="text-sm font-medium">Instinct</legend>
			<p class="mt-1 text-xs text-muted">{insert.instincts.text}</p>
			<div class="mt-2 space-y-2">
				{#each insert.instincts.options as option (option.id)}
					{@const on = thrall.instinctId === option.id}
					<button
						type="button"
						onclick={() => onChange(updateThrall(character, { instinctId: option.id }))}
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

		<div>
			<div class="flex items-baseline justify-between">
				<div class="text-sm font-medium">Favor</div>
				<span class="font-mono text-sm text-muted">{thrall.favor} / 3</span>
			</div>
			<div class="mt-1 flex gap-1" role="group" aria-label="Favor">
				{#each Array(3) as _, i (i)}
					<button
						type="button"
						onclick={() => onChange(setThrallFavor(character, thrall.favor === i + 1 ? i : i + 1))}
						aria-pressed={i < thrall.favor}
						aria-label={`Favor: ${i + 1}`}
						class="h-6 w-6 rounded-sm border border-border transition-colors {i < thrall.favor
							? 'bg-accent'
							: 'bg-surface hover:bg-border'}"
					></button>
				{/each}
			</div>
		</div>

		<section>
			<h3 class="text-sm font-medium">Marks</h3>
			<p class="mt-1 text-xs text-muted">{insert.marks.text}</p>
			<div class="mt-2 space-y-2">
				{#each insert.marks.list as mark (mark.id)}
					{@const on = thrall.marks.includes(mark.id)}
					<button
						type="button"
						onclick={() => onChange(toggleThrallMark(character, mark.id))}
						aria-pressed={on}
						class="w-full rounded-md border px-3 py-2 text-left text-sm {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-medium">{mark.name}.</span>
						<Markdown text={mark.text} inline />
					</button>
				{/each}
			</div>
		</section>
	</div>
{/if}
