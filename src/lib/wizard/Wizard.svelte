<!--
	The generic wizard shell. Renders a game module's ordered steps one at a
	time with a progress bar and Back/Next, autosaving the working draft to
	localStorage so a half-built entity survives a reload. It knows nothing
	about the draft's shape or the game's rules — those live in the step
	components and the content pack. See docs/architecture.md.
-->
<script lang="ts" generics="TDraft extends object">
	import { browser } from '$app/environment';
	import type { WizardStep } from './types';
	import { clampIndex, isFirst, isLast, nextIndex, prevIndex, progress } from './navigation';
	import { draftKey, loadDraft, saveDraft } from './autosave';

	let {
		steps,
		initialDraft,
		gameId,
		entityType = 'character',
		draftId = 'current',
		onFinish
	}: {
		steps: WizardStep<TDraft>[];
		initialDraft: TDraft;
		gameId: string;
		entityType?: string;
		draftId?: string;
		onFinish?: (draft: TDraft) => void;
	} = $props();

	let index = $state(0);
	// Seed the working draft once from the prop; the wizard owns it thereafter
	// (autosave hydration below may replace it). Intentional one-time capture.
	// svelte-ignore state_referenced_locally
	let draft = $state<TDraft>(initialDraft);
	let hydrated = $state(false);

	const key = $derived(draftKey(gameId, entityType, draftId));
	const count = $derived(steps.length);
	const current = $derived(steps[clampIndex(index, count)]);

	// Restore any autosaved draft once, in the browser, before autosave arms.
	$effect(() => {
		if (hydrated || !browser) return;
		const saved = loadDraft<TDraft>(localStorage, key);
		if (saved) draft = saved;
		hydrated = true;
	});

	// Debounced autosave of the current draft.
	$effect(() => {
		if (!browser || !hydrated) return;
		const snapshot = $state.snapshot(draft) as TDraft;
		const t = setTimeout(() => saveDraft(localStorage, key, snapshot), 300);
		return () => clearTimeout(t);
	});

	function update(patch: Partial<TDraft>): void {
		draft = { ...draft, ...patch };
	}

	function back(): void {
		index = prevIndex(index, count);
	}

	function forward(): void {
		if (isLast(index, count)) onFinish?.($state.snapshot(draft) as TDraft);
		else index = nextIndex(index, count);
	}
</script>

<div class="mx-auto max-w-3xl">
	{#if count === 0}
		<p class="text-muted">This builder has no steps yet.</p>
	{:else}
		<div class="mb-6">
			<div class="flex items-baseline justify-between text-sm text-muted">
				<span>{current.title}</span>
				<span>Step {clampIndex(index, count) + 1} of {count}</span>
			</div>
			<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
				<div
					class="h-full rounded-full bg-accent transition-all"
					style="width: {progress(index, count) * 100}%"
				></div>
			</div>
		</div>

		{#key current.id}
			{@const StepComponent = current.component}
			<StepComponent {draft} {update} />
		{/key}

		<div class="mt-8 flex items-center justify-between">
			<button
				type="button"
				onclick={back}
				disabled={isFirst(index)}
				class="rounded-md border border-border px-4 py-2 font-medium hover:bg-surface disabled:opacity-40"
			>
				Back
			</button>
			<button
				type="button"
				onclick={forward}
				class="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90"
			>
				{isLast(index, count) ? 'Finish' : 'Next'}
			</button>
		</div>
	{/if}
</div>
