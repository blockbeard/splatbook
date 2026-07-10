<!--
	Wizard step: origin and name. Choose where you're from (each option suggests
	names), then take a suggested name or write your own. Text and name lists come
	from the chosen playbook.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import type { StonetopCharacter } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
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

	const selected = $derived(
		playbook?.origins.options.find((o) => o.label === draft.origin.option) ?? null
	);

	function chooseOrigin(label: string): void {
		update({ origin: { ...draft.origin, option: label } });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Origin &amp; name</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<p class="mt-2 text-muted">{playbook.origins.prompt}</p>
	<ul class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each playbook.origins.options as option (option.label)}
			<li>
				<OptionButton
					selected={draft.origin.option === option.label}
					onclick={() => chooseOrigin(option.label)}
				>
					<span class="font-semibold">{option.label}</span>
					{#if option.note}
						<span class="mt-1 text-sm text-muted">{option.note}</span>
					{/if}
				</OptionButton>
			</li>
		{/each}
	</ul>

	<div class="mt-6">
		<label for="character-name" class="text-sm font-medium">Name</label>
		<input
			id="character-name"
			type="text"
			value={draft.name}
			oninput={(e) => update({ name: e.currentTarget.value })}
			placeholder="Your character's name"
			class="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
		/>
		{#if selected?.names.length}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each selected.names as name (name)}
					<button
						type="button"
						onclick={() => update({ name })}
						class="rounded-full border px-3 py-1 text-sm transition-colors {draft.name === name
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						{name}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
