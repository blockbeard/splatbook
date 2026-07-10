<!--
	Wizard step: starting moves. Shows what the playbook and background grant,
	then lets the player resolve each "choose one" group and pick their free
	starting moves. Legality (level gates, prerequisites, one-per-group) is
	enforced by the engine; the UI just reflects it.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Move, Playbook } from '../pack-schemas';
	import type { StonetopCharacter } from '../engine';
	import {
		choosableMoves,
		freeChosenMoves,
		fullMoveSet,
		prerequisitesMet,
		startingMovesPlan
	} from '../engine';
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

	const byId = $derived(new Map<string, Move>(playbook?.moves.list.map((m) => [m.id, m]) ?? []));
	const plan = $derived(playbook ? startingMovesPlan(draft, playbook) : null);
	const choosable = $derived(playbook ? choosableMoves(draft, playbook) : []);
	const free = $derived(plan ? freeChosenMoves(draft, plan) : []);
	const have = $derived(plan ? fullMoveSet(draft, plan) : new Set<string>());
	const atLimit = $derived(plan ? free.length >= plan.chooseCount : true);

	const name = (id: string): string => byId.get(id)?.name ?? id;

	function selectPickOne(group: string[], id: string): void {
		const next = draft.moves.filter((m) => !group.includes(m));
		next.push(id);
		update({ moves: next });
	}

	function toggleFree(id: string): void {
		if (draft.moves.includes(id)) update({ moves: draft.moves.filter((m) => m !== id) });
		else update({ moves: [...draft.moves, id] });
	}
</script>

<h2 class="text-2xl font-bold tracking-tight">Starting moves</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook || !plan}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	{#if plan.granted.length}
		<section class="mt-4">
			<h3 class="text-sm font-medium text-muted">You start with</h3>
			<ul class="mt-1 list-disc pl-5">
				{#each plan.granted as id (id)}
					<li>{name(id)}</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#each plan.pickOneGroups as group, i (i)}
		<section class="mt-6">
			<h3 class="text-sm font-medium">Choose one</h3>
			<div class="mt-2 grid gap-2 sm:grid-cols-2">
				{#each group as id (id)}
					{@const move = byId.get(id)}
					{@const on = draft.moves.includes(id)}
					<button
						type="button"
						onclick={() => selectPickOne(group, id)}
						aria-pressed={on}
						class="rounded-lg border p-3 text-left transition-colors {on
							? 'border-accent bg-accent/5 ring-1 ring-accent'
							: 'border-border hover:border-accent'}"
					>
						<span class="font-semibold">{move?.name ?? id}</span>
						{#if move?.text}<span class="mt-1 block text-sm text-muted"
								><Markdown text={move.text} /></span
							>{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}

	<section class="mt-6">
		<h3 class="text-sm font-medium">
			Choose {plan.chooseCount}
			<span class="font-normal text-muted">({free.length}/{plan.chooseCount})</span>
		</h3>
		<div class="mt-2 space-y-2">
			{#each choosable as move (move.id)}
				{@const on = draft.moves.includes(move.id)}
				{@const blocked = !prerequisitesMet(move, have)}
				<button
					type="button"
					onclick={() => toggleFree(move.id)}
					disabled={!on && (atLimit || blocked)}
					aria-pressed={on}
					class="w-full rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 {on
						? 'border-accent bg-accent/5 ring-1 ring-accent'
						: 'border-border hover:border-accent'}"
				>
					<span class="font-semibold">{move.name}</span>
					{#if move.childOf}<span class="ml-2 text-xs text-muted"
							>requires {name(move.childOf)}</span
						>{/if}
					<span class="mt-1 block text-sm text-muted"><Markdown text={move.text} /></span>
				</button>
			{/each}
		</div>
	</section>
{/if}
