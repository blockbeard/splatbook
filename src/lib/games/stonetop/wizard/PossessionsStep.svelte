<!--
	Wizard step: possessions. Fixed gear is listed; the player picks N more from
	the options, some of which carry their own sub-choices or a free-text
	write-in. Count and sub-picks are enforced by the engine validator.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import type { ChoiceSelection, StonetopCharacter } from '../engine';
	import { possessionChoiceKey } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
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

	const possessions = $derived(playbook?.possessions ?? null);
	const atLimit = $derived(possessions ? draft.possessions.length >= possessions.pick : true);

	const writeInId = (i: number): string => `writein:${i}`;

	function toggleItem(name: string): void {
		if (draft.possessions.includes(name)) {
			update({ possessions: draft.possessions.filter((p) => p !== name) });
		} else if (!atLimit) {
			update({ possessions: [...draft.possessions, name] });
		}
	}

	function setChoice(itemName: string, choiceId: string, selection: ChoiceSelection): void {
		const key = possessionChoiceKey(itemName, choiceId);
		update({ possessionChoices: { ...draft.possessionChoices, [key]: selection } });
	}

	function setWriteIn(i: number, value: string): void {
		const id = writeInId(i);
		const choices = {
			...draft.possessionChoices,
			[id]: { ...(draft.possessionChoices[id] ?? { selected: [] }), writeIn: value }
		};
		const has = draft.possessions.includes(id);
		let list = draft.possessions;
		if (value.trim() && !has) list = [...list, id];
		else if (!value.trim() && has) list = list.filter((p) => p !== id);
		update({ possessions: list, possessionChoices: choices });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Possessions</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !possessions}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<p class="mt-2 text-muted">
		{possessions.prompt}
		<span class="ml-1" class:text-accent={draft.possessions.length === possessions.pick}
			>({draft.possessions.length}/{possessions.pick})</span
		>
	</p>

	{#if possessions.fixed?.length}
		<section class="mt-4">
			<h3 class="text-sm font-medium text-muted">You carry</h3>
			<ul class="mt-1 list-disc pl-5 text-sm">
				{#each possessions.fixed as item (item.name)}
					<li>
						{item.name}{#if item.text}
							— <span class="text-muted"><Markdown text={item.text} inline /></span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mt-6 space-y-3">
		{#each possessions.options as option, i (option.name || i)}
			{#if option.writeIn}
				{@const id = writeInId(i)}
				<input
					type="text"
					value={draft.possessionChoices[id]?.writeIn ?? ''}
					oninput={(e) => setWriteIn(i, e.currentTarget.value)}
					disabled={atLimit && !draft.possessions.includes(id)}
					placeholder={option.name || 'Something else…'}
					class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-40"
				/>
			{:else}
				{@const on = draft.possessions.includes(option.name)}
				<div>
					<button
						type="button"
						onclick={() => toggleItem(option.name)}
						disabled={!on && atLimit}
						aria-pressed={on}
						class="w-full rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-semibold">{option.name}</span>
						{#if option.tags?.length}<span class="ml-2 text-xs text-muted"
								>{option.tags.join(', ')}</span
							>{/if}
						{#if option.text}<span class="mt-1 block text-sm text-muted"
								><Markdown text={option.text} /></span
							>{/if}
					</button>
					{#if on && option.choices?.length}
						<div class="ml-3 border-l border-border pl-3">
							{#each option.choices as choice (choice.id)}
								<ChoiceGroup
									{choice}
									selection={draft.possessionChoices[possessionChoiceKey(option.name, choice.id)]}
									onchange={(sel) => setChoice(option.name, choice.id, sel)}
								/>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}
