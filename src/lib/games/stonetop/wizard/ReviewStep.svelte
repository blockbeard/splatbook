<!--
	Wizard step: review. A compact summary of every choice plus a validation
	checklist — anything still missing is listed so the player can jump back.
	The full printable sheet is a separate view.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Move, Playbook } from '../pack-schemas';
	import type { StonetopCharacter } from '../engine';
	import { STAT_KEYS, isWriteInPossession, startingMovesPlan, validateCharacter } from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';

	let { draft, goTo }: WizardStepProps<StonetopCharacter> = $props();

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

	const moveById = $derived(
		new Map<string, Move>(playbook?.moves.list.map((m) => [m.id, m]) ?? [])
	);
	const errors = $derived(
		playbook ? validateCharacter(draft, playbook).filter((i) => i.severity === 'error') : []
	);

	const instinctLabel = $derived.by(() => {
		if (!playbook) return '';
		const inst = playbook.instincts.find((i) => i.id === draft.instinctId);
		return inst?.custom ? draft.instinctWriteIn : (inst?.name ?? '');
	});

	const backgroundLabel = $derived(
		playbook?.backgrounds.find((b) => b.id === draft.backgroundId)?.name ?? ''
	);

	const moveList = $derived.by(() => {
		if (!playbook) return [];
		const plan = startingMovesPlan(draft, playbook);
		const ids = [...new Set([...plan.granted, ...draft.moves])];
		return ids.map((id) => moveById.get(id)?.name ?? id);
	});

	const possessionList = $derived(
		draft.possessions.map((id) =>
			isWriteInPossession(id) ? (draft.possessionChoices[id]?.writeIn ?? '—') : id
		)
	);

	const statLine = $derived(
		STAT_KEYS.map((k) => {
			const v = draft.stats[k]?.value;
			return `${k} ${v === undefined ? '—' : v >= 0 ? `+${v}` : v}`;
		}).join('   ')
	);
</script>

<!-- Every label is a way back to the step that owns it: reviewing is only useful
     if noticing a problem and fixing it are the same gesture. -->
{#snippet jump(label: string, stepId: string)}
	<dt class="font-medium">
		<button
			type="button"
			onclick={() => goTo(stepId)}
			class="text-muted underline decoration-dotted underline-offset-2 hover:text-accent"
			title="Back to {label}"
		>
			{label}
		</button>
	</dt>
{/snippet}

<h2 class="text-2xl font-bold tracking-tight">Review</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<div class="mt-4 rounded-lg border border-border p-4">
		<p class="text-xl font-semibold">{draft.name || 'Unnamed'}</p>
		<p class="text-muted">{playbook.name}{backgroundLabel ? ` · ${backgroundLabel}` : ''}</p>

		<dl class="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
			{@render jump('Instinct', 'instinct')}
			<dd>{instinctLabel || '—'}</dd>
			{@render jump('Origin', 'origin')}
			<dd>{draft.origin.option || '—'}</dd>
			{@render jump('Appearance', 'appearance')}
			<dd>{draft.appearance.filter(Boolean).join(', ') || '—'}</dd>
			{@render jump('Stats', 'stats')}
			<dd class="font-mono">{statLine}</dd>
			{@render jump('Moves', 'moves')}
			<dd>{moveList.join(', ') || '—'}</dd>
			{@render jump('Possessions', 'possessions')}
			<dd>{possessionList.join(', ') || '—'}</dd>
		</dl>
	</div>

	{#if errors.length === 0}
		<p class="mt-4 font-medium text-accent">Everything looks complete — you're ready to finish.</p>
	{:else}
		<div class="mt-4">
			<p class="font-medium">Still to do:</p>
			<ul class="mt-1 space-y-1 text-sm">
				{#each errors as issue (issue.step + issue.field + issue.message)}
					<li>
						<!-- The issue already knows which step owns it (engine/validation.ts),
						     so the fix is one click from the complaint. -->
						<button
							type="button"
							onclick={() => goTo(issue.step)}
							class="text-left text-muted underline decoration-dotted underline-offset-2 hover:text-accent"
						>
							{issue.message}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/if}
