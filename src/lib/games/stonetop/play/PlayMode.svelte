<!--
	Stonetop play mode: the editable, at-the-table view of a finished character.
	Tap-to-mark HP, XP, and move-trackers; toggle stat debilities. Every edit runs
	a pure engine function and hands the new character up via `onChange`, which the
	route autosaves. Read-only rules text stays on the printed sheet; this screen
	is just the live state a player pokes at during a session.
-->
<script lang="ts">
	import type { PlayProps } from '$lib/games/types';
	import type { Move, Playbook } from '../pack-schemas';
	import {
		STAT_KEYS,
		advancementLog,
		applyLevelUp,
		canCrossOffWouldBe,
		canLevelUp,
		crossOffWouldBe,
		debilityName,
		effectiveStat,
		enterPlay,
		heldMoveIds,
		isDebilitated,
		isWouldBeCrossed,
		levelUpChoices,
		movesRollStats,
		bankedXp,
		markXp,
		migrateCharacter,
		setDebility,
		setHp,
		setTrackerMarks,
		statAtCap,
		xpForNextLevel,
		type StatKey,
		type StonetopCharacter
	} from '../engine';
	import { rollForStat } from '../dice';
	import { fetchPlaybook } from '../pack/playbooks';
	import { fetchBasicMoves } from '../pack/moves';
	import Markdown from '../wizard/components/Markdown.svelte';
	import OptionButton from '../wizard/components/OptionButton.svelte';
	import Inventory from './Inventory.svelte';

	let { character, onChange, roll }: PlayProps = $props();
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

	// Migrate an older blob, then seed vitals + sync trackers once the playbook is
	// known. All three are idempotent, so this emits exactly once (and re-syncs
	// trackers if the move set later changes, e.g. on level up) without looping.
	$effect(() => {
		if (!playbook) return;
		const prepared = enterPlay(migrateCharacter(c), playbook);
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

	// Tapping a stat rolls it — the thing you do a hundred times a session. The
	// debility is a state you set occasionally, so it gets its own small control
	// rather than sharing the tap target.
	const rollStat = (stat: StatKey): void => {
		const { label, notation } = rollForStat(c, stat);
		roll?.(label, notation);
	};

	/** Roll a move: same 2d6+stat, labelled with the move so the log reads
	 * "Clash +STR (+1)" rather than a bare stat roll. */
	const rollMove = (move: { name: string }, stat: StatKey): void => {
		const { label, notation } = rollForStat(c, stat, move.name);
		roll?.(label, notation);
	};

	const fmt = (n: number | undefined): string =>
		n === undefined ? '—' : n >= 0 ? `+${n}` : `${n}`;

	const xpNeeded = $derived(xpForNextLevel(c.level));
	// Always leave one empty box past what's marked: the point that levels you
	// usually lands mid-session and the session keeps going, so there has to be
	// somewhere to put the next one. The surplus carries over the level-up.
	const xpBoxes = $derived(Math.max(xpNeeded, c.xp + 1));
	const banked = $derived(bankedXp(c));
	const readyToLevel = $derived(canLevelUp(c));
	const trackerEntries = $derived(Object.entries(c.trackers));
	const advLog = $derived(playbook ? advancementLog(c, playbook) : []);

	// The moves this character holds — starting, playbook picks and advancement —
	// in the playbook's own printed order.
	const myMoves = $derived.by(() => {
		if (!playbook) return [];
		const held = heldMoveIds(c, playbook);
		return playbook.moves.list.filter((m) => held.has(m.id));
	});

	// The basic moves everyone can make, from the pack.
	let basicMoves = $state<{ id: string; name: string; text: string }[]>([]);
	$effect(() => {
		let alive = true;
		fetchBasicMoves(fetch)
			.then((pack) => alive && (basicMoves = pack.moves))
			.catch(() => {
				// The basic moves are a convenience; failing to load them must not take
				// the sheet down with them.
			});
		return () => (alive = false);
	});

	// Level-up flow: open a panel of legal picks, choose one (and a stat, for
	// Improved/Superior Stat), confirm.
	let levelingUp = $state(false);
	let chosenMoveId = $state<string | null>(null);
	let chosenStat = $state<StatKey | null>(null);
	let levelUpError = $state<string | null>(null);

	const choices = $derived<Move[]>(playbook ? levelUpChoices(c, playbook) : []);
	const chosenMove = $derived<Move | null>(choices.find((m) => m.id === chosenMoveId) ?? null);
	const needsStat = $derived(Boolean(chosenMove?.statBump));

	const startLevelUp = (): void => {
		levelingUp = true;
		chosenMoveId = null;
		chosenStat = null;
		levelUpError = null;
	};
	const cancelLevelUp = (): void => {
		levelingUp = false;
		chosenMoveId = null;
		chosenStat = null;
	};
	const pickMove = (id: string): void => {
		chosenMoveId = id;
		chosenStat = null;
	};
	const confirmLevelUp = (): void => {
		if (!playbook || !chosenMoveId) return;
		const result = applyLevelUp(c, playbook, {
			moveId: chosenMoveId,
			stat: chosenStat ?? undefined
		});
		if (result.ok) {
			onChange(result.character);
			levelingUp = false;
			chosenMoveId = null;
			chosenStat = null;
			levelUpError = null;
		} else if (result.reason === 'not-enough-xp') {
			levelUpError = 'Not enough XP to Level Up.';
		} else if (result.reason === 'stat-required') {
			levelUpError = 'Choose which stat to raise.';
		} else if (result.reason === 'stat-capped') {
			levelUpError = 'That stat is already at its cap.';
		} else {
			levelUpError = 'That move isn’t available.';
		}
	};

	const crossOff = (): void => onChange(crossOffWouldBe(c));
	const showCrossOff = $derived(Boolean(playbook && canCrossOffWouldBe(c, playbook)));
	const heroCrossed = $derived(isWouldBeCrossed(c));
</script>

{#snippet moveCard(move: { id: string; name: string; text: string })}
	{@const stats = movesRollStats(move)}
	<div class="rounded-lg border border-border p-3">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<h4 class="font-semibold">{move.name}</h4>
			<!-- A move is rollable when its text says what it rolls. Defy Danger prints
			     six options, so it gets six buttons; Aid prints none, so it gets none. -->
			{#if roll && stats.length}
				<div class="flex flex-wrap gap-1">
					{#each stats as stat (stat)}
						<button
							type="button"
							onclick={() => rollMove(move, stat)}
							class="rounded-md border border-accent px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
						>
							Roll +{stat}
							<span class="font-mono">{fmt(effectiveStat(c, stat))}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="mt-1 text-sm text-muted"><Markdown text={move.text} /></div>
	</div>
{/snippet}

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
			<p class="text-lg text-muted">
				{playbook.name} · Level {c.level}{#if heroCrossed}<span
						class="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-contrast"
						>Hero</span
					>{/if}
			</p>
			{#if showCrossOff}
				<button
					type="button"
					onclick={crossOff}
					class="mt-2 rounded-md border border-accent px-3 py-1 text-sm font-medium text-accent hover:bg-accent/10"
				>
					Cross off “Would-be” — you’re a Hero now
				</button>
			{/if}
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
				<span class="text-sm text-muted">Tap a stat to roll it</span>
			</div>
			<div class="mt-2 flex flex-wrap gap-3">
				{#each STAT_KEYS as stat (stat)}
					{#if c.stats[stat]}
						{@const deb = isDebilitated(c, stat)}
						{@const name = debilityName(playbook, stat) ?? 'debilitated'}
						<div
							class="min-w-20 rounded-md border text-center transition-colors {deb
								? 'border-danger bg-danger/10'
								: 'border-border'}"
						>
							<button
								type="button"
								onclick={() => rollStat(stat)}
								disabled={!roll}
								class="w-full rounded-t-md px-3 pt-2 pb-1 hover:bg-surface disabled:hover:bg-transparent"
								title="Roll +{stat}"
							>
								<div class="font-mono text-xl font-bold">{fmt(effectiveStat(c, stat))}</div>
								<div class="text-xs font-medium text-muted">{stat}</div>
							</button>
							<!-- The debility: its own control, so marking one can't be mistaken for
							     rolling and rolling can't be mistaken for marking one. -->
							<button
								type="button"
								onclick={() => toggleDebility(stat)}
								aria-pressed={deb}
								title={deb ? `Clear ${name}` : `Mark ${name}`}
								class="w-full rounded-b-md border-t px-2 py-1 text-[0.65rem] transition-colors {deb
									? 'border-danger/40 text-danger'
									: 'border-border text-muted hover:bg-surface'}"
							>
								{deb ? name : 'Debility'}
							</button>
						</div>
					{/if}
				{/each}
			</div>
		</section>

		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">XP</h2>
				<!-- The separator carries its own spaces: Svelte trims whitespace at the
				     edges of a block, so " · " written as markup would come out glued on. -->
				<span class="font-mono text-sm text-muted">
					{c.xp} / {xpNeeded} to level{#if banked > 0}{` · ${banked} banked`}{/if}
				</span>
			</div>
			<div class="mt-2">
				{@render boxRow(xpBoxes, c.xp, setXp, 'XP')}
			</div>
			{#if readyToLevel && !levelingUp}
				<button
					type="button"
					onclick={startLevelUp}
					class="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
				>
					Level Up →
				</button>
			{/if}
		</section>

		{#if levelingUp}
			<section class="rounded-lg border border-accent bg-accent/5 p-4">
				<div class="flex items-baseline justify-between">
					<h2 class="text-lg font-semibold">Level Up to {c.level + 1}</h2>
					<span class="text-sm text-muted">Spends {xpNeeded} XP · choose a move</span>
				</div>

				{#if choices.length === 0}
					<p class="mt-3 text-sm text-muted">No legal moves to take right now.</p>
				{:else}
					<div class="mt-3 grid gap-3 sm:grid-cols-2">
						{#each choices as move (move.id)}
							<OptionButton selected={chosenMoveId === move.id} onclick={() => pickMove(move.id)}>
								<div class="font-semibold">{move.name}</div>
								<div class="mt-1 text-sm text-muted"><Markdown text={move.text} /></div>
							</OptionButton>
						{/each}
					</div>
				{/if}

				{#if needsStat && chosenMove?.statBump}
					<div class="mt-4">
						<p class="text-sm font-medium">
							Raise which stat? <span class="text-muted">(max +{chosenMove.statBump.cap})</span>
						</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each STAT_KEYS as stat (stat)}
								{#if c.stats[stat]}
									{@const capped = statAtCap(c, stat, chosenMove.statBump.cap)}
									<button
										type="button"
										onclick={() => (chosenStat = stat)}
										disabled={capped}
										aria-pressed={chosenStat === stat}
										class="rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 {chosenStat ===
										stat
											? 'border-accent bg-accent/10'
											: 'border-border hover:bg-surface'}"
									>
										{stat}
										<span class="font-mono text-muted">{fmt(effectiveStat(c, stat))}</span>
									</button>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				{#if levelUpError}
					<p class="mt-3 text-sm text-danger">{levelUpError}</p>
				{/if}

				<div class="mt-4 flex items-center gap-2">
					<button
						type="button"
						onclick={confirmLevelUp}
						disabled={!chosenMoveId || (needsStat && !chosenStat)}
						class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Confirm
					</button>
					<button
						type="button"
						onclick={cancelLevelUp}
						class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
					>
						Cancel
					</button>
				</div>
			</section>
		{/if}

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

		<!-- Your moves first, then the ones everyone has: at the table you reach for
		     your playbook's moves, and fall back to the basic ones. Both come from the
		     pack in the same shape, so both render — and roll — through one path. -->
		<section>
			<h2 class="text-lg font-semibold">Moves</h2>

			<div class="mt-2 space-y-3">
				{#each myMoves as move (move.id)}
					{@render moveCard(move)}
				{/each}
			</div>

			{#if basicMoves.length}
				<h3 class="mt-6 text-sm font-medium tracking-wide text-muted uppercase">Basic moves</h3>
				<div class="mt-2 space-y-3">
					{#each basicMoves as move (move.id)}
						{@render moveCard(move)}
					{/each}
				</div>
			{/if}
		</section>

		<section>
			<Inventory character={c} {onChange} />
		</section>

		{#if advLog.length}
			<section>
				<h2 class="text-lg font-semibold">Advancement</h2>
				<ul class="mt-2 space-y-1 text-sm text-muted">
					{#each advLog as entry, i (i)}
						<li>
							<span class="font-medium text-text">Level {entry.level}:</span>
							{entry.moveName}{#if entry.stat}<span class="text-muted">
									— +1 {entry.stat}</span
								>{/if}{#if entry.replacedName}<span class="text-muted">
									(replaced {entry.replacedName})</span
								>{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</article>
{/if}
