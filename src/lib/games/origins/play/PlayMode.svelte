<!--
	Play mode: the editable counterpart to the sheet — what a player touches at
	the table rather than while building.

	Deliberately small, because Origins is: hit points, the once-per-Long-Rest
	spell bookkeeping, the purse, an inventory line, and notes. There is no XP
	and no levelling to track, so there is nothing else to edit — advancement in
	this game happens through things the DM hands you, not through a sheet.
-->
<script lang="ts">
	import type { PlayProps } from '$lib/games/types';
	import {
		ABILITIES,
		armorClass,
		canCast,
		castSpell,
		finalScores,
		formatModifier,
		formatMoney,
		hasSkill,
		longRest,
		maxHitPoints,
		migrateCharacter,
		modifier,
		passivePerception,
		savingThrow,
		skillModifier,
		type OriginsCharacter
	} from '../engine';
	import { packContext, type OriginsPack } from '../pack/load';
	import PackGate from '../wizard/PackGate.svelte';

	let { character, onChange, roll }: PlayProps = $props();
	const sheet = $derived(migrateCharacter(character) as OriginsCharacter);

	let newItem = $state('');

	const patch = (next: Partial<OriginsCharacter>): void => onChange({ ...sheet, ...next });

	function adjustHp(delta: number, max: number): void {
		const current = sheet.hitPoints.current ?? max;
		patch({
			hitPoints: {
				...sheet.hitPoints,
				current: Math.max(0, Math.min(max, current + delta))
			}
		});
	}

	function adjustPurse(deltaCp: number): void {
		patch({
			equipment: {
				...sheet.equipment,
				goldCp: Math.max(0, sheet.equipment.goldCp + deltaCp)
			}
		});
	}

	function addItem(): void {
		const name = newItem.trim();
		if (!name) return;
		patch({
			equipment: { ...sheet.equipment, items: [...sheet.equipment.items, { name, quantity: 1 }] }
		});
		newItem = '';
	}

	function removeItem(index: number): void {
		patch({
			equipment: {
				...sheet.equipment,
				items: sheet.equipment.items.filter((_, i) => i !== index)
			}
		});
	}
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const ctx = packContext(pack, sheet.backgroundId, sheet.referenceClassId, sheet.speciesId)}
		{@const scores = finalScores(sheet)}
		{@const max = maxHitPoints(sheet)}
		{@const current = sheet.hitPoints.current ?? max}

		<header class="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
			<h1 class="text-2xl font-bold tracking-tight">{sheet.name || 'Unnamed adventurer'}</h1>
			<button
				type="button"
				onclick={() =>
					onChange({ ...longRest(sheet), hitPoints: { ...sheet.hitPoints, current: max } })}
				class="rounded border border-border px-3 py-1 text-sm hover:border-accent"
			>
				Long Rest
			</button>
		</header>

		<section class="mt-6 grid gap-3 sm:grid-cols-3">
			<div class="rounded-lg border border-border p-4">
				<div class="text-xs uppercase tracking-wide text-muted">Hit points</div>
				<div class="mt-1 flex items-center gap-2">
					<button
						type="button"
						onclick={() => adjustHp(-1, max ?? 0)}
						aria-label="Take 1 damage"
						class="size-8 rounded border border-border hover:border-accent">−</button
					>
					<span class="text-2xl font-bold tabular-nums">{current ?? '—'}</span>
					<span class="text-muted">/ {max ?? '—'}</span>
					<button
						type="button"
						onclick={() => adjustHp(1, max ?? 0)}
						aria-label="Heal 1"
						class="size-8 rounded border border-border hover:border-accent">+</button
					>
				</div>
			</div>
			<div class="rounded-lg border border-border p-4 text-center">
				<div class="text-2xl font-bold">{armorClass(sheet, ctx)}</div>
				<div class="mt-1 text-xs uppercase tracking-wide text-muted">Armor Class</div>
			</div>
			<div class="rounded-lg border border-border p-4 text-center">
				<div class="text-2xl font-bold">{passivePerception(sheet, ctx)}</div>
				<div class="mt-1 text-xs uppercase tracking-wide text-muted">Passive Perception</div>
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-lg font-semibold">Checks and saves</h2>
			<p class="mt-1 text-sm text-muted">Tap to roll a d20.</p>
			<ul class="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
				{#each ABILITIES as ability (ability)}
					{@const score = scores[ability]}
					<li>
						<button
							type="button"
							disabled={!roll}
							onclick={() =>
								roll?.(
									`${ability} save`,
									`1d20${formatModifier(savingThrow(sheet, ability)).replace('−', '-')}`
								)}
							class="w-full rounded-lg border border-border p-3 text-center hover:border-accent disabled:opacity-50"
						>
							<span class="block text-xs uppercase tracking-wide text-muted">{ability}</span>
							<span class="block text-lg font-bold">
								{score === null ? '—' : formatModifier(modifier(score))}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			<ul class="mt-4 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
				{#each pack.reference.skills as skill (skill.id)}
					{@const mod = skillModifier(sheet, skill, ctx)}
					<li>
						<button
							type="button"
							disabled={!roll}
							onclick={() => roll?.(skill.name, `1d20${formatModifier(mod).replace('−', '-')}`)}
							class="w-full rounded px-2 py-1 text-left hover:bg-accent/5 disabled:opacity-50"
							class:font-semibold={hasSkill(sheet, skill, ctx)}
						>
							<span class="tabular-nums">{formatModifier(mod)}</span>
							{skill.name}
						</button>
					</li>
				{/each}
			</ul>
		</section>

		{#if sheet.spells.cantrips.length || sheet.spells.level1.length}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Spells</h2>
				<p class="mt-1 text-sm text-muted">
					Cantrips and rituals are free. Each level 1 spell is one casting per Long Rest.
				</p>
				<ul class="mt-3 space-y-2 text-sm">
					{#each [...sheet.spells.cantrips, ...sheet.spells.level1] as id (id)}
						{@const spell = pack.spells.find((s) => s.id === id)}
						{#if spell}
							{@const available = canCast(sheet, spell)}
							<li class="flex items-center justify-between gap-3 rounded border border-border p-3">
								<span class:opacity-50={!available}>
									<strong>{spell.name}</strong>
									<span class="text-muted">
										— {spell.level === 0 ? 'cantrip' : 'level 1'}, {spell.castingTime}
										{spell.ritual ? ' · ritual' : ''}
									</span>
								</span>
								<button
									type="button"
									disabled={!available}
									onclick={() => onChange(castSpell(sheet, spell))}
									class="shrink-0 rounded border border-border px-3 py-1 hover:border-accent disabled:opacity-40"
								>
									{available ? 'Cast' : 'Spent'}
								</button>
							</li>
						{/if}
					{/each}
				</ul>
			</section>
		{/if}

		<section class="mt-8">
			<h2 class="text-lg font-semibold">Gear and purse</h2>
			<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
				<span>Purse: <strong>{formatMoney(sheet.equipment.goldCp)}</strong></span>
				{#each [{ label: '−1 GP', delta: -100 }, { label: '+1 GP', delta: 100 }, { label: '−1 SP', delta: -10 }, { label: '+1 SP', delta: 10 }] as step (step.label)}
					<button
						type="button"
						onclick={() => adjustPurse(step.delta)}
						class="rounded border border-border px-2 py-1 hover:border-accent">{step.label}</button
					>
				{/each}
			</div>
			<ul class="mt-3 space-y-1 text-sm">
				{#each sheet.equipment.items as item, index (`${item.name}-${index}`)}
					<li class="flex items-center justify-between gap-3">
						<span>{item.name}</span>
						<button
							type="button"
							onclick={() => removeItem(index)}
							aria-label="Remove {item.name}"
							class="text-muted hover:text-danger">×</button
						>
					</li>
				{/each}
			</ul>
			<div class="mt-3 flex gap-2">
				<input
					type="text"
					bind:value={newItem}
					onkeydown={(e) => e.key === 'Enter' && addItem()}
					placeholder="Add an item"
					class="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onclick={addItem}
					class="rounded border border-border px-3 py-2 text-sm hover:border-accent">Add</button
				>
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-lg font-semibold">Notes</h2>
			<textarea
				rows="5"
				value={sheet.details.notes}
				oninput={(e) => patch({ details: { ...sheet.details, notes: e.currentTarget.value } })}
				class="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-sm"></textarea>
		</section>
	{/snippet}
</PackGate>
