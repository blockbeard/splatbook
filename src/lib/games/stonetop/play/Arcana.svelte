<!--
	Arcana (commit 105): free-form cards, matching the paper ritual where the
	GM hands you a card. A card's mysteries are *sections*, GM-authored (see
	ArcanaGm.svelte, run from the campaign dashboard) and unlocked as marks
	accumulate. A locked section is invisible here by default — the campaign
	setting `showLockedArcana` (GM toggle, default off) decides whether this
	table prefers to see what's coming.
-->
<script lang="ts">
	import {
		addArcanaCard,
		arcanaCardsOf,
		isArcanaSectionUnlocked,
		removeArcanaCard,
		setArcanaMarked,
		updateArcanaCard,
		type StonetopCharacter
	} from '../engine';

	let {
		character,
		onChange,
		campaignId
	}: {
		character: StonetopCharacter;
		onChange: (next: StonetopCharacter) => void;
		campaignId?: string | null;
	} = $props();

	// The table's own preference for whether a not-yet-unlocked mystery shows
	// its text — some like the anticipation, some don't (commit 105). Loose
	// best-effort read: a character with no campaign, or a settings fetch that
	// fails, just falls back to the default (hidden).
	let showLocked = $state(false);
	$effect(() => {
		if (!campaignId) return;
		let alive = true;
		fetch(`/api/campaigns/${campaignId}/settings`)
			.then((r) => (r.ok ? r.json() : null))
			.then((s: { showLockedArcana?: boolean } | null) => {
				if (alive && s) showLocked = !!s.showLockedArcana;
			})
			.catch(() => {});
		return () => (alive = false);
	});

	const cards = $derived(arcanaCardsOf(character));
</script>

{#snippet markBoxes(cardIndex: number, marked: number, max: number)}
	<div class="flex flex-wrap gap-1" role="group" aria-label="Marks">
		{#each Array(max) as _, i (i)}
			<button
				type="button"
				onclick={() =>
					onChange(setArcanaMarked(character, cardIndex, marked === i + 1 ? i : i + 1))}
				aria-pressed={i < marked}
				aria-label={`Mark ${i + 1}`}
				class="h-5 w-5 rounded-full border border-border transition-colors {i < marked
					? 'bg-accent'
					: 'bg-surface hover:bg-border'}"
			></button>
		{/each}
	</div>
{/snippet}

<div class="space-y-6">
	<div class="flex items-baseline justify-between">
		<h2 class="text-lg font-semibold">Arcana</h2>
		<button
			type="button"
			onclick={() => onChange(addArcanaCard(character))}
			class="rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
		>
			+ Card
		</button>
	</div>

	{#if cards.length === 0}
		<p class="text-sm text-muted">
			No arcana yet. When the GM hands you a card — a strange artifact, a spell, a bargain — it
			lands here.
		</p>
	{/if}

	{#each cards as card, cardIndex (cardIndex)}
		<div class="space-y-3 rounded-lg border border-border p-4">
			<div class="flex items-start justify-between gap-2">
				<input
					type="text"
					value={card.name}
					placeholder="Name"
					oninput={(e) =>
						onChange(updateArcanaCard(character, cardIndex, { name: e.currentTarget.value }))}
					class="flex-1 rounded border border-border bg-transparent px-2 py-1 font-semibold focus:border-accent focus:ring-0 focus:outline-none"
				/>
				<button
					type="button"
					onclick={() => onChange(removeArcanaCard(character, cardIndex))}
					class="shrink-0 rounded border border-border px-2 py-1 text-sm text-muted hover:text-danger"
				>
					Remove
				</button>
			</div>

			<textarea
				value={card.notes}
				placeholder="Notes — what it is, what it looks like…"
				oninput={(e) =>
					onChange(updateArcanaCard(character, cardIndex, { notes: e.currentTarget.value }))}
				rows="2"
				class="w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
			></textarea>

			<div>
				<div class="text-xs font-medium text-muted">
					Marks ({card.marked}/{card.markBoxes})
				</div>
				<div class="mt-1">{@render markBoxes(cardIndex, card.marked, card.markBoxes)}</div>
			</div>

			{#if card.sections.some( (s) => isArcanaSectionUnlocked(card, s) ) || (showLocked && card.sections.length)}
				<div class="space-y-2">
					<div class="text-xs font-medium text-muted">Mysteries</div>
					{#each card.sections as section, sectionIndex (sectionIndex)}
						{@const unlocked = isArcanaSectionUnlocked(card, section)}
						{#if unlocked || showLocked}
							<div
								class="rounded-md border p-2 {unlocked
									? 'border-border'
									: 'border-dashed border-border opacity-60'}"
							>
								<div class="flex items-center gap-2 text-sm font-medium">
									{section.name || 'Untitled mystery'}
									{#if !unlocked}
										<span class="rounded bg-surface px-1.5 py-0.5 text-[0.65rem] text-muted"
											>Locked — {section.unlockAt} marks</span
										>
									{/if}
								</div>
								<p class="mt-1 text-sm text-muted">{section.text}</p>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
