<!--
	Step 1: the background, and the reference class borrowed alongside it.

	These are one step because Origins makes them one decision — "pick a
	background, and then also pick a reference class for your character." The
	post's own worked example (Artisan background, Fighter reference class, for a
	weaponsmith) is the case for keeping them on the same screen: the second
	choice is a reading of the first.

	The reference-class cards say what a class does *not* give, because that is
	the rule most likely to be misread by anyone who knows 5e.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { OriginsCharacter } from '../engine';
	import type { OriginsPack } from '../pack/load';
	import Choice from './Choice.svelte';
	import PackGate from './PackGate.svelte';

	let { draft, update }: WizardStepProps<OriginsCharacter> = $props();

	function chooseBackground(id: string): void {
		if (draft.backgroundId === id) return;
		// A background carries its skills, its tool, its feat and its ability
		// increases; changing it invalidates all of them, so they reset together
		// rather than leaving a stale skill from the previous choice.
		update({
			backgroundId: id,
			skills: [],
			tools: [],
			abilities: { ...draft.abilities, increases: {} },
			spells: { cantrips: [], level1: [], ability: null, spent: [] },
			equipment: { ...draft.equipment, optionId: null }
		});
	}

	function chooseClass(id: string): void {
		// The hit die changes with the reference class, so a roll made under the
		// old one is no longer this character's roll.
		update({ referenceClassId: id, hitPoints: { ...draft.hitPoints, rolled: null } });
	}

	const armorSummary = (pack: OriginsPack, id: string): string =>
		pack.referenceClasses.find((c) => c.id === id)?.armorTraining.text ?? 'None';
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const rules = pack.rules}
		<h2 class="text-2xl font-bold tracking-tight">Pick a background</h2>
		<p class="mt-2 text-muted">{rules.steps[0].text}</p>

		<ul class="mt-6 grid gap-3 sm:grid-cols-2">
			{#each pack.backgrounds as background (background.id)}
				<Choice
					title={background.name}
					subtitle={background.abilityScores.join(' · ')}
					selected={draft.backgroundId === background.id}
					onselect={() => chooseBackground(background.id)}
				>
					<dl class="space-y-1">
						<div>
							<dt class="inline font-medium">Feat:</dt>
							{background.feat.name}
						</div>
						<div>
							<dt class="inline font-medium">Skills:</dt>
							{background.skillProficiencies.join(', ')}
						</div>
						<div>
							<dt class="inline font-medium">Tool:</dt>
							{background.toolProficiency}
						</div>
					</dl>
				</Choice>
			{/each}
		</ul>

		<h2 class="mt-10 text-2xl font-bold tracking-tight">Pick a reference class</h2>
		<p class="mt-2 text-muted">{rules.rules.referenceClass.text}</p>
		<p class="mt-3 rounded-lg border border-border bg-accent/5 p-3 text-sm">
			<strong>{rules.rules.referenceClass.note}</strong>
		</p>

		<ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each pack.referenceClasses as referenceClass (referenceClass.id)}
				<Choice
					title={referenceClass.name}
					subtitle="d{referenceClass.hitDie} hit die"
					selected={draft.referenceClassId === referenceClass.id}
					onselect={() => chooseClass(referenceClass.id)}
				>
					<dl class="space-y-1">
						<div>
							<dt class="inline font-medium">Armor:</dt>
							{armorSummary(pack, referenceClass.id)}
						</div>
						<div>
							<dt class="inline font-medium">Weapons:</dt>
							{referenceClass.weaponProficiencies}
						</div>
						{#if referenceClass.notGranted.savingThrowProficiencies}
							<div class="opacity-70">
								<dt class="inline font-medium">Not granted:</dt>
								{referenceClass.notGranted.savingThrowProficiencies} saves,
								{referenceClass.name} skills, and all class features.
							</div>
						{/if}
					</dl>
				</Choice>
			{/each}
		</ul>
	{/snippet}
</PackGate>
