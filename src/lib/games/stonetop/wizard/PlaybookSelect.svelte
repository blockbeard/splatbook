<!--
	Wizard step 1: choose a playbook. Lists Stonetop's nine playbooks with their
	flavor text; picking one records it on the draft. All player-facing text
	comes from the content pack (fetched here), never from this component.
-->
<script lang="ts">
	import { marked } from 'marked';
	import type { WizardStepProps } from '$lib/wizard';
	import type { StonetopCharacter } from '../engine';
	import { fetchPlaybookSummaries, type PlaybookSummary } from '../pack/playbooks';

	let { draft, update }: WizardStepProps<StonetopCharacter> = $props();

	let playbooks = $state<PlaybookSummary[]>([]);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchPlaybookSummaries(fetch)
			.then((p) => alive && (playbooks = p))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// Flavor carries Markdown emphasis; pack content is first-party, so trusted.
	const flavorHtml = (flavor: string): string => marked.parse(flavor, { async: false });

	function choose(id: string): void {
		update({ playbookId: id });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Choose a playbook</h2>
<p class="mt-2 text-muted">
	Your playbook is who you are in Stonetop — pick the one that calls to you.
</p>

{#if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbooks: {loadError}</p>
{:else if playbooks.length === 0}
	<p class="mt-6 text-muted">Loading playbooks…</p>
{:else}
	<ul class="mt-6 grid gap-3 sm:grid-cols-2">
		{#each playbooks as playbook (playbook.id)}
			{@const selected = draft.playbookId === playbook.id}
			<li>
				<button
					type="button"
					onclick={() => choose(playbook.id)}
					aria-pressed={selected}
					class="flex h-full w-full flex-col rounded-lg border p-4 text-left transition-colors hover:border-accent {selected
						? 'border-accent bg-accent/5 ring-1 ring-accent'
						: 'border-border'}"
				>
					<span class="text-lg font-semibold">{playbook.name}</span>
					<div class="playbook-flavor mt-2 text-sm text-muted">
						<!-- Trusted: first-party pack markdown. -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html flavorHtml(playbook.flavor)}
					</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.playbook-flavor :global(p) {
		margin: 0;
	}
	.playbook-flavor :global(p + p) {
		margin-top: 0.5rem;
	}
</style>
