<!--
	The generic wizard shell. Renders a game module's ordered steps one at a
	time with a progress bar and Back/Next, autosaving the working draft to
	localStorage so a half-built entity survives a reload. It knows nothing
	about the draft's shape or the game's rules — it holds the draft opaquely as
	a plain record and hands it to the step components, which read the content
	pack. See docs/architecture.md.

	Alongside the step it renders the choices-so-far rail, fed by the entity
	type's optional `summary(draft)` hook: the game returns already-human rows,
	the shell lays them out and links each back to the step that owns it.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import type { WizardStep, WizardSummary, WizardSummarySection } from './types';
	import { clampIndex, isFirst, isLast, nextIndex, prevIndex, progress } from './navigation';
	import { draftKey, loadDraft, saveDraft } from './autosave';

	type Draft = Record<string, unknown>;

	let {
		steps,
		initialDraft,
		gameId,
		entityType = 'character',
		draftId = 'current',
		summary,
		onFinish
	}: {
		steps: readonly WizardStep[];
		/** Opaque to the shell (the game's entity shape); held as a record. */
		initialDraft: object;
		gameId: string;
		entityType?: string;
		draftId?: string;
		/** The game's choices-so-far provider. Absent → no rail. */
		summary?: WizardSummary;
		onFinish?: (draft: object) => void;
	} = $props();

	let index = $state(0);
	// Seed the working draft once from the prop; the wizard owns it thereafter
	// (autosave hydration below may replace it). Intentional one-time capture.
	// svelte-ignore state_referenced_locally
	let draft = $state<Draft>(initialDraft as Draft);
	let hydrated = $state(false);

	const key = $derived(draftKey(gameId, entityType, draftId));
	const count = $derived(steps.length);
	const current = $derived(steps[clampIndex(index, count)]);

	// Restore any autosaved draft once, in the browser, before autosave arms.
	$effect(() => {
		if (hydrated || !browser) return;
		const saved = loadDraft<Draft>(localStorage, key);
		if (saved) draft = saved;
		hydrated = true;
	});

	// Debounced autosave of the current draft.
	$effect(() => {
		if (!browser || !hydrated) return;
		const snapshot = $state.snapshot(draft);
		const t = setTimeout(() => saveDraft(localStorage, key, snapshot), 300);
		return () => clearTimeout(t);
	});

	// The rail's rows. The provider may be async (it reads the content pack), so
	// resolve into state and drop a result that a newer draft has overtaken.
	let sections = $state<readonly WizardSummarySection[]>([]);
	$effect(() => {
		if (!summary) return;
		const snapshot = $state.snapshot(draft);
		let alive = true;
		void Promise.resolve(summary(snapshot))
			.then((next) => alive && (sections = next))
			.catch(() => alive && (sections = []));
		return () => (alive = false);
	});

	function update(patch: Partial<Draft>): void {
		draft = { ...draft, ...patch };
	}

	function goTo(stepId: string): void {
		const target = steps.findIndex((s) => s.id === stepId);
		if (target >= 0) index = target;
	}

	function back(): void {
		index = prevIndex(index, count);
	}

	function forward(): void {
		if (isLast(index, count)) onFinish?.($state.snapshot(draft));
		else index = nextIndex(index, count);
	}
</script>

{#snippet rail()}
	<dl class="space-y-3 text-sm">
		{#each sections as section (section.title)}
			<div>
				<dt class="text-xs font-semibold tracking-wide text-muted uppercase">{section.title}</dt>
				{#each section.items as item (item.label)}
					<dd class="mt-1 flex items-baseline justify-between gap-2">
						<span class="text-muted">{item.label}</span>
						{#if item.stepId}
							<button
								type="button"
								onclick={() => goTo(item.stepId!)}
								class="rounded text-right underline decoration-dotted underline-offset-2 hover:text-accent"
								title="Go to {item.label}"
							>
								{item.value || 'Not chosen yet'}
							</button>
						{:else}
							<span class="text-right">{item.value || '—'}</span>
						{/if}
					</dd>
				{/each}
			</div>
		{/each}
	</dl>
{/snippet}

<div class="mx-auto max-w-5xl">
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

		<div class="gap-8 lg:grid lg:grid-cols-[1fr_16rem]">
			<div class="min-w-0">
				{#if sections.length > 0}
					<!-- Mobile: the rail folds away rather than pushing the step off-screen. -->
					<details class="mb-6 rounded-lg border border-border bg-surface p-4 lg:hidden">
						<summary class="cursor-pointer text-sm font-medium">Your choices so far</summary>
						<div class="mt-3">{@render rail()}</div>
					</details>
				{/if}

				{#key current.id}
					{@const StepComponent = current.component}
					<StepComponent {draft} {update} {goTo} />
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
			</div>

			{#if sections.length > 0}
				<aside class="hidden lg:block">
					<div class="sticky top-6 rounded-lg border border-border bg-surface p-4">
						<h2 class="mb-3 text-sm font-semibold">Your choices so far</h2>
						{@render rail()}
					</div>
				</aside>
			{/if}
		</div>
	{/if}
</div>
