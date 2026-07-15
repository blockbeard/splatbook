<!--
	Initiates of Danu (commit 103), the Blessed's class insert. Unlike
	Followers' blank roster, this catalogue is fixed book content (five named
	NPCs) — the player picks `pick.min`-`pick.max` of them and answers each
	one's flavor prompts; HP and Loyalty track from there like any follower.
-->
<script lang="ts">
	import type { InitiatesOfDanuInsert } from '../pack-schemas';
	import {
		initiatePicksOf,
		pickInitiate,
		setInitiateChoice,
		setInitiateHp,
		setInitiateLoyalty,
		unpickInitiate,
		type StonetopCharacter
	} from '../engine';
	import { fetchInitiatesOfDanuInsert } from '../pack/inserts';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<InitiatesOfDanuInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchInitiatesOfDanuInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const picks = $derived(initiatePicksOf(character));
	const pickedCount = $derived(Object.keys(picks).length);
</script>

{#snippet loyaltyBoxes(initiateId: string, filled: number, max: number)}
	<div class="flex gap-1" role="group" aria-label="Loyalty">
		{#each Array(max) as _, i (i)}
			<button
				type="button"
				onclick={() =>
					onChange(setInitiateLoyalty(character, initiateId, filled === i + 1 ? i : i + 1, max))}
				aria-pressed={i < filled}
				aria-label={`Loyalty: ${i + 1}`}
				class="h-5 w-5 rounded-sm border border-border transition-colors {i < filled
					? 'bg-accent'
					: 'bg-surface hover:bg-border'}"
			></button>
		{/each}
	</div>
{/snippet}

{#if loadError}
	<p class="text-muted">Couldn’t load Initiates of Danu: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-4">
		<div class="flex items-baseline justify-between">
			<h2 class="text-lg font-semibold">Initiates of Danu</h2>
			<span class="text-sm text-muted">
				{pickedCount}/{insert.pick.min}–{insert.pick.max} picked
			</span>
		</div>

		{#each insert.initiates as initiate (initiate.id)}
			{@const pick = picks[initiate.id]}
			<div class="space-y-3 rounded-lg border border-border p-4">
				<div class="flex items-start justify-between gap-2">
					<div>
						<div class="font-semibold">{initiate.name}</div>
						<div class="text-xs text-muted">{initiate.tags.join(', ')}</div>
					</div>
					<button
						type="button"
						onclick={() =>
							onChange(
								pick ? unpickInitiate(character, initiate.id) : pickInitiate(character, initiate)
							)}
						aria-pressed={!!pick}
						class="shrink-0 rounded-md border px-2 py-1 text-sm {pick
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{pick ? 'Picked' : 'Pick'}
					</button>
				</div>

				<p class="text-xs text-muted">
					{initiate.damage} · instinct {initiate.instinct} · cost: {initiate.cost}
				</p>
				<p class="text-xs text-muted">Moves: {initiate.moves.join(' · ')}</p>

				{#if pick}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
						<label class="text-xs text-muted">
							HP
							<input
								type="number"
								value={pick.hp}
								oninput={(e) =>
									onChange(setInitiateHp(character, initiate.id, Number(e.currentTarget.value)))}
								class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
							/>
						</label>
						<div class="col-span-2 sm:col-span-3">
							<div class="text-xs text-muted">Loyalty</div>
							<div class="mt-1">
								{@render loyaltyBoxes(initiate.id, pick.loyalty, initiate.loyaltyMax)}
							</div>
						</div>
					</div>

					{#if initiate.choices?.length}
						<div class="space-y-2">
							{#each initiate.choices as choice (choice.prompt)}
								<div>
									<div class="text-xs font-medium text-muted">{choice.prompt}</div>
									<div class="mt-1 flex flex-wrap gap-2">
										{#each choice.options as option (option)}
											{@const on = pick.choices[choice.prompt] === option}
											<button
												type="button"
												onclick={() =>
													onChange(
														setInitiateChoice(character, initiate.id, choice.prompt, option)
													)}
												aria-pressed={on}
												class="rounded-md border px-2 py-1 text-xs {on
													? 'border-accent bg-accent/5 ring-1 ring-accent'
													: 'border-border hover:border-accent'}"
											>
												{option}
											</button>
										{/each}
										{#if choice.writeIn}
											<input
												type="text"
												placeholder="Write in…"
												value={pick.choices[choice.prompt] ?? ''}
												oninput={(e) =>
													onChange(
														setInitiateChoice(
															character,
															initiate.id,
															choice.prompt,
															e.currentTarget.value
														)
													)}
												class="rounded border border-border bg-transparent px-2 py-1 text-xs focus:border-accent focus:ring-0 focus:outline-none"
											/>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
{/if}
