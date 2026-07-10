<!--
	Wizard step: choose an instinct — the drive that pulls you into trouble. Each
	playbook lists a handful plus a write-in; picking the write-in reveals a text
	field. Text comes from the chosen playbook.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import type { StonetopCharacter } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
	import Markdown from './components/Markdown.svelte';
	import OptionButton from './components/OptionButton.svelte';

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

	const chosen = $derived(playbook?.instincts.find((i) => i.id === draft.instinctId) ?? null);
</script>

<h2 class="text-2xl font-bold tracking-tight">Choose an instinct</h2>
<p class="mt-2 text-muted">The drive that gets you into trouble.</p>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<ul class="mt-6 grid gap-3 sm:grid-cols-2">
		{#each playbook.instincts as instinct (instinct.id)}
			<li>
				<OptionButton
					selected={draft.instinctId === instinct.id}
					onclick={() => update({ instinctId: instinct.id })}
				>
					<span class="font-semibold">{instinct.name}</span>
					{#if instinct.text}
						<span class="mt-1 text-sm text-muted"><Markdown text={instinct.text} /></span>
					{/if}
				</OptionButton>
			</li>
		{/each}
	</ul>

	{#if chosen?.custom}
		<input
			type="text"
			value={draft.instinctWriteIn}
			oninput={(e) => update({ instinctWriteIn: e.currentTarget.value })}
			placeholder="Describe your instinct…"
			class="mt-4 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
		/>
	{/if}
{/if}
