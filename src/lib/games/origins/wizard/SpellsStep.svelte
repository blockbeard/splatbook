<!--
	Step 5: spells — but only for a character whose background granted Magic
	Initiate, which in the SRD's four backgrounds means Acolyte (Cleric) or Sage
	(Wizard).

	The step is always in the wizard's list rather than being conditionally
	inserted, because the shell renders a fixed sequence; for a non-caster it
	says so plainly and moves on. That is better than a step that silently
	vanishes, which reads as a bug.

	No slots and no preparation: two cantrips, one level 1 spell, and that spell
	is one casting per Long Rest.
-->
<script lang="ts">
	import { marked } from 'marked';
	import type { WizardStepProps } from '$lib/wizard';
	import {
		CANTRIPS_GRANTED,
		LEVEL_1_SPELLS_GRANTED,
		availableSpells,
		isSpellcaster,
		spellList,
		type OriginsCharacter
	} from '../engine';
	import type { Ability, Spell } from '../pack-schemas';
	import type { OriginsPack } from '../pack/load';
	import Choice from './Choice.svelte';
	import PackGate from './PackGate.svelte';

	let { draft, update }: WizardStepProps<OriginsCharacter> = $props();

	const CASTING_ABILITIES: { id: Ability; label: string }[] = [
		{ id: 'INT', label: 'Intelligence' },
		{ id: 'WIS', label: 'Wisdom' },
		{ id: 'CHA', label: 'Charisma' }
	];

	// Trusted: first-party pack markdown.
	const html = (text: string): string => marked.parse(text, { async: false });

	/** Toggle a spell, holding the selection to what the feat actually grants. */
	function toggle(spell: Spell, limit: number): void {
		const key = spell.level === 0 ? 'cantrips' : 'level1';
		const chosen = draft.spells[key];
		const next = chosen.includes(spell.id)
			? chosen.filter((id) => id !== spell.id)
			: [...chosen, spell.id].slice(-limit);
		update({ spells: { ...draft.spells, [key]: next } });
	}

	function chooseAbility(ability: Ability): void {
		update({ spells: { ...draft.spells, ability } });
	}
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const background = pack.backgrounds.find((b) => b.id === draft.backgroundId) ?? null}
		{@const list = spellList(background)}

		<h2 class="text-2xl font-bold tracking-tight">Spells</h2>

		{#if !background}
			<p class="mt-6 text-muted">Pick a background first — it decides whether you cast at all.</p>
		{:else if !isSpellcaster(background)}
			<p class="mt-2 text-muted">{pack.rules.rules.spellcasting.text}</p>
			<p class="mt-6 rounded-lg border border-border p-4">
				<strong>{background.name}</strong> grants the
				<strong>{background.feat.name}</strong> feat, not Magic Initiate — so this character is not a
				spellcaster. Nothing to choose here.
			</p>
		{:else}
			<p class="mt-2 text-muted">{pack.rules.rules.spellcasting.text}</p>

			<section class="mt-8">
				<h3 class="text-lg font-semibold">Spellcasting ability</h3>
				<ul class="mt-3 grid gap-2 sm:grid-cols-3">
					{#each CASTING_ABILITIES as ability (ability.id)}
						<Choice
							title={ability.label}
							selected={draft.spells.ability === ability.id}
							onselect={() => chooseAbility(ability.id)}
						/>
					{/each}
				</ul>
			</section>

			{#each [{ level: 0 as const, limit: CANTRIPS_GRANTED, title: 'Cantrips', key: 'cantrips' as const }, { level: 1 as const, limit: LEVEL_1_SPELLS_GRANTED, title: 'Level 1 spell', key: 'level1' as const }] as tier (tier.level)}
				{@const options = availableSpells(pack.spells, list, tier.level)}
				<section class="mt-10">
					<h3 class="text-lg font-semibold">
						{tier.title}
						<span class="text-sm font-normal text-muted">
							— choose {tier.limit} from the {list} list ({draft.spells[tier.key]
								.length}/{tier.limit}
							chosen)
						</span>
					</h3>
					<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each options as spell (spell.id)}
							<Choice
								title={spell.name}
								subtitle="{spell.school}{spell.ritual ? ' · Ritual' : ''}{spell.concentration
									? ' · Concentration'
									: ''}"
								selected={draft.spells[tier.key].includes(spell.id)}
								onselect={() => toggle(spell, tier.limit)}
							>
								<div class="spell-body">
									<!-- Trusted: first-party pack markdown. -->
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html html(spell.text.split('\n\n')[0] ?? '')}
								</div>
							</Choice>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	{/snippet}
</PackGate>

<style>
	.spell-body :global(p) {
		margin: 0;
	}
</style>
