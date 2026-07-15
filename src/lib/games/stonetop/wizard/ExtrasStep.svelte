<!--
	Wizard step: extras — the playbook-specific back-page sections (sacred pouch,
	tall tales, war stories, fear & anger…). Fully data-driven: each section may
	have intro text, pick-one lines, nested choices, and free-text prompts.

	Commit 106: this is also where the commit-99 auto-attach rules actually run
	for a freshly-built character — until now `autoAttachedInsertIds` only fired
	inside `migrateCharacter`'s v2→v3 upgrade, so a brand new Lightbearer/Marshal/
	Blessed+Initiate/Ranger-with-Companion never got their insert until the next
	reload. Extras is the natural spot: it's late enough that playbookId,
	backgroundId, and moves are all settled, and it's already fetching the
	playbook. Same effect seeds the Seeker's major arcanum as an Arcana card —
	the "Collection" section below is literally where the pack surfaces the
	major-arcana-questions prompt, so this is where its card should appear too.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import {
		addArcanaCard,
		arcanaCardsOf,
		attachAnimalCompanion,
		attachCrew,
		attachInitiatesOfDanu,
		attachInvocations,
		autoAttachedInsertIds,
		ANIMAL_COMPANION_INSERT_ID,
		CREW_INSERT_ID,
		INITIATES_OF_DANU_INSERT_ID,
		INVOCATIONS_INSERT_ID,
		type ChoiceSelection,
		type ExtrasSectionState,
		type StonetopCharacter
	} from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
	import { fetchCrewInsert } from '../pack/inserts';
	import Markdown from './components/Markdown.svelte';
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

	// Auto-attach class inserts, and seed the Seeker's major arcanum. Reads the
	// draft broadly (playbookId/backgroundId/moves/advancement/backgroundChoices/
	// inserts) so it re-checks on every relevant change but is a no-op once
	// everything it would attach is already there — safe to leave running for as
	// long as this step is mounted, including a player bouncing Back to it.
	$effect(() => {
		if (!playbook) return;
		const character = draft;
		const missingIds = autoAttachedInsertIds(character).filter((id) => !(id in character.inserts));

		const arcanumPick = character.backgroundChoices.arcanum?.selected[0];
		const needsSeekerArcana =
			character.playbookId === 'the-seeker' &&
			!!arcanumPick &&
			arcanaCardsOf(character).length === 0;

		if (missingIds.length === 0 && !needsSeekerArcana) return;

		let cancelled = false;
		void (async () => {
			let next = character;
			for (const id of missingIds) {
				if (id === INVOCATIONS_INSERT_ID) next = attachInvocations(next);
				else if (id === ANIMAL_COMPANION_INSERT_ID) next = attachAnimalCompanion(next);
				else if (id === INITIATES_OF_DANU_INSERT_ID) next = attachInitiatesOfDanu(next);
				else if (id === CREW_INSERT_ID) next = attachCrew(next, await fetchCrewInsert(fetch));
			}
			if (needsSeekerArcana && arcanumPick) {
				// Options print a Stock cost as a leading ◇/◇◇ (e.g. "◇◇ The Mindgem");
				// that's inventory-slot notation, not part of the card's name.
				const name = arcanumPick.replace(/^◇+\s*/, '').trim();
				next = addArcanaCard(next, { name });
			}
			if (!cancelled) update({ inserts: next.inserts });
		})();
		return () => (cancelled = true);
	});

	const sections = $derived(playbook?.extras ?? []);

	const stateOf = (id: string): ExtrasSectionState => draft.extras[id] ?? {};

	function patch(id: string, next: Partial<ExtrasSectionState>): void {
		update({ extras: { ...draft.extras, [id]: { ...stateOf(id), ...next } } });
	}

	function setLine(id: string, lineCount: number, i: number, value: string): void {
		const lines = [...(stateOf(id).lines ?? [])];
		while (lines.length < lineCount) lines.push(null);
		lines[i] = value;
		patch(id, { lines });
	}

	function setChoice(id: string, choiceId: string, sel: ChoiceSelection): void {
		patch(id, { choices: { ...(stateOf(id).choices ?? {}), [choiceId]: sel } });
	}

	function setPrompt(id: string, i: number, value: string): void {
		patch(id, { prompts: { ...(stateOf(id).prompts ?? {}), [i]: value } });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Details</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else if sections.length === 0}
	<p class="mt-6 text-muted">Nothing extra for this playbook — carry on.</p>
{:else}
	<div class="mt-6 space-y-8">
		{#each sections as section (section.id)}
			{@const state = stateOf(section.id)}
			<section>
				<h3 class="text-lg font-semibold">{section.title}</h3>
				{#if section.text}
					<div class="mt-1 text-sm text-muted"><Markdown text={section.text} /></div>
				{/if}

				{#each section.lines ?? [] as line, i (i)}
					<div class="mt-3 flex flex-wrap gap-2">
						{#each line as option (option)}
							{@const on = state.lines?.[i] === option}
							<button
								type="button"
								onclick={() => setLine(section.id, (section.lines ?? []).length, i, option)}
								aria-pressed={on}
								class="rounded-full border px-3 py-1.5 text-sm transition-colors {on
									? 'border-accent bg-accent/5 ring-1 ring-accent'
									: 'border-border hover:border-accent'}"
							>
								{option}
							</button>
						{/each}
					</div>
				{/each}

				{#each section.choices ?? [] as choice (choice.id)}
					<ChoiceGroup
						{choice}
						selection={state.choices?.[choice.id]}
						onchange={(sel) => setChoice(section.id, choice.id, sel)}
					/>
				{/each}

				{#each section.prompts ?? [] as prompt, i (i)}
					<label class="mt-3 block text-sm">
						<span class="text-muted">{prompt}</span>
						<input
							type="text"
							value={state.prompts?.[i] ?? ''}
							oninput={(e) => setPrompt(section.id, i, e.currentTarget.value)}
							class="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
						/>
					</label>
				{/each}
			</section>
		{/each}
	</div>
{/if}
