<!--
	The result of a roll, where you can see it.

	Rolling from a stat halfway down a long sheet used to put the answer in the
	dice panel at the bottom — off-screen, which is no answer at all. This floats
	the latest roll over the page until it's read, then fades. It's shell UI over
	the dice core: it renders a `RollResult` (dropped dice struck through) and
	whatever label the game gave the roll; it knows no game vocabulary.

	Whether the roll also went to a shared log is the host's business — pass
	`logged` and this says so. Commit 109: an entry may also carry `onMiss` — a
	follow-up the game armed in case this roll totalled 6 or less. This
	component still doesn't know what running it *does* (that's the game's
	business, reached through the closure it handed the host), only that a
	pending one means "wait for the player" instead of fading on a timer, and
	that running it earns a quick confirmation before the normal fade resumes.
-->
<script lang="ts">
	import { formatSigned, type RollResult } from '$lib/dice';

	interface Entry {
		label: string;
		result: RollResult;
		actorName?: string;
		key: number;
		onMiss?: { label: string; action: () => void };
	}

	let {
		entry,
		logged = false,
		onDismiss
	}: {
		/** The roll to show; `null` shows nothing. */
		entry: Entry | null;
		/** True when the roll was written to a campaign's shared log. */
		logged?: boolean;
		onDismiss: () => void;
	} = $props();

	// Confirmation shown after the miss follow-up runs — reset whenever a new
	// entry arrives, so a fresh roll never inherits the last one's "done".
	let marked = $state(false);
	$effect(() => {
		if (entry) marked = false;
	});

	function runOnMiss(): void {
		entry?.onMiss?.action();
		marked = true;
	}

	// Each roll gets its own timer, keyed on the entry, so a fresh roll restarts
	// the countdown rather than inheriting the last one's. A pending miss
	// follow-up holds the surface open — "waits to be dismissed" rather than
	// fading unread — until the player runs it (then a short confirmation
	// window) or dismisses it outright.
	$effect(() => {
		if (!entry) return;
		if (entry.onMiss && !marked) return;
		const key = entry.key;
		const ms = marked ? 3000 : 6000;
		const t = setTimeout(() => key === entry?.key && onDismiss(), ms);
		return () => clearTimeout(t);
	});
</script>

{#if entry}
	<div
		class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm sm:inset-x-auto sm:right-6 sm:bottom-6"
		aria-live="polite"
		aria-label="Roll result"
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
						>{/if}{#if entry.result.bonus !== 0}<span class="text-accent"
							>{` bonus ${formatSigned(entry.result.bonus)}`}</span
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

			{#if entry.onMiss}
				<div class="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
					{#if marked}
						<p class="text-xs font-medium text-accent">✓ Marked.</p>
					{:else}
						<button
							type="button"
							onclick={runOnMiss}
							class="rounded-md border border-accent px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
						>
							{entry.onMiss.label}
						</button>
					{/if}
				</div>
			{/if}

			{#if logged}
				<p class="mt-1 text-xs text-muted">Shared to your campaign log.</p>
			{/if}
		</div>
	</div>
{/if}
