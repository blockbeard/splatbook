<!--
	The read-only character sheet — the print view.

	Every number here is derived from the saved choices rather than stored, so a
	character saved before a rules fix shows the corrected numbers the next time
	it is opened. The two exceptions are the rolls: the hit die and the ability
	pool were events, and re-deriving them would reroll the character.
-->
<script lang="ts">
	import type { SheetProps } from '$lib/games/types';
	import {
		ABILITIES,
		armorClass,
		finalScores,
		formatModifier,
		formatMoney,
		hasSkill,
		hitDie,
		initiative,
		maxHitPoints,
		migrateCharacter,
		modifier,
		passivePerception,
		proficiencyBonus,
		savingThrow,
		skillModifier,
		spellAttackBonus,
		spellSaveDc,
		type OriginsCharacter
	} from '../engine';
	import { packContext, type OriginsPack } from '../pack/load';
	import PackGate from '../wizard/PackGate.svelte';

	let { character }: SheetProps = $props();
	const sheet = $derived(migrateCharacter(character) as OriginsCharacter);
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const ctx = packContext(pack, sheet.backgroundId, sheet.referenceClassId, sheet.speciesId)}
		{@const species = ctx.species}
		{@const scores = finalScores(sheet)}
		{@const hp = maxHitPoints(sheet)}

		<header class="border-b border-border pb-4">
			<h1 class="text-3xl font-bold tracking-tight">{sheet.name || 'Unnamed adventurer'}</h1>
			<p class="mt-1 text-muted">
				{[species?.name, ctx.background?.name].filter(Boolean).join(' · ')}
				{#if ctx.referenceClass}
					<span class="text-sm">
						— trained as {ctx.referenceClass.name} (d{hitDie(ctx)} hit die,
						{ctx.referenceClass.armorTraining.text})
					</span>
				{/if}
			</p>
		</header>

		<section class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
			{#each [{ label: 'Armor Class', value: String(armorClass(sheet, ctx)) }, { label: 'Hit Points', value: hp === null ? '—' : String(hp) }, { label: 'Initiative', value: formatModifier(initiative(sheet, ctx)) }, { label: 'Speed', value: species ? `${species.speed} ft.` : '—' }, { label: 'Passive Perception', value: String(passivePerception(sheet, ctx)) }] as stat (stat.label)}
				<div class="rounded-lg border border-border p-4 text-center">
					<div class="text-2xl font-bold">{stat.value}</div>
					<div class="mt-1 text-xs uppercase tracking-wide text-muted">{stat.label}</div>
				</div>
			{/each}
		</section>

		<div class="mt-8 grid gap-8 lg:grid-cols-2">
			<section>
				<h2 class="text-lg font-semibold">Abilities</h2>
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
								<td class="py-2">{formatModifier(savingThrow(sheet, ability))}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="mt-2 text-xs text-muted">
					Saves carry no proficiency: an Origins character has no class, and a reference class lends
					only a hit die, armor training, shields and weapon proficiencies.
				</p>
			</section>

			<section>
				<h2 class="text-lg font-semibold">
					Skills
					<span class="text-sm font-normal text-muted">
						— proficiency {formatModifier(proficiencyBonus(pack.rules))}
					</span>
				</h2>
				<ul class="mt-3 grid gap-1 text-sm sm:grid-cols-2">
					{#each pack.reference.skills as skill (skill.id)}
						{@const proficient = hasSkill(sheet, skill, ctx)}
						<li class:font-semibold={proficient}>
							<span class="tabular-nums">{formatModifier(skillModifier(sheet, skill, ctx))}</span>
							{skill.name}
						</li>
					{/each}
				</ul>
			</section>
		</div>

		{#if species}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">{species.name} traits</h2>
				<ul class="mt-2 space-y-1 text-sm">
					{#each species.traits as trait (trait.name)}
						<li><strong>{trait.name}.</strong> <span class="text-muted">{trait.text}</span></li>
					{/each}
				</ul>
				{#if species.choices?.length}
					<ul class="mt-3 text-sm text-muted">
						{#each species.choices as choice (choice.id)}
							{@const picked = sheet.speciesChoices[choice.id]}
							{#if picked}
								{@const name =
									choice.options?.find((o) => o.id === picked)?.name ??
									pack.reference.skills.find((s) => s.id === picked)?.name ??
									pack.feats.find((f) => f.id === picked)?.name ??
									picked}
								<li>{choice.label}: <strong>{name}</strong></li>
							{/if}
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if ctx.background}
			{@const feat = pack.feats.find((f) => f.id === ctx.background!.feat.id)}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">{ctx.background.feat.name}</h2>
				{#if feat}
					<ul class="mt-2 space-y-1 text-sm">
						{#each feat.benefits as benefit (benefit.name)}
							<li>
								<strong>{benefit.name}.</strong>
								<span class="text-muted">{benefit.text}</span>
							</li>
						{:else}
							<li class="text-muted">{feat.text}</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if sheet.spells.cantrips.length || sheet.spells.level1.length}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Spells</h2>
				<p class="mt-1 text-sm text-muted">
					{#if spellSaveDc(sheet, ctx) !== null}
						Save DC {spellSaveDc(sheet, ctx)} · Attack
						{formatModifier(spellAttackBonus(sheet, ctx) ?? 0)} ·
					{/if}
					No slots: each level 1 spell is one casting per Long Rest.
				</p>
				<ul class="mt-2 space-y-1 text-sm">
					{#each [...sheet.spells.cantrips, ...sheet.spells.level1] as id (id)}
						{@const spell = pack.spells.find((s) => s.id === id)}
						{#if spell}
							<li>
								<strong>{spell.name}</strong>
								<span class="text-muted">
									— {spell.level === 0 ? 'cantrip' : 'level 1'}, {spell.castingTime}, {spell.range}
									{spell.ritual ? ' · ritual (free)' : ''}
								</span>
							</li>
						{/if}
					{/each}
				</ul>
			</section>
		{/if}

		<section class="mt-8">
			<h2 class="text-lg font-semibold">Equipment</h2>
			<p class="mt-1 text-sm text-muted">Purse: {formatMoney(sheet.equipment.goldCp)}</p>
			<ul class="mt-2 list-disc pl-5 text-sm">
				{#each sheet.equipment.items as item (item.name)}
					<li>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</li>
				{/each}
				{#if sheet.equipment.packId}
					{@const kit = pack.equipment.packs.find((p) => p.id === sheet.equipment.packId)}
					{#if kit}<li>{kit.name} — {kit.contents.join(', ')}</li>{/if}
				{/if}
				{#if sheet.equipment.armorId}
					{@const armor = pack.equipment.armor.find((a) => a.id === sheet.equipment.armorId)}
					{#if armor}<li>{armor.name} (worn)</li>{/if}
				{/if}
				{#if sheet.equipment.shield}<li>Shield</li>{/if}
			</ul>
		</section>

		{#if sheet.languages.length}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Languages</h2>
				<p class="mt-1 text-sm">{sheet.languages.join(', ')}</p>
			</section>
		{/if}

		{#each [{ label: 'Appearance', value: sheet.details.appearance }, { label: 'Personality', value: sheet.details.personality }, { label: 'History', value: sheet.details.history }, { label: 'Alignment', value: sheet.details.alignment }, { label: 'Notes', value: sheet.details.notes }] as detail (detail.label)}
			{#if detail.value.trim()}
				<section class="mt-6">
					<h2 class="text-lg font-semibold">{detail.label}</h2>
					<p class="mt-1 whitespace-pre-wrap text-sm">{detail.value}</p>
				</section>
			{/if}
		{/each}
	{/snippet}
</PackGate>
