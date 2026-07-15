<!--
	Dice roller — generic shell UI over the dice core (`$lib/dice`). Given a
	game's dice presets (the `GameModule.dice` slot), it shows a button per preset
	and the advantage/disadvantage switch, so no game vocabulary lives here: the
	labels are the game's words, the notation is what the engine parses.

	Commit 107 adds two pieces that are shell-generic rather than game-specific,
	so they live here rather than in any `DiceModule`: a base row covering the
	whole standard polyhedral set (d4–d20, plus 2d6 for the PbtA crowd) — useful
	for a damage roll, a percentile check, or anything a game's own presets don't
	cover — and a small signed bonus box. The bonus is a controlled value (the
	host owns it, same as `mode` is owned here): "applies to the next roll" means
	whatever rolls next, from *any* trigger — a base die, a game preset, or a stat
	tapped straight on the sheet — not just this panel's own buttons, so the host
	is where it has to be consumed.

	It does not roll. The host does — the same `roll()` a game's sheet calls when
	you tap a stat — so that a roll made here and a roll made from the sheet land
	in one place: one result surface, one campaign log. This component is the
	button panel and the session's recent list.

	A preset's `meta.stat` names a character stat the host resolves into the
	modifier at roll time; a host without a character (no `resolve`) rolls the
	bare notation.
-->
<script lang="ts">
	import { formatSigned, type DicePreset, type RollMode, type RollResult } from '$lib/dice';

	interface RollEntry {
		label: string;
		result: RollResult;
		key: number;
	}

	let {
		presets,
		onRoll,
		bonus,
		onBonusChange,
		recent = [],
		logged = false
	}: {
		presets: readonly DicePreset[];
		/** Ask the host to roll this preset in this mode. */
		onRoll: (preset: DicePreset, mode: RollMode) => void;
		/** The bonus armed for the next roll — the host owns and consumes it. */
		bonus: number;
		onBonusChange: (next: number) => void;
		/** This session's rolls, newest first — supplied by the host. */
		recent?: readonly RollEntry[];
		/** True when rolls are being written to a shared campaign log (shows a hint). */
		logged?: boolean;
	} = $props();

	let mode = $state<RollMode>('normal');

	const modes: { value: RollMode; label: string; hint: string }[] = [
		{ value: 'disadvantage', label: 'Disadv', hint: 'Roll an extra die, keep the worst' },
		{ value: 'normal', label: 'Normal', hint: 'Straight roll' },
		{ value: 'advantage', label: 'Adv', hint: 'Roll an extra die, keep the best' }
	];

	/** The standard set, always available regardless of what any game contributes
	 * — none of these need a `meta.stat` resolved, so the host rolls them bare. */
	const BASE_DICE: DicePreset[] = [
		{ id: 'base-d4', label: 'd4', notation: '1d4' },
		{ id: 'base-d6', label: 'd6', notation: '1d6' },
		{ id: 'base-d8', label: 'd8', notation: '1d8' },
		{ id: 'base-d10', label: 'd10', notation: '1d10' },
		{ id: 'base-d12', label: 'd12', notation: '1d12' },
		{ id: 'base-d20', label: 'd20', notation: '1d20' },
		{ id: 'base-2d6', label: '2d6', notation: '2d6' }
	];

	function onBonusInput(value: string): void {
		const n = Number(value);
		onBonusChange(Number.isFinite(n) ? Math.trunc(n) : 0);
	}
</script>

<section class="rounded-lg border border-border bg-surface p-4" aria-label="Dice roller">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-text">Dice</h2>
		<div class="flex items-center gap-3">
			<label class="flex items-center gap-1.5 text-xs text-muted">
				Bonus
				<input
					type="number"
					value={bonus}
					oninput={(e) => onBonusInput(e.currentTarget.value)}
					title="Applies once, to the next roll"
					class="w-14 rounded-md border border-border bg-bg px-1.5 py-1 text-right text-sm text-text focus:border-accent focus:ring-0 focus:outline-none"
				/>
			</label>
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
	</div>

	{#if bonus !== 0}
		<p class="mb-2 text-xs text-accent">
			Bonus {formatSigned(bonus)} armed for your next roll.
		</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		{#each BASE_DICE as preset (preset.id)}
			<button
				type="button"
				onclick={() => onRoll(preset, mode)}
				class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-bg"
			>
				{preset.label}
			</button>
		{/each}
	</div>

	{#if presets.length}
		<div class="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
			{#each presets as preset (preset.id)}
				<button
					type="button"
					onclick={() => onRoll(preset, mode)}
					class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-bg"
				>
					{preset.label}
				</button>
			{/each}
		</div>
	{/if}

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
								>{/if}{#if r.result.bonus !== 0}<span class="text-accent"
									>{` bonus ${formatSigned(r.result.bonus)}`}</span
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
