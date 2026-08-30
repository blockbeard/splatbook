<!--
	Step 2: species. "You gain the level 1 benefit of the species" — so the
	traits render as the SRD writes them, and the choice points the pack's
	overlay names (Draconic Ancestry, Elven Lineage, Human's Versatile feat)
	become real selects.

	Traits whose text describes higher-level scaling are shown unedited: the
	pack is a faithful copy, and a player is better served seeing "when you
	reach character level 5" and knowing it will never happen than seeing the
	sentence quietly deleted.
-->
<script lang="ts">
	import { marked } from 'marked';
	import type { WizardStepProps } from '$lib/wizard';
	import type { OriginsCharacter } from '../engine';
	import type { OriginsPack } from '../pack/load';
	import type { SpeciesChoice } from '../pack-schemas';
	import Choice from './Choice.svelte';
	import PackGate from './PackGate.svelte';

	let { draft, update }: WizardStepProps<OriginsCharacter> = $props();

	// Trusted: first-party pack markdown.
	const html = (text: string): string => marked.parse(text, { async: false });

	function chooseSpecies(id: string): void {
		if (draft.speciesId === id) return;
		// Choices belong to the species that offered them.
		update({ speciesId: id, speciesChoices: {} });
	}

	function chooseOption(choiceId: string, optionId: string): void {
		update({ speciesChoices: { ...draft.speciesChoices, [choiceId]: optionId } });
	}

	/** The options a choice offers: its own list, or the pool it names. */
	function optionsFor(choice: SpeciesChoice, pack: OriginsPack) {
		if (choice.options) return choice.options.map((o) => ({ ...o, note: o.note ?? '' }));
		if (choice.from === 'skills') {
			return pack.reference.skills.map((s) => ({ id: s.id, name: s.name, note: s.example }));
		}
		return pack.feats.map((f) => ({ id: f.id, name: f.name, note: '' }));
	}
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const selected = pack.species.find((s) => s.id === draft.speciesId) ?? null}
		<h2 class="text-2xl font-bold tracking-tight">Pick a species</h2>
		<p class="mt-2 text-muted">{pack.rules.steps[1].text}</p>

		<ul class="mt-6 grid gap-3 sm:grid-cols-3">
			{#each pack.species as species (species.id)}
				<Choice
					title={species.name}
					subtitle="{species.size} · {species.speed} ft."
					selected={draft.speciesId === species.id}
					onselect={() => chooseSpecies(species.id)}
				/>
			{/each}
		</ul>

		{#if selected}
			{#each selected.choices ?? [] as choice (choice.id)}
				<section class="mt-8">
					<h3 class="text-lg font-semibold">{choice.label}</h3>
					{#if choice.help}<p class="mt-1 text-sm text-muted">{choice.help}</p>{/if}
					<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each optionsFor(choice, pack) as option (option.id)}
							<Choice
								title={option.name}
								subtitle={option.note || undefined}
								selected={draft.speciesChoices[choice.id] === option.id}
								onselect={() => chooseOption(choice.id, option.id)}
							/>
						{/each}
					</ul>
				</section>
			{/each}

			<section class="mt-10">
				<h3 class="text-lg font-semibold">{selected.name} traits</h3>
				<p class="mt-1 text-sm text-muted">{selected.sizeNote} · Speed {selected.speed} feet</p>
				<dl class="mt-4 space-y-4">
					{#each selected.traits as trait (trait.name)}
						<div>
							<dt class="font-semibold">{trait.name}</dt>
							<dd class="trait-body mt-1 text-sm text-muted">
								<!-- Trusted: first-party pack markdown. -->
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html html(trait.text)}
							</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}
	{/snippet}
</PackGate>

<style>
	.trait-body :global(p) {
		margin: 0;
	}
	.trait-body :global(p + p) {
		margin-top: 0.5rem;
	}
</style>
