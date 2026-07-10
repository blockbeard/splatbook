<!--
	Stonetop play mode: the editable, at-the-table view of a finished character.
	Tap-to-mark HP, XP, and move-trackers; toggle stat debilities. Every edit runs
	a pure engine function and hands the new character up via `onChange`, which the
	route autosaves. Read-only rules text stays on the printed sheet; this screen
	is just the live state a player pokes at during a session.
-->
<script lang="ts">
	import type { PlayProps } from '$lib/games/types';
	import type { Playbook } from '../pack-schemas';
	import {
		STAT_KEYS,
		canLevelUp,
		debilityName,
		effectiveStat,
		enterPlay,
		isDebilitated,
		markXp,
		setDebility,
		setHp,
		setTrackerMarks,
		xpForNextLevel,
		type StatKey,
		type StonetopCharacter
	} from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';

	let { character, onChange }: PlayProps = $props();
	const c = $derived(character as StonetopCharacter);

	let playbook = $state<Playbook | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		const id = c.playbookId;
		if (!id) return;
		let alive = true;
		fetchPlaybook(id, fetch)
			.then((p) => alive && (playbook = p))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// Seed vitals + sync trackers once the playbook is known. `enterPlay` is
	// idempotent, so this emits exactly once (and re-syncs trackers if the move
	// set later changes, e.g. on level up) without looping.
	$effect(() => {
		if (!playbook) return;
		const prepared = enterPlay(c, playbook);
		if (JSON.stringify(prepared) !== JSON.stringify(c)) onChange(prepared);
	});

	const emit = (next: StonetopCharacter | undefined): void => {
		if (next) onChange(next);
	};

	/** Tap the i-th box: fill up to it, or clear back to it if it's already the top. */
	const tapTo = (current: number, i: number): number => (current === i + 1 ? i : i + 1);

	const setCurrentHp = (i: number): void => emit(setHp(c, tapTo(c.hp.current, i)));
	const setXp = (i: number): void => emit(markXp(c, tapTo(c.xp, i) - c.xp));
	const markTracker = (id: string, boxes: number, marked: number, i: number): void =>
		emit(setTrackerMarks(c, id, tapTo(marked, i)));
	const toggleDebility = (stat: StatKey): void =>
		emit(setDebility(c, stat, !isDebilitated(c, stat)));

	const fmt = (n: number | undefined): string =>
		n === undefined ? '—' : n >= 0 ? `+${n}` : `${n}`;

	const xpNeeded = $derived(xpForNextLevel(c.level));
	const xpBoxes = $derived(Math.max(xpNeeded, c.xp));
	const readyToLevel = $derived(canLevelUp(c));
	const trackerEntries = $derived(Object.entries(c.trackers));
</script>

{#snippet boxRow(count: number, filled: number, tap: (i: number) => void, label: string)}
	<div class="flex flex-wrap gap-1" role="group" aria-label={label}>
		{#each Array(count) as _, i (i)}
			<button
				type="button"
				onclick={() => tap(i)}
				aria-pressed={i < filled}
				aria-label={`${label}: ${i + 1}`}
				class="h-6 w-6 rounded-sm border border-border transition-colors {i < filled
					? 'bg-accent'
					: 'bg-surface hover:bg-border'}"
			></button>
		{/each}
	</div>
{/snippet}

{#if loadError}
	<p class="text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="text-muted">Loading…</p>
{:else}
	<article class="mx-auto max-w-3xl space-y-8">
		<header class="border-b-2 border-accent pb-3">
			<h1 class="text-3xl font-bold tracking-tight">{c.name || 'Unnamed'}</h1>
			<p class="text-lg text-muted">{playbook.name} · Level {c.level}</p>
		</header>

		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">HP</h2>
				<span class="font-mono text-sm text-muted">{c.hp.current} / {c.hp.max}</span>
			</div>
			<div class="mt-2">
				{@render boxRow(c.hp.max, c.hp.current, setCurrentHp, 'HP')}
			</div>
		</section>

		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">Stats</h2>
				<span class="text-sm text-muted">Tap a stat to mark its debility</span>
			</div>
			<div class="mt-2 flex flex-wrap gap-3">
				{#each STAT_KEYS as stat (stat)}
					{#if c.stats[stat]}
						{@const deb = isDebilitated(c, stat)}
						<button
							type="button"
							onclick={() => toggleDebility(stat)}
							aria-pressed={deb}
							class="min-w-16 rounded-md border px-3 py-2 text-center transition-colors {deb
								? 'border-danger bg-danger/10'
								: 'border-border hover:bg-surface'}"
						>
							<div class="font-mono text-xl font-bold">{fmt(effectiveStat(c, stat))}</div>
							<div class="text-xs font-medium text-muted">{stat}</div>
							{#if deb}
								<div class="text-[0.65rem] text-danger">
									{debilityName(playbook, stat) ?? 'debilitated'}
								</div>
							{/if}
						</button>
					{/if}
				{/each}
			</div>
		</section>

		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">XP</h2>
				<span class="font-mono text-sm text-muted">{c.xp} / {xpNeeded} to level</span>
			</div>
			<div class="mt-2">
				{@render boxRow(xpBoxes, c.xp, setXp, 'XP')}
			</div>
			{#if readyToLevel}
				<p class="mt-2 text-sm font-medium text-accent">Ready to Level Up.</p>
			{/if}
		</section>

		{#if trackerEntries.length}
			<section>
				<h2 class="text-lg font-semibold">Trackers</h2>
				<div class="mt-2 space-y-3">
					{#each trackerEntries as [id, t] (id)}
						<div>
							<div class="text-sm font-medium">{t.label}</div>
							<div class="mt-1">
								{@render boxRow(
									t.boxes,
									t.marked,
									(i) => markTracker(id, t.boxes, t.marked, i),
									t.label
								)}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</article>
{/if}
