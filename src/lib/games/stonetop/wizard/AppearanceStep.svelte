<!--
	Wizard step: appearance. Each playbook prints several lines of descriptors;
	pick one per line. Options come from the chosen playbook.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import type { StonetopCharacter } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';

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

	function pick(lineIndex: number, option: string): void {
		const next = [...draft.appearance];
		while (next.length < (playbook?.appearance.length ?? 0)) next.push(null);
		next[lineIndex] = option;
		update({ appearance: next });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Appearance</h2>
<p class="mt-2 text-muted">Pick one from each line.</p>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<div class="mt-6 space-y-4">
		{#each playbook.appearance as line, i (i)}
			<div class="flex flex-wrap gap-2">
				{#each line as option (option)}
					{@const on = draft.appearance[i] === option}
					<button
						type="button"
						onclick={() => pick(i, option)}
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
	</div>
{/if}
