<!--
	Step 7: review.

	The open-choices list comes from the engine's `openChoices`, so this screen
	and the finish button can never disagree about whether the character is
	done — and each open item links back to the step that closes it.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import {
		armorClass,
		formatModifier,
		formatMoney,
		hasSkill,
		initiative,
		maxHitPoints,
		openChoices,
		passivePerception,
		proficiencyBonus,
		savingThrow,
		skillModifier,
		ABILITIES,
		finalScores,
		modifier,
		spellSaveDc,
		type OriginsCharacter
	} from '../engine';
	import { packContext, type OriginsPack } from '../pack/load';
	import PackGate from './PackGate.svelte';

	let { draft, goTo }: WizardStepProps<OriginsCharacter> = $props();
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const ctx = packContext(pack, draft.backgroundId, draft.referenceClassId, draft.speciesId)}
		{@const species = ctx.species}
		{@const open = openChoices(draft, {
			rules: pack.rules,
			background: ctx.background,
			species
		})}
		{@const scores = finalScores(draft)}
		{@const hp = maxHitPoints(draft)}

		<h2 class="text-2xl font-bold tracking-tight">Review</h2>

		{#if open.length}
			<section class="mt-6 rounded-lg border border-danger/40 bg-danger/5 p-4">
				<h3 class="font-semibold">Still to decide</h3>
				<ul class="mt-2 space-y-1 text-sm">
					{#each open as choice (choice.message)}
						<li>
							<button
								type="button"
								onclick={() => goTo(choice.stepId)}
								class="text-left underline underline-offset-2 hover:text-accent"
							>
								{choice.message}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="mt-4 text-muted">
				{draft.name} is ready. Everything below is derived from your choices — the sheet computes it,
				so a rules fix reaches this character too.
			</p>
		{/if}

		<section class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each [{ label: 'Armor Class', value: String(armorClass(draft, ctx)) }, { label: 'Hit Points', value: hp === null ? '—' : String(hp) }, { label: 'Initiative', value: formatModifier(initiative(draft, ctx)) }, { label: 'Passive Perception', value: String(passivePerception(draft, ctx)) }] as stat (stat.label)}
				<div class="rounded-lg border border-border p-4 text-center">
					<div class="text-2xl font-bold">{stat.value}</div>
					<div class="mt-1 text-sm text-muted">{stat.label}</div>
				</div>
			{/each}
		</section>

		<section class="mt-8">
			<h3 class="text-lg font-semibold">Ability scores and saves</h3>
			<p class="mt-1 text-sm text-muted">
				Saves are the bare ability modifier: a reference class lends a hit die, armor training,
				shields and weapon proficiencies — not saving throws.
			</p>
			<table class="mt-3 w-full text-left text-sm">
				<thead class="border-b border-border">
					<tr
						><th class="py-2">Ability</th><th class="py-2">Score</th><th class="py-2">Mod</th><th
							class="py-2">Save</th
						></tr
					>
				</thead>
				<tbody>
					{#each ABILITIES as ability (ability)}
						{@const score = scores[ability]}
						<tr class="border-b border-border/50">
							<th class="py-2 font-semibold">{ability}</th>
							<td class="py-2">{score ?? '—'}</td>
							<td class="py-2">{score === null ? '—' : formatModifier(modifier(score))}</td>
							<td class="py-2">{formatModifier(savingThrow(draft, ability))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="mt-8">
			<h3 class="text-lg font-semibold">Skills</h3>
			<p class="mt-1 text-sm text-muted">
				Proficiency bonus {formatModifier(proficiencyBonus(pack.rules))} — fixed, because there are no
				levels.
			</p>
			<ul class="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
				{#each pack.reference.skills as skill (skill.id)}
					{@const proficient = hasSkill(draft, skill, ctx)}
					<li class:font-semibold={proficient}>
						{formatModifier(skillModifier(draft, skill, ctx))}
						{skill.name}
						<span class="text-muted">({skill.ability})</span>
					</li>
				{/each}
			</ul>
		</section>

		{#if draft.spells.cantrips.length || draft.spells.level1.length}
			<section class="mt-8">
				<h3 class="text-lg font-semibold">Spells</h3>
				{#if spellSaveDc(draft, ctx) !== null}
					<p class="mt-1 text-sm text-muted">Spell save DC {spellSaveDc(draft, ctx)}</p>
				{/if}
				<ul class="mt-2 text-sm">
					{#each [...draft.spells.cantrips, ...draft.spells.level1] as id (id)}
						{@const spell = pack.spells.find((s) => s.id === id)}
						{#if spell}
							<li>
								{spell.name}
								<span class="text-muted">
									— {spell.level === 0 ? 'cantrip, at will' : 'level 1, once per Long Rest'}
									{spell.ritual ? ' (ritual — free)' : ''}
								</span>
							</li>
						{/if}
					{/each}
				</ul>
			</section>
		{/if}

		<section class="mt-8">
			<h3 class="text-lg font-semibold">Equipment</h3>
			<p class="mt-1 text-sm text-muted">Purse: {formatMoney(draft.equipment.goldCp)}</p>
			<ul class="mt-2 list-disc pl-5 text-sm">
				{#each draft.equipment.items as item (item.name)}
					<li>{item.name}</li>
				{/each}
				{#if draft.equipment.packId}
					{@const kit = pack.equipment.packs.find((p) => p.id === draft.equipment.packId)}
					{#if kit}<li>{kit.name} — {kit.contents.join(', ')}</li>{/if}
				{/if}
			</ul>
		</section>
	{/snippet}
</PackGate>
