<!--
	Wizard step: introductions — the numbered table ritual where the group goes
	round introducing characters. Roleplay prompts, so answers are optional; each
	numbered step gets a free-text note keyed by its number.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import type { StonetopCharacter } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
	import Markdown from './components/Markdown.svelte';

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

	function setAnswer(n: number, value: string): void {
		update({ introductions: { ...draft.introductions, [n]: value } });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Introductions</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<div class="mt-2 text-muted"><Markdown text={playbook.introductions.intro} /></div>

	<ol class="mt-6 space-y-5">
		{#each playbook.introductions.steps as step (step.n)}
			<li class="flex gap-3">
				<span
					class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
					>{step.n}</span
				>
				<div class="flex-1">
					<div class="text-sm"><Markdown text={step.text} /></div>
					{#if step.questions?.length}
						<ul class="mt-1 list-disc pl-5 text-sm text-muted">
							{#each step.questions as q (q)}
								<li>{q}</li>
							{/each}
						</ul>
					{/if}
					<textarea
						value={draft.introductions[step.n] ?? ''}
						oninput={(e) => setAnswer(step.n, e.currentTarget.value)}
						rows="2"
						placeholder="Notes (optional)…"
						class="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
					></textarea>
				</div>
			</li>
		{/each}
	</ol>
{/if}
