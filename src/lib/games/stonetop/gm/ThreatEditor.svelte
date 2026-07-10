<!--
	Stonetop threat worksheet editor — the play/editor component for the *threat*
	entity type. Like the steading it has no wizard: a threat is an editable
	worksheet from creation, following the GM playbook's write-up steps (name &
	type, tracker, instinct, description, impending doom + grim portents, optional
	stakes and moves). Every edit runs a pure engine function and hands the new
	threat up via `onChange`, which the route autosaves. The eight threat types and
	their move lists come from the GM pack, so a chosen type can offer its moves to
	drop into the worksheet.
-->
<script lang="ts">
	import type { PlayProps } from '$lib/games/types';
	import type { GmPlaybook } from '../pack-schemas';
	import {
		migrateThreat,
		setField,
		setGrimPortents,
		toggleGrimPortent,
		setList,
		THREAT_TRACKERS,
		THREAT_TRACKER_LABELS,
		type StonetopThreat,
		type ThreatTracker,
		type ThreatListKey,
		type GrimPortent
	} from '../engine/threat';
	import { fetchGmPack } from '../pack/gm';
	import EditableList from '../steading/EditableList.svelte';

	let { character, onChange }: PlayProps = $props();
	const s = $derived(character as StonetopThreat);

	let pack = $state<GmPlaybook | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchGmPack(fetch)
			.then((p) => alive && (pack = p))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// Bring an older blob up to shape once (idempotent — no-op for a fresh draft).
	$effect(() => {
		const migrated = migrateThreat(s);
		if (JSON.stringify(migrated) !== JSON.stringify(s)) onChange(migrated);
	});

	const types = $derived(pack?.threats.types ?? []);
	const selectedType = $derived(types.find((t) => t.id === s.threatType) ?? null);

	const setStr = (key: keyof StonetopThreat, value: string): void =>
		onChange(setField(s, key, value));
	const pickTracker = (tracker: ThreatTracker): void => onChange(setField(s, 'tracker', tracker));
	const editList = (key: ThreatListKey, items: string[]): void => onChange(setList(s, key, items));

	// Grim portents — text + a "has it occurred" mark.
	const addPortent = (): void =>
		onChange(setGrimPortents(s, [...s.grimPortents, { text: '', marked: false }]));
	const editPortent = (i: number, text: string): void =>
		onChange(
			setGrimPortents(
				s,
				s.grimPortents.map((g, j) => (j === i ? { ...g, text } : g))
			)
		);
	const removePortent = (i: number): void =>
		onChange(
			setGrimPortents(
				s,
				s.grimPortents.filter((_, j) => j !== i)
			)
		);
	const flipPortent = (i: number): void => onChange(toggleGrimPortent(s, i));

	const addMove = (move: string): void => {
		if (!s.moves.includes(move)) onChange(setList(s, 'moves', [...s.moves, move]));
	};

	const portents: GrimPortent[] = $derived(s.grimPortents);
</script>

<article class="mx-auto max-w-3xl space-y-8">
	<header class="border-b-2 border-accent pb-3">
		<label class="block">
			<span class="text-xs font-medium tracking-wide text-muted uppercase">Threat</span>
			<input
				type="text"
				value={s.name}
				oninput={(e) => setStr('name', e.currentTarget.value)}
				placeholder="Name this threat"
				class="mt-1 w-full border-0 border-b border-transparent bg-transparent text-3xl font-bold tracking-tight focus:border-accent focus:ring-0 focus:outline-none"
			/>
		</label>
	</header>

	{#if loadError}
		<p class="text-muted">Couldn’t load the GM pack: {loadError}</p>
	{/if}

	<section class="grid gap-4 sm:grid-cols-2">
		<div>
			<h2 class="text-sm font-semibold tracking-wide text-muted uppercase">Type</h2>
			<select
				value={s.threatType}
				onchange={(e) => setStr('threatType', e.currentTarget.value)}
				class="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
			>
				<option value="">— pick a type —</option>
				{#each types as type (type.id)}
					<option value={type.id}>{type.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<h2 class="text-sm font-semibold tracking-wide text-muted uppercase">Tracker</h2>
			<div class="mt-1 flex flex-wrap gap-2" role="group" aria-label="Threat tracker">
				{#each THREAT_TRACKERS as tracker (tracker)}
					<button
						type="button"
						onclick={() => pickTracker(tracker)}
						aria-pressed={s.tracker === tracker}
						class="rounded-md border px-3 py-1.5 text-sm transition-colors {s.tracker === tracker
							? 'border-accent bg-accent/10 font-medium'
							: 'border-border hover:bg-surface'}"
					>
						{THREAT_TRACKER_LABELS[tracker]}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<section>
		<label class="block">
			<span class="text-sm font-semibold">Instinct</span>
			<input
				type="text"
				value={s.instinct}
				oninput={(e) => setStr('instinct', e.currentTarget.value)}
				placeholder="to ___ (e.g. to enrich himself)"
				class="mt-1 w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			/>
		</label>
	</section>

	<section>
		<label class="block">
			<span class="text-sm font-semibold">Description</span>
			<textarea
				value={s.description}
				oninput={(e) => setStr('description', e.currentTarget.value)}
				rows="3"
				placeholder="What it is, related threats or NPCs…"
				class="mt-1 w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			></textarea>
		</label>
	</section>

	<section>
		<h2 class="text-lg font-semibold">Impending doom</h2>
		<p class="text-xs text-muted">
			If the threat has momentum: the ultimate bad thing, then its grim portents.
		</p>
		<textarea
			value={s.impendingDoom}
			oninput={(e) => setStr('impendingDoom', e.currentTarget.value)}
			rows="2"
			placeholder="The ultimate bad thing that happens if unchecked…"
			class="mt-2 w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:ring-0 focus:outline-none"
		></textarea>

		<h3 class="mt-4 text-sm font-semibold">Grim portents</h3>
		<span class="text-xs text-muted">Tick each as it comes to pass.</span>
		<ul class="mt-2 space-y-1">
			{#each portents as portent, i (i)}
				<li class="flex items-center gap-2">
					<input
						type="checkbox"
						checked={portent.marked}
						onchange={() => flipPortent(i)}
						aria-label="Mark grim portent {i + 1}"
						class="h-4 w-4 shrink-0 accent-[var(--sb-accent)]"
					/>
					<input
						type="text"
						value={portent.text}
						oninput={(e) => editPortent(i, e.currentTarget.value)}
						placeholder="A step toward the doom"
						class="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none {portent.marked
							? 'text-muted line-through'
							: ''}"
					/>
					<button
						type="button"
						onclick={() => removePortent(i)}
						aria-label="Remove grim portent"
						class="shrink-0 rounded border border-border px-2 py-1 text-sm text-muted hover:text-danger"
						>×</button
					>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			onclick={addPortent}
			class="mt-2 rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
		>
			+ Grim portent
		</button>
	</section>

	<section>
		<h2 class="text-lg font-semibold">Stakes questions</h2>
		<p class="text-xs text-muted">Optional — what's uncertain about this threat.</p>
		<div class="mt-2">
			<EditableList
				items={s.stakes}
				onChange={(items) => editList('stakes', items)}
				addLabel="Question"
				placeholder="A stakes question"
			/>
		</div>
	</section>

	<section>
		<h2 class="text-lg font-semibold">GM moves</h2>
		{#if selectedType}
			<p class="mt-1 text-xs text-muted">
				Add from the {selectedType.name} move list, or write your own below.
			</p>
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each selectedType.moves as move (move)}
					<button
						type="button"
						onclick={() => addMove(move)}
						disabled={s.moves.includes(move)}
						class="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-40"
					>
						+ {move}
					</button>
				{/each}
			</div>
		{/if}
		<div class="mt-2">
			<EditableList
				items={s.moves}
				onChange={(items) => editList('moves', items)}
				addLabel="Move"
				placeholder="A GM move"
			/>
		</div>
	</section>

	<section>
		<h2 class="text-lg font-semibold">Custom player moves</h2>
		<p class="text-xs text-muted">Optional — trigger + resolution for player-facing moves.</p>
		<div class="mt-2">
			<EditableList
				items={s.customMoves}
				onChange={(items) => editList('customMoves', items)}
				addLabel="Custom move"
				placeholder="When you…, …"
			/>
		</div>
	</section>
</article>
