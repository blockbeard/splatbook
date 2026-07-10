<!--
	The Stonetop character sheet: chosen options only, laid out like the printed
	playbook. Reads a finished/draft character, loads its playbook for names and
	move text, and renders cleanly for screen and print (see the page's print
	CSS). No editing here — this is the read view.
-->
<script lang="ts">
	import type { SheetProps } from '$lib/games/types';
	import type { Move, Playbook } from '../pack-schemas';
	import {
		STAT_KEYS,
		isWriteInPossession,
		startingMovesPlan,
		type StonetopCharacter
	} from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';
	import { toExportJSON, toMarkdown, exportFilename } from '../export';
	import Markdown from '../wizard/components/Markdown.svelte';

	let { character }: SheetProps = $props();
	const c = $derived(character as StonetopCharacter);

	/** Trigger a client-side download of some text as a file. */
	function download(filename: string, text: string, mime: string): void {
		const url = URL.createObjectURL(new Blob([text], { type: mime }));
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	const exportJSON = () => download(exportFilename(c, 'json'), toExportJSON(c), 'application/json');
	const exportMarkdown = () =>
		download(exportFilename(c, 'md'), toMarkdown(c, playbook), 'text/markdown');

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

	const moveById = $derived(
		new Map<string, Move>(playbook?.moves.list.map((m) => [m.id, m]) ?? [])
	);
	const background = $derived(playbook?.backgrounds.find((b) => b.id === c.backgroundId) ?? null);

	const instinctLabel = $derived.by(() => {
		const inst = playbook?.instincts.find((i) => i.id === c.instinctId);
		return inst?.custom ? c.instinctWriteIn : (inst?.name ?? '');
	});

	const moves = $derived.by(() => {
		if (!playbook) return [];
		const plan = startingMovesPlan(c, playbook);
		const ids = [...new Set([...plan.granted, ...c.moves])];
		return ids.map((id) => moveById.get(id)).filter((m): m is Move => Boolean(m));
	});

	const possessions = $derived(
		c.possessions.map((id) =>
			isWriteInPossession(id) ? (c.possessionChoices[id]?.writeIn ?? '—') : id
		)
	);

	const fmt = (n: number | undefined): string =>
		n === undefined ? '—' : n >= 0 ? `+${n}` : `${n}`;
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="text-muted">Loading…</p>
{:else}
	<article class="character-sheet mx-auto max-w-3xl">
		<header class="border-b-2 border-accent pb-3">
			<h1 class="text-3xl font-bold tracking-tight">{c.name || 'Unnamed'}</h1>
			<p class="text-lg text-muted">
				{playbook.name}{background ? ` · ${background.name}` : ''}
			</p>
			<p class="mt-1 text-sm text-muted">
				{#if instinctLabel}<span>Instinct: {instinctLabel}</span>{/if}
				{#if c.origin.option}<span class="ml-3">Origin: {c.origin.option}</span>{/if}
				{#if c.appearance.filter(Boolean).length}<span class="ml-3"
						>{c.appearance.filter(Boolean).join(', ')}</span
					>{/if}
			</p>
			<div class="sheet-export mt-3 flex items-center gap-2 text-sm">
				<span class="text-muted">Export:</span>
				<button
					type="button"
					onclick={exportJSON}
					class="rounded border border-border px-2 py-0.5 text-muted hover:text-text"
				>
					JSON
				</button>
				<button
					type="button"
					onclick={exportMarkdown}
					class="rounded border border-border px-2 py-0.5 text-muted hover:text-text"
				>
					Markdown
				</button>
			</div>
		</header>

		<section class="mt-4 flex flex-wrap gap-x-6 gap-y-2">
			{#each STAT_KEYS as stat (stat)}
				<div class="text-center">
					<div class="font-mono text-xl font-bold">{fmt(c.stats[stat]?.value)}</div>
					<div class="text-xs font-medium text-muted">{stat}</div>
				</div>
			{/each}
			<div class="text-center">
				<div class="font-mono text-xl font-bold">{playbook.base.maxHp}</div>
				<div class="text-xs font-medium text-muted">Max HP</div>
			</div>
			<div class="text-center">
				<div class="font-mono text-xl font-bold">{playbook.base.damage}</div>
				<div class="text-xs font-medium text-muted">Damage</div>
			</div>
		</section>

		<section class="mt-6">
			<h2 class="text-lg font-semibold">Moves</h2>
			<div class="mt-2 space-y-3">
				{#each moves as move (move.id)}
					<div>
						<h3 class="font-semibold">{move.name}</h3>
						<div class="text-sm text-muted"><Markdown text={move.text} /></div>
					</div>
				{/each}
			</div>
		</section>

		{#if background?.grants?.notes?.length}
			<section class="mt-6">
				<h2 class="text-lg font-semibold">{background.name}</h2>
				<ul class="mt-2 list-disc pl-5 text-sm text-muted">
					{#each background.grants.notes as note (note)}
						<li><Markdown text={note} inline /></li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if possessions.length}
			<section class="mt-6">
				<h2 class="text-lg font-semibold">Possessions</h2>
				<ul class="mt-2 list-disc pl-5 text-sm">
					{#each playbook.possessions.fixed ?? [] as item (item.name)}
						<li class="text-muted">{item.name}</li>
					{/each}
					{#each possessions as name (name)}
						<li>{name}</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if c.introductions && Object.values(c.introductions).some((v) => v?.trim())}
			<section class="mt-6">
				<h2 class="text-lg font-semibold">Introductions</h2>
				<ul class="mt-2 space-y-1 text-sm text-muted">
					{#each Object.entries(c.introductions) as [n, note] (n)}
						{#if note?.trim()}<li>{note}</li>{/if}
					{/each}
				</ul>
			</section>
		{/if}
	</article>
{/if}

<style>
	/* The export buttons are screen-only; keep them out of the printed sheet. */
	@media print {
		.sheet-export {
			display: none;
		}
	}
</style>
