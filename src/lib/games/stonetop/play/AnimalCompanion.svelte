<!--
	Animal Companion (commit 103), the Ranger's class insert. Picking a type
	seeds base HP/armor/damage from the pack; the player then picks up to the
	type's own trait count and can log Beast of Legend advancement picks.
-->
<script lang="ts">
	import type { AnimalCompanionInsert } from '../pack-schemas';
	import {
		addBeastOfLegendPick,
		animalCompanionOf,
		removeBeastOfLegendPick,
		setAnimalCompanionLoyalty,
		setAnimalCompanionType,
		toggleAnimalCompanionTrait,
		updateAnimalCompanion,
		type StonetopCharacter
	} from '../engine';
	import { fetchAnimalCompanionInsert } from '../pack/inserts';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<AnimalCompanionInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchAnimalCompanionInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const companion = $derived(animalCompanionOf(character));
	const type = $derived(insert?.types.find((t) => t.id === companion.typeId) ?? null);
</script>

{#snippet loyaltyBoxes(filled: number, max: number)}
	<div class="flex gap-1" role="group" aria-label="Loyalty">
		{#each Array(max) as _, i (i)}
			<button
				type="button"
				onclick={() =>
					onChange(setAnimalCompanionLoyalty(character, filled === i + 1 ? i : i + 1, max))}
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
	<p class="text-muted">Couldn’t load Animal Companion: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-6">
		<h2 class="text-lg font-semibold">Animal Companion</h2>

		<fieldset>
			<legend class="text-sm font-medium">Type</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each insert.types as t (t.id)}
					<button
						type="button"
						onclick={() => onChange(setAnimalCompanionType(character, insert!, t.id))}
						aria-pressed={companion.typeId === t.id}
						class="rounded-md border px-3 py-1.5 text-sm {companion.typeId === t.id
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{t.name}
					</button>
				{/each}
			</div>
			{#if type}
				<p class="mt-1 text-xs text-muted">e.g. {type.examples.join(', ')}</p>
			{/if}
		</fieldset>

		{#if type}
			<input
				type="text"
				value={companion.name}
				placeholder="Name"
				oninput={(e) => onChange(updateAnimalCompanion(character, { name: e.currentTarget.value }))}
				class="w-full rounded border border-border bg-transparent px-2 py-1 font-semibold focus:border-accent focus:ring-0 focus:outline-none"
			/>

			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<label class="text-xs text-muted">
					HP
					<input
						type="number"
						value={companion.hp ?? ''}
						oninput={(e) =>
							onChange(
								updateAnimalCompanion(character, {
									hp: e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
								})
							)}
						class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>
				<label class="text-xs text-muted">
					Max HP
					<input
						type="number"
						value={companion.maxHp ?? ''}
						oninput={(e) =>
							onChange(
								updateAnimalCompanion(character, {
									maxHp: e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
								})
							)}
						class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>
				<label class="text-xs text-muted">
					Armor
					<input
						type="number"
						value={companion.armor ?? ''}
						oninput={(e) =>
							onChange(
								updateAnimalCompanion(character, {
									armor: e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
								})
							)}
						class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>
				<label class="text-xs text-muted">
					Damage
					<input
						type="text"
						value={companion.damage}
						oninput={(e) =>
							onChange(updateAnimalCompanion(character, { damage: e.currentTarget.value }))}
						class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>
			</div>

			<div>
				<div class="text-xs font-medium text-muted">
					Traits ({companion.traits.length}/{type.pick})
				</div>
				<div class="mt-1 flex flex-wrap gap-2">
					{#each type.options as trait (trait)}
						{@const on = companion.traits.includes(trait)}
						<button
							type="button"
							onclick={() => onChange(toggleAnimalCompanionTrait(character, trait))}
							disabled={!on && companion.traits.length >= type.pick}
							aria-pressed={on}
							class="rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 {on
								? 'border-accent bg-accent/5 ring-1 ring-accent'
								: 'border-border hover:border-accent'}"
						>
							{trait}
						</button>
					{/each}
				</div>
			</div>

			<label class="block text-xs text-muted">
				Instinct
				<input
					type="text"
					value={companion.instinct}
					oninput={(e) =>
						onChange(updateAnimalCompanion(character, { instinct: e.currentTarget.value }))}
					class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
				/>
			</label>

			<label class="block text-xs text-muted">
				Cost
				<input
					type="text"
					value={companion.cost}
					oninput={(e) =>
						onChange(updateAnimalCompanion(character, { cost: e.currentTarget.value }))}
					class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
				/>
			</label>

			<div>
				<div class="text-xs font-medium text-muted">Loyalty</div>
				<div class="mt-1">{@render loyaltyBoxes(companion.loyalty, insert.cost.loyaltyMax)}</div>
			</div>

			<div>
				<div class="flex items-baseline justify-between">
					<div class="text-xs font-medium text-muted">Beast of Legend</div>
					<button
						type="button"
						onclick={() =>
							onChange(addBeastOfLegendPick(character, insert!.beastOfLegend.options[0]))}
						class="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface"
					>
						+ Pick
					</button>
				</div>
				<p class="mt-1 text-xs text-muted">{insert.beastOfLegend.text}</p>
				<div class="mt-1 space-y-1">
					{#each companion.beastOfLegend as pick, index (index)}
						<div class="flex items-center gap-2">
							<select
								value={pick}
								onchange={(e) =>
									onChange(
										updateAnimalCompanion(character, {
											beastOfLegend: companion.beastOfLegend.map((p, i) =>
												i === index ? e.currentTarget.value : p
											)
										})
									)}
								class="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
							>
								{#each insert.beastOfLegend.options as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
							<button
								type="button"
								onclick={() => onChange(removeBeastOfLegendPick(character, index))}
								class="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted hover:text-danger"
							>
								Remove
							</button>
						</div>
					{/each}
				</div>
			</div>

			<label class="block text-xs text-muted">
				Notes
				<textarea
					value={companion.notes}
					oninput={(e) =>
						onChange(updateAnimalCompanion(character, { notes: e.currentTarget.value }))}
					rows="2"
					class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
				></textarea>
			</label>
		{:else}
			<p class="text-sm text-muted">Pick a type to seed your companion's stats.</p>
		{/if}
	</div>
{/if}
