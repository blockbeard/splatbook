<!--
	Step 3: ability scores, the background's increases, and the hit die roll.

	The three generation methods each get their own affordance and their own
	validator, so an illegal spread cannot be carried forward — the point-buy
	budget counts down, the standard array hands out each number once, and
	rolling assigns from the pool actually rolled.

	The hit die lives here because the post puts it here ("fill in remaining
	details, such as HP") and because it needs CON, which is decided on this
	screen. Origins ROLLS it rather than taking the maximum, so it is a button,
	not a number.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import {
		ABILITIES,
		INCREASE_SPREADS,
		finalScores,
		formatModifier,
		increasesAreLegal,
		modifier,
		pointCost,
		pointsRemaining,
		rollAbilityPool,
		type AbilityMethod,
		type OriginsCharacter
	} from '../engine';
	import type { Ability } from '../pack-schemas';
	import type { OriginsPack } from '../pack/load';
	import PackGate from './PackGate.svelte';

	let { draft, update }: WizardStepProps<OriginsCharacter> = $props();

	const METHODS: { id: AbilityMethod; label: string; help: string }[] = [
		{ id: 'standard-array', label: 'Standard array', help: 'The same six numbers for everyone.' },
		{ id: 'point-buy', label: 'Point buy', help: 'Spend a budget to build your own spread.' },
		{ id: 'roll', label: 'Roll', help: '4d6, drop the lowest, six times.' }
	];

	function chooseMethod(method: AbilityMethod, pack: OriginsPack): void {
		update({
			abilities: {
				...draft.abilities,
				method,
				base: { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
				rolled: method === 'roll' ? rollAbilityPool(pack.rules.abilityGeneration, Math.random) : []
			}
		});
	}

	function reroll(pack: OriginsPack): void {
		update({
			abilities: {
				...draft.abilities,
				base: { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
				rolled: rollAbilityPool(pack.rules.abilityGeneration, Math.random)
			}
		});
	}

	function setScore(ability: Ability, value: number | null): void {
		update({
			abilities: { ...draft.abilities, base: { ...draft.abilities.base, [ability]: value } }
		});
	}

	/**
	 * The numbers still on the table for standard array and rolling: the pool
	 * minus what is already assigned elsewhere. Assigning is therefore a
	 * dropdown of what remains, which makes a duplicate impossible rather than
	 * merely invalid.
	 */
	function availableFor(ability: Ability, pool: readonly number[]): number[] {
		const remaining = [...pool];
		for (const other of ABILITIES) {
			if (other === ability) continue;
			const taken = draft.abilities.base[other];
			if (taken === null) continue;
			const at = remaining.indexOf(taken);
			if (at >= 0) remaining.splice(at, 1);
		}
		return [...new Set(remaining)].sort((a, b) => b - a);
	}

	function applySpread(pattern: readonly number[], offered: readonly Ability[]): void {
		const increases: Partial<Record<Ability, number>> = {};
		pattern.forEach((amount, i) => {
			if (offered[i]) increases[offered[i]] = amount;
		});
		update({ abilities: { ...draft.abilities, increases } });
	}

	function setIncrease(ability: Ability, amount: number): void {
		const increases = { ...draft.abilities.increases };
		if (amount === 0) delete increases[ability];
		else increases[ability] = amount;
		update({ abilities: { ...draft.abilities, increases } });
	}

	function rollHitDie(hitDie: number): void {
		update({
			hitPoints: { ...draft.hitPoints, rolled: 1 + Math.floor(Math.random() * hitDie) }
		});
	}
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const generation = pack.rules.abilityGeneration}
		{@const background = pack.backgrounds.find((b) => b.id === draft.backgroundId) ?? null}
		{@const referenceClass =
			pack.referenceClasses.find((c) => c.id === draft.referenceClassId) ?? null}
		{@const method = draft.abilities.method}
		{@const pool =
			method === 'standard-array'
				? generation.standardArray
				: method === 'roll'
					? draft.abilities.rolled
					: []}
		{@const scores = finalScores(draft)}

		<h2 class="text-2xl font-bold tracking-tight">Ability scores</h2>
		<p class="mt-2 text-muted">{pack.rules.steps[2].text}</p>

		<ul class="mt-6 grid gap-3 sm:grid-cols-3">
			{#each METHODS as option (option.id)}
				<li>
					<button
						type="button"
						onclick={() => chooseMethod(option.id, pack)}
						aria-pressed={method === option.id}
						class="w-full rounded-lg border p-4 text-left transition-colors {method === option.id
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-semibold">{option.label}</span>
						<span class="mt-1 block text-sm text-muted">{option.help}</span>
					</button>
				</li>
			{/each}
		</ul>

		{#if method === 'point-buy'}
			{@const left = pointsRemaining(draft.abilities.base, generation)}
			<p class="mt-4 text-sm" class:text-danger={left < 0}>
				<strong>{left}</strong> of {generation.pointBuy.budget} points remaining.
			</p>
		{:else if method === 'roll'}
			<div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
				<span class="text-muted">Rolled: <strong>{draft.abilities.rolled.join(', ')}</strong></span>
				<button
					type="button"
					onclick={() => reroll(pack)}
					class="rounded border border-border px-3 py-1 hover:border-accent"
				>
					Roll again
				</button>
			</div>
		{/if}

		{#if method}
			<table class="mt-6 w-full text-left text-sm">
				<thead class="border-b border-border">
					<tr>
						<th class="py-2">Ability</th>
						<th class="py-2">Base</th>
						<th class="py-2">Background</th>
						<th class="py-2">Score</th>
						<th class="py-2">Mod</th>
					</tr>
				</thead>
				<tbody>
					{#each ABILITIES as ability (ability)}
						{@const offered = background?.abilityScores.includes(ability) ?? false}
						{@const score = scores[ability]}
						<tr class="border-b border-border/50">
							<th class="py-2 font-semibold">{ability}</th>
							<td class="py-2">
								{#if method === 'point-buy'}
									<input
										type="number"
										min={generation.pointBuy.min}
										max={generation.pointBuy.max}
										value={draft.abilities.base[ability] ?? ''}
										oninput={(e) => {
											const raw = e.currentTarget.value;
											setScore(ability, raw === '' ? null : Number(raw));
										}}
										aria-label="{ability} base score"
										aria-invalid={draft.abilities.base[ability] !== null &&
											pointCost(draft.abilities.base[ability]!, generation) === null}
										class="w-20 rounded border border-border bg-surface px-2 py-1"
									/>
								{:else}
									<select
										value={draft.abilities.base[ability] ?? ''}
										onchange={(e) => {
											const raw = e.currentTarget.value;
											setScore(ability, raw === '' ? null : Number(raw));
										}}
										aria-label="{ability} base score"
										class="w-20 rounded border border-border bg-surface px-2 py-1"
									>
										<option value="">—</option>
										{#each availableFor(ability, pool) as value (value)}
											<option {value}>{value}</option>
										{/each}
									</select>
								{/if}
							</td>
							<td class="py-2 text-muted">
								{#if offered}
									<select
										value={draft.abilities.increases[ability] ?? 0}
										onchange={(e) => setIncrease(ability, Number(e.currentTarget.value))}
										aria-label="{ability} background increase"
										class="rounded border border-border bg-surface px-2 py-1"
									>
										<option value={0}>+0</option>
										<option value={1}>+1</option>
										<option value={2}>+2</option>
									</select>
								{:else}
									—
								{/if}
							</td>
							<td class="py-2 font-semibold">{score ?? '—'}</td>
							<td class="py-2">{score === null ? '—' : formatModifier(modifier(score))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if background}
			<section class="mt-8">
				<h3 class="text-lg font-semibold">
					{background.name} increases: {background.abilityScores.join(', ')}
				</h3>
				<p class="mt-1 text-sm text-muted">
					Increase one by 2 and another by 1, or increase all three by 1.
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each INCREASE_SPREADS as spread (spread.id)}
						<button
							type="button"
							onclick={() => applySpread(spread.pattern, background.abilityScores)}
							class="rounded border border-border px-3 py-1 text-sm hover:border-accent"
						>
							Apply {spread.label}
						</button>
					{/each}
				</div>
				{#if !increasesAreLegal(draft.abilities.increases, background.abilityScores)}
					<p class="mt-2 text-sm text-danger">
						That is not a legal spread yet — use +2 and +1, or +1 to all three.
					</p>
				{/if}
			</section>
		{/if}

		<section class="mt-10">
			<h3 class="text-lg font-semibold">Hit points</h3>
			<p class="mt-1 text-sm text-muted">{pack.rules.rules.hitPoints.text}</p>
			{#if !referenceClass}
				<p class="mt-3 text-sm text-muted">Pick a reference class first — it lends the hit die.</p>
			{:else}
				{@const con = scores.CON === null ? 0 : modifier(scores.CON)}
				<div class="mt-3 flex flex-wrap items-center gap-3">
					<button
						type="button"
						onclick={() => rollHitDie(referenceClass.hitDie)}
						class="rounded border border-border px-3 py-1 text-sm hover:border-accent"
					>
						{draft.hitPoints.rolled === null ? 'Roll' : 'Reroll'} d{referenceClass.hitDie}
					</button>
					{#if draft.hitPoints.rolled !== null}
						<span class="text-sm text-muted">
							Rolled <strong>{draft.hitPoints.rolled}</strong> + CON {formatModifier(con)} =
							<strong>{Math.max(1, draft.hitPoints.rolled + con)} HP</strong>
						</span>
					{/if}
				</div>
			{/if}
		</section>
	{/snippet}
</PackGate>
