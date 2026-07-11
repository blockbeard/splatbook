<!--
	Dice roller — generic shell UI over the dice core (`$lib/dice`). Given a
	game's dice presets (the `GameModule.dice` slot), it shows a button per preset
	and rolls it with the shell engine, so no game vocabulary lives here: the
	labels are the game's words, the notation is what the engine parses.

	Rolling always shows a local result (newest first, with dropped dice struck
	through for advantage/disadvantage). If `onRoll` is supplied the roll is also
	handed up — the play page persists it to the campaign log when the character
	belongs to a campaign; without one, the roll stays local. The three-way
	advantage/disadvantage switch maps to the engine's `mode`.
-->
<script lang="ts">
	import { roll, type DicePreset, type RollMode, type RollResult } from '$lib/dice';

	interface RollEntry {
		label: string;
		result: RollResult;
	}

	let {
		presets,
		onRoll,
		logged = false
	}: {
		presets: readonly DicePreset[];
		/** Called with each roll; the shell decides whether to persist it. */
		onRoll?: (entry: RollEntry) => void;
		/** True when rolls are being written to a shared campaign log (shows a hint). */
		logged?: boolean;
	} = $props();

	let mode = $state<RollMode>('normal');
	// Recent rolls this session, newest first — immediate feedback; the shared
	// log (with everyone's rolls) is the campaign view.
	let recent = $state<(RollEntry & { key: number })[]>([]);
	let nextKey = 0;

	const modes: { value: RollMode; label: string; hint: string }[] = [
		{ value: 'disadvantage', label: 'Disadv', hint: 'Roll an extra die, keep the worst' },
		{ value: 'normal', label: 'Normal', hint: 'Straight roll' },
		{ value: 'advantage', label: 'Adv', hint: 'Roll an extra die, keep the best' }
	];

	function doRoll(preset: DicePreset): void {
		const result = roll(preset.notation, { mode });
		const entry: RollEntry = { label: preset.label, result };
		recent = [{ ...entry, key: nextKey++ }, ...recent].slice(0, 8);
		onRoll?.(entry);
	}
</script>

<section class="rounded-lg border border-border bg-surface p-4" aria-label="Dice roller">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-text">Dice</h2>
		<div
			class="inline-flex overflow-hidden rounded-md border border-border"
			role="group"
			aria-label="Roll mode"
		>
			{#each modes as m (m.value)}
				<button
					type="button"
					onclick={() => (mode = m.value)}
					title={m.hint}
					aria-pressed={mode === m.value}
					class="px-2 py-1 text-xs font-medium {mode === m.value
						? 'bg-accent text-accent-contrast'
						: 'text-muted hover:text-text'}"
				>
					{m.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each presets as preset (preset.id)}
			<button
				type="button"
				onclick={() => doRoll(preset)}
				class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-bg"
			>
				{preset.label}
			</button>
		{/each}
	</div>

	{#if recent.length}
		<ul class="mt-4 space-y-1.5 text-sm" aria-live="polite" aria-label="Recent rolls">
			{#each recent as r (r.key)}
				<li
					class="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 first:border-t-0 first:pt-0"
				>
					<span class="text-muted">
						{r.label}
						{#if r.result.mode !== 'normal'}
							<span class="text-xs">({r.result.mode})</span>
						{/if}
					</span>
					<span class="flex items-baseline gap-2">
						<span class="text-xs text-muted">
							{#each r.result.dice as d, i (i)}<span class={d.kept ? '' : 'line-through'}
									>{d.value}</span
								>{i < r.result.dice.length - 1 ? ' ' : ''}{/each}{#if r.result.modifier !== 0}<span
									>{r.result.modifier > 0
										? ` + ${r.result.modifier}`
										: ` − ${-r.result.modifier}`}</span
								>{/if}
						</span>
						<span class="min-w-6 text-right font-semibold text-text">{r.result.total}</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if logged}
		<p class="mt-3 text-xs text-muted">Rolls are shared to your campaign log.</p>
	{/if}
</section>
