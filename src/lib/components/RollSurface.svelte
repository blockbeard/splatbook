<!--
	The result of a roll, where you can see it.

	Rolling from a stat halfway down a long sheet used to put the answer in the
	dice panel at the bottom — off-screen, which is no answer at all. This floats
	the latest roll over the page until it's read, then fades. It's shell UI over
	the dice core: it renders a `RollResult` (dropped dice struck through) and
	whatever label the game gave the roll; it knows no game vocabulary.

	Whether the roll also went to a shared log is the host's business — pass
	`logged` and this says so.
-->
<script lang="ts">
	import type { RollResult } from '$lib/dice';

	let {
		entry,
		logged = false,
		onDismiss
	}: {
		/** The roll to show; `null` shows nothing. */
		entry: { label: string; result: RollResult; actorName?: string; key: number } | null;
		/** True when the roll was written to a campaign's shared log. */
		logged?: boolean;
		onDismiss: () => void;
	} = $props();

	// Each roll gets its own timer, keyed on the entry, so a fresh roll restarts
	// the countdown rather than inheriting the last one's.
	$effect(() => {
		if (!entry) return;
		const key = entry.key;
		const t = setTimeout(() => key === entry?.key && onDismiss(), 6000);
		return () => clearTimeout(t);
	});
</script>

{#if entry}
	<div
		class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm sm:inset-x-auto sm:right-6 sm:bottom-6"
		aria-live="polite"
	>
		<div class="rounded-lg border border-accent bg-surface p-4 shadow-lg">
			<div class="flex items-baseline justify-between gap-4">
				<div class="min-w-0">
					{#if entry.actorName}
						<p class="truncate font-semibold">{entry.actorName}</p>
					{/if}
					<p class="truncate text-sm text-muted">
						{entry.label}
						{#if entry.result.mode !== 'normal'}
							<span class="text-xs">({entry.result.mode})</span>
						{/if}
					</p>
				</div>
				<p class="font-mono text-3xl font-bold text-accent">{entry.result.total}</p>
			</div>

			<div class="mt-2 flex items-baseline justify-between gap-3">
				<p class="font-mono text-xs text-muted">
					{#each entry.result.dice as d, i (i)}<span class={d.kept ? '' : 'line-through'}
							>{d.value}</span
						>{i < entry.result.dice.length - 1
							? ' '
							: ''}{/each}{#if entry.result.modifier !== 0}<span
							>{entry.result.modifier > 0
								? ` + ${entry.result.modifier}`
								: ` − ${-entry.result.modifier}`}</span
						>{/if}
				</p>
				<button
					type="button"
					onclick={onDismiss}
					class="text-xs text-muted underline hover:text-text"
				>
					Dismiss
				</button>
			</div>

			{#if logged}
				<p class="mt-1 text-xs text-muted">Shared to your campaign log.</p>
			{/if}
		</div>
	</div>
{/if}
