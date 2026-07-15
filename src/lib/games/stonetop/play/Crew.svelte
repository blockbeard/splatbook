<!--
	Crew (commit 103), the Marshal's class insert — a single group-follower
	(contrast Followers, commit 102, which is a roster). Base HP/armor/damage
	and the equipment table are fixed pack content, printed for reference;
	tags/instinct/cost/gear write-ins and the "individuals" who stand out are
	the parts that vary per character.
-->
<script lang="ts">
	import type { CrewInsert } from '../pack-schemas';
	import {
		addCrewIndividual,
		crewOf,
		removeCrewIndividual,
		setCrewGearLine,
		setCrewLoyalty,
		setCrewTagWriteIn,
		toggleCrewSpecialTag,
		toggleCrewTag,
		updateCrew,
		updateCrewIndividual,
		type StonetopCharacter
	} from '../engine';
	import { fetchCrewInsert } from '../pack/inserts';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<CrewInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchCrewInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const state = $derived(crewOf(character));
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load Crew: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-6">
		<div>
			<h2 class="text-lg font-semibold">Crew</h2>
			<p class="mt-1 text-xs text-muted">
				{insert.base.hp} · {insert.base.armor} armor · {insert.base.damage} damage
			</p>
		</div>

		<fieldset>
			<legend class="text-sm font-medium">
				Tags <span class="font-normal text-muted"
					>({insert.tags.fixed.join(', ')} + {insert.tags.choose} more)</span
				>
			</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each insert.tags.options as tag (tag)}
					{@const on = state.tags.includes(tag)}
					<button
						type="button"
						onclick={() => onChange(toggleCrewTag(character, tag))}
						disabled={!on && state.tags.length >= insert.tags.choose}
						aria-pressed={on}
						class="rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{tag}
					</button>
				{/each}
				{#each insert.tags.special as special (special.name)}
					{@const on = state.specialTags.includes(special.name)}
					<button
						type="button"
						onclick={() => onChange(toggleCrewSpecialTag(character, special.name))}
						aria-pressed={on}
						class="rounded-md border px-2 py-1 text-xs italic disabled:cursor-not-allowed disabled:opacity-40 {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{special.name}
					</button>
				{/each}
			</div>
			{#if state.tagsWriteIn.length}
				<div class="mt-2 flex flex-wrap gap-2">
					{#each state.tagsWriteIn as line, index (index)}
						<input
							type="text"
							value={line}
							placeholder="Write in…"
							oninput={(e) => onChange(setCrewTagWriteIn(character, index, e.currentTarget.value))}
							class="w-32 rounded border border-border bg-transparent px-2 py-1 text-xs focus:border-accent focus:ring-0 focus:outline-none"
						/>
					{/each}
				</div>
			{/if}
		</fieldset>

		<fieldset>
			<legend class="text-sm font-medium">Instinct</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each insert.instincts.options as option (option)}
					<button
						type="button"
						onclick={() => onChange(updateCrew(character, { instinct: option }))}
						aria-pressed={state.instinct === option}
						class="rounded-md border px-2 py-1 text-xs {state.instinct === option
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{option}
					</button>
				{/each}
			</div>
			<input
				type="text"
				value={state.instinct}
				placeholder="Write your own…"
				oninput={(e) => onChange(updateCrew(character, { instinct: e.currentTarget.value }))}
				class="mt-2 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
		</fieldset>

		<fieldset>
			<legend class="text-sm font-medium">Cost</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each insert.cost.options as option (option)}
					<button
						type="button"
						onclick={() => onChange(updateCrew(character, { cost: option }))}
						aria-pressed={state.cost === option}
						class="rounded-md border px-2 py-1 text-xs {state.cost === option
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{option}
					</button>
				{/each}
			</div>
			<input
				type="text"
				value={state.cost}
				placeholder="Write your own…"
				oninput={(e) => onChange(updateCrew(character, { cost: e.currentTarget.value }))}
				class="mt-2 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
			<div class="mt-2">
				<div class="text-xs font-medium text-muted">Loyalty</div>
				<div class="mt-1 flex gap-1" role="group" aria-label="Loyalty">
					{#each Array(insert.cost.loyaltyMax) as _, i (i)}
						<button
							type="button"
							onclick={() =>
								onChange(
									setCrewLoyalty(
										character,
										state.loyalty === i + 1 ? i : i + 1,
										insert!.cost.loyaltyMax
									)
								)}
							aria-pressed={i < state.loyalty}
							aria-label={`Loyalty: ${i + 1}`}
							class="h-5 w-5 rounded-sm border border-border transition-colors {i < state.loyalty
								? 'bg-accent'
								: 'bg-surface hover:bg-border'}"
						></button>
					{/each}
				</div>
			</div>
		</fieldset>

		<fieldset>
			<legend class="text-sm font-medium">Gear</legend>
			<ul class="mt-2 space-y-1 text-xs text-muted">
				{#each insert.inventory.gear as item (item.name)}
					<li>{item.name} ({item.slots} slot{item.slots === 1 ? '' : 's'})</li>
				{/each}
			</ul>
			<div class="mt-2 space-y-1">
				{#each state.gear as line, index (index)}
					<input
						type="text"
						value={line}
						placeholder="Write in…"
						oninput={(e) => onChange(setCrewGearLine(character, index, e.currentTarget.value))}
						class="w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<div class="flex items-baseline justify-between">
				<legend class="text-sm font-medium">Individuals</legend>
				<button
					type="button"
					onclick={() => onChange(addCrewIndividual(character, insert!))}
					disabled={state.individuals.length >= insert.individuals.portraitBoxes}
					class="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
				>
					+ Individual
				</button>
			</div>
			<div class="mt-2 space-y-2">
				{#each state.individuals as individual, index (index)}
					<div class="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
						<input
							type="text"
							value={individual.name}
							placeholder="Name"
							oninput={(e) =>
								onChange(updateCrewIndividual(character, index, { name: e.currentTarget.value }))}
							class="w-28 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
						<input
							type="text"
							value={individual.tag}
							placeholder="Tag"
							oninput={(e) =>
								onChange(updateCrewIndividual(character, index, { tag: e.currentTarget.value }))}
							class="w-24 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
						<input
							type="text"
							value={individual.traits}
							placeholder="Traits"
							oninput={(e) =>
								onChange(updateCrewIndividual(character, index, { traits: e.currentTarget.value }))}
							class="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => onChange(removeCrewIndividual(character, index))}
							class="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted hover:text-danger"
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		</fieldset>

		<label class="block text-xs text-muted">
			Notes
			<textarea
				value={state.notes}
				oninput={(e) => onChange(updateCrew(character, { notes: e.currentTarget.value }))}
				rows="2"
				class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			></textarea>
		</label>
	</div>
{/if}
