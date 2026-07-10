<!--
	The steading Improvements list (phase 6, commit 45). Each catalogue Improvement
	from the pack is a collapsible card showing its requirement checklist — the
	all / choose-N / either-or / multi-box "Pull Together" groups the engine
	normalises — a "requirements met" pill, a Mark-complete toggle, and the
	printed effects. Ticking a requirement or filling a ◇ box runs a pure engine
	function and hands the new steading up via `onChange`. Completing an
	Improvement is a note that its effects were taken; the stat bumps themselves
	are applied by hand on the tracker (the model never mutates stats silently).
-->
<script lang="ts">
	import type { SteadingImprovement } from '../pack-schemas';
	import type { StonetopSteading } from '../engine/steading';
	import {
		requirementGroups,
		slotSatisfied,
		requirementsMet,
		improvementState,
		toggleRequirement,
		setRequirementBoxes,
		setImprovementCompleted,
		type RequirementGroup,
		type RequirementSlot
	} from '../engine/improvements';
	import Markdown from '../wizard/components/Markdown.svelte';

	let {
		improvements,
		steading,
		onChange
	}: {
		improvements: SteadingImprovement[];
		steading: StonetopSteading;
		onChange: (next: StonetopSteading) => void;
	} = $props();

	const ruleHint = (g: RequirementGroup): string => {
		if (g.kind === 'all') return 'All of:';
		if (g.kind === 'each') return 'Any (each adds effect):';
		if (g.kind === 'either')
			return g.orAll ? 'Either one — or all of the second set:' : 'Choose one:';
		return `Choose ${g.pick}:`;
	};

	const toggle = (id: string, key: string) => onChange(toggleRequirement(steading, id, key));
	const setBoxes = (id: string, key: string, filled: number, max: number) =>
		onChange(setRequirementBoxes(steading, id, key, filled, max));
	const complete = (id: string, done: boolean) =>
		onChange(setImprovementCompleted(steading, id, done));

	/** Tap the i-th box: fill up to it, or clear back to it if it's already the top. */
	const tapTo = (current: number, i: number): number => (current === i + 1 ? i : i + 1);
</script>

{#snippet slotRow(id: string, st: ReturnType<typeof improvementState>, s: RequirementSlot)}
	{#if s.boxes}
		<div class="flex items-start gap-2 py-1">
			<div class="mt-0.5 flex gap-1" role="group" aria-label={s.label}>
				{#each Array(s.boxes) as _, i (i)}
					{@const filled = st.boxes[s.key] ?? 0}
					<button
						type="button"
						onclick={() => setBoxes(id, s.key, tapTo(filled, i), s.boxes ?? 0)}
						aria-pressed={i < filled}
						aria-label={`${s.label}: ${i + 1}`}
						class="h-4 w-4 rounded-sm border border-border {i < filled
							? 'bg-accent'
							: 'bg-surface hover:bg-border'}"
					></button>
				{/each}
			</div>
			<span class="text-sm {slotSatisfied(st, s) ? 'text-muted line-through' : ''}">{s.label}</span>
		</div>
	{:else}
		<label class="flex cursor-pointer items-start gap-2 py-1">
			<input
				type="checkbox"
				checked={st.checked.includes(s.key)}
				onchange={() => toggle(id, s.key)}
				class="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
			/>
			<span class="text-sm {slotSatisfied(st, s) ? 'text-muted line-through' : ''}">{s.label}</span>
		</label>
	{/if}
{/snippet}

<div class="space-y-2">
	{#each improvements as imp (imp.id)}
		{@const st = improvementState(steading, imp.id)}
		{@const met = requirementsMet(imp.requires, st)}
		{@const groups = requirementGroups(imp.requires)}
		<details class="rounded-md border border-border {st.completed ? 'bg-accent/5' : ''}">
			<summary class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
				<span class="font-medium">{imp.name}</span>
				<span class="flex shrink-0 items-center gap-2">
					{#if st.completed}
						<span class="rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-contrast"
							>Complete</span
						>
					{:else if met}
						<span class="rounded border border-accent px-1.5 py-0.5 text-xs font-medium text-accent"
							>Met</span
						>
					{/if}
				</span>
			</summary>
			<div class="space-y-4 border-t border-border px-3 py-3">
				<p class="text-sm text-muted italic">{imp.summary}</p>

				<div class="space-y-3">
					{#each groups as group, gi (gi)}
						<div>
							<p class="text-xs font-semibold tracking-wide text-muted uppercase">
								{group.label ? `${group.label} — ` : ''}{ruleHint(group)}
							</p>
							<div class="mt-1">
								{#each group.slots as s (s.key)}
									{@render slotRow(imp.id, st, s)}
								{/each}
								{#if group.orAll}
									<p class="py-1 text-xs font-medium text-muted">— or all of —</p>
									{#each group.orAll as s (s.key)}
										{@render slotRow(imp.id, st, s)}
									{/each}
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<div class="rounded border border-border bg-surface/50 p-2 text-sm">
					<span class="text-xs font-semibold tracking-wide text-muted uppercase">Effects</span>
					<div class="mt-1"><Markdown text={imp.effects} /></div>
				</div>

				<label
					class="flex cursor-pointer items-center gap-2 text-sm font-medium {met || st.completed
						? ''
						: 'text-muted'}"
				>
					<input
						type="checkbox"
						checked={st.completed}
						onchange={(e) => complete(imp.id, e.currentTarget.checked)}
						class="h-4 w-4 rounded border-border text-accent focus:ring-accent"
					/>
					Mark complete{#if !met && !st.completed}<span class="text-xs text-muted"
							>(requirements not yet met)</span
						>{/if}
				</label>
			</div>
		</details>
	{/each}
</div>
