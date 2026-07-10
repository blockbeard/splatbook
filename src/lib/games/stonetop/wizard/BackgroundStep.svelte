<!--
	Wizard step: choose a background. Each background may grant moves/notes/a
	tracker and carry nested "choose N" picks (e.g. the Blessed's initiates).
	Selecting a background records it; its picks bind into the draft. All text
	comes from the chosen playbook in the pack.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import type { ChoiceSelection, StonetopCharacter } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
	import Markdown from './components/Markdown.svelte';
	import OptionButton from './components/OptionButton.svelte';
	import ChoiceGroup from './components/ChoiceGroup.svelte';

	let { draft, update }: WizardStepProps<StonetopCharacter> = $props();

	let playbook = $state<Playbook | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		const id = draft.playbookId;
		if (!id) return;
		let alive = true;
		fetchPlaybook(id, fetch)
			.then((p) => alive && (playbook = p))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const selected = $derived(playbook?.backgrounds.find((b) => b.id === draft.backgroundId) ?? null);
	// Move id → name, for showing what a background grants.
	const moveName = $derived(new Map(playbook?.moves.list.map((m) => [m.id, m.name]) ?? []));

	function choose(id: string): void {
		if (id === draft.backgroundId) return;
		// Switching background clears its now-irrelevant nested picks.
		update({ backgroundId: id, backgroundChoices: {} });
	}

	function setChoice(choiceId: string, selection: ChoiceSelection): void {
		update({ backgroundChoices: { ...draft.backgroundChoices, [choiceId]: selection } });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Choose a background</h2>
<p class="mt-2 text-muted">Where you come from, and what it grants you.</p>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<ul class="mt-6 grid gap-3 sm:grid-cols-2">
		{#each playbook.backgrounds as background (background.id)}
			<li>
				<OptionButton
					selected={draft.backgroundId === background.id}
					onclick={() => choose(background.id)}
				>
					<span class="text-lg font-semibold">{background.name}</span>
					{#if background.text}
						<span class="mt-1 text-sm text-muted"><Markdown text={background.text} /></span>
					{/if}
				</OptionButton>
			</li>
		{/each}
	</ul>

	{#if selected}
		<div class="mt-8 border-t border-border pt-6">
			<h3 class="text-lg font-semibold">{selected.name}</h3>

			{#if selected.grants?.moves?.length}
				<p class="mt-2 text-sm">
					<span class="text-muted">Grants move:</span>
					{selected.grants.moves.map((id) => moveName.get(id) ?? id).join(', ')}
				</p>
			{/if}
			{#if selected.grants?.notes?.length}
				<ul class="mt-2 list-disc pl-5 text-sm text-muted">
					{#each selected.grants.notes as note (note)}
						<li><Markdown text={note} inline /></li>
					{/each}
				</ul>
			{/if}
			{#if selected.tracker}
				<p class="mt-2 text-sm text-muted">
					Tracker: {selected.tracker.label} ({selected.tracker.boxes} boxes)
				</p>
			{/if}

			{#each selected.choices ?? [] as choice (choice.id)}
				<ChoiceGroup
					{choice}
					selection={draft.backgroundChoices[choice.id]}
					onchange={(sel) => setChoice(choice.id, sel)}
				/>
			{/each}
		</div>
	{/if}
{/if}
