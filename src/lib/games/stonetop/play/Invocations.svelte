<!--
	Invocations (commit 103), the Lightbearer's class insert. A known/unknown
	checklist plus, for the *ongoing* ones, which single Invocation (if any) is
	currently active — the book's "while one Invocation is ongoing, you can't
	use another" only bites on those; instant ones just resolve.
-->
<script lang="ts">
	import type { InvocationsInsert } from '../pack-schemas';
	import {
		activeInvocation,
		knownInvocations,
		toggleActiveInvocation,
		toggleKnownInvocation,
		type StonetopCharacter
	} from '../engine';
	import { fetchInvocationsInsert } from '../pack/inserts';
	import Markdown from '../wizard/components/Markdown.svelte';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<InvocationsInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchInvocationsInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const known = $derived(knownInvocations(character));
	const active = $derived(activeInvocation(character));
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load Invocations: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-4">
		<div class="flex items-baseline justify-between">
			<h2 class="text-lg font-semibold">Invocations</h2>
			<span class="text-sm text-muted">{known.length} known</span>
		</div>

		<p class="text-sm text-muted">
			Start knowing {insert.startKnowing}; learn one more {insert.learnAt}.
		</p>

		<div class="space-y-2">
			{#each insert.invocations as inv (inv.id)}
				{@const isKnown = known.includes(inv.id)}
				{@const isActive = active === inv.id}
				<div
					class="rounded-lg border p-3 {isActive
						? 'border-accent bg-accent/5 ring-1 ring-accent'
						: 'border-border'}"
				>
					<div class="flex items-start justify-between gap-3">
						<label class="flex items-start gap-2 text-sm font-medium">
							<input
								type="checkbox"
								checked={isKnown}
								onchange={() => onChange(toggleKnownInvocation(character, inv.id))}
								class="mt-0.5 accent-accent"
							/>
							{inv.name}
						</label>
						{#if inv.ongoing}
							<button
								type="button"
								onclick={() => onChange(toggleActiveInvocation(character, inv.id))}
								disabled={!isKnown}
								aria-pressed={isActive}
								class="shrink-0 rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 {isActive
									? 'border-accent bg-accent text-white'
									: 'border-border hover:border-accent'}"
							>
								{isActive ? 'Ongoing' : 'Invoke'}
							</button>
						{/if}
					</div>
					{#if isKnown}
						<div class="mt-2 space-y-1 text-sm text-muted">
							<Markdown text={inv.text} />
							<p><span class="font-medium">Reduced:</span> {inv.reduced}</p>
							<p><span class="font-medium">Empowered:</span> {inv.empowered}</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
