<!--
	Arcana authoring (commit 105) — the GM's half of the ritual. Pick a party
	character, hand them a card (or add a mystery to one they already hold),
	write the mystery's text, and set how many marks unlock it. Edits build up
	as local state, same pattern as EndOfSession: an explicit Save writes the
	whole blob back through the shell's `save`, which re-checks server-side
	that this is the GM's own table before touching a character it doesn't own.
-->
<script lang="ts">
	import type { ArcanaGmProps } from '$lib/games/types';
	import {
		addArcanaCard,
		addArcanaSection,
		arcanaCardsOf,
		attachArcana,
		hasArcanaInsert,
		removeArcanaCard,
		removeArcanaSection,
		updateArcanaCard,
		updateArcanaSection,
		type StonetopCharacter
	} from '../engine';

	let { characters, save }: ArcanaGmProps = $props();

	let selectedId = $state<string | null>(characters[0]?.id ?? null);
	let draft = $state<StonetopCharacter | null>(null);
	let saving = $state(false);
	let saved = $state(false);
	let saveError = $state<string | null>(null);

	// Reload the draft whenever the GM switches characters — unsaved edits on
	// the previous one are lost, same as EndOfSession's per-character flow.
	$effect(() => {
		const found = characters.find((c) => c.id === selectedId);
		draft = found ? (found.data as StonetopCharacter) : null;
		saved = false;
		saveError = null;
	});

	function update(next: StonetopCharacter): void {
		draft = next;
		saved = false;
	}

	async function persist(): Promise<void> {
		if (!selectedId || !draft) return;
		saving = true;
		saveError = null;
		try {
			await save(selectedId, draft);
			saved = true;
		} catch {
			saveError = 'Save failed — try again.';
		} finally {
			saving = false;
		}
	}

	const cards = $derived(draft ? arcanaCardsOf(draft) : []);
</script>

<div class="space-y-6">
	<label class="block text-sm font-medium">
		Character
		<select
			value={selectedId}
			onchange={(e) => (selectedId = e.currentTarget.value)}
			class="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
		>
			{#each characters as c (c.id)}
				<option value={c.id}>{c.name}</option>
			{/each}
		</select>
	</label>

	{#if draft}
		{#if !hasArcanaInsert(draft)}
			<button
				type="button"
				onclick={() => update(attachArcana(draft!))}
				class="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
			>
				Attach Arcana
			</button>
		{:else}
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">Arcana</h2>
				<button
					type="button"
					onclick={() => update(addArcanaCard(draft!))}
					class="rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
				>
					+ Card
				</button>
			</div>

			{#each cards as card, cardIndex (cardIndex)}
				<div class="space-y-3 rounded-lg border border-border p-4">
					<div class="flex items-start justify-between gap-2">
						<input
							type="text"
							value={card.name}
							placeholder="Name"
							oninput={(e) =>
								update(updateArcanaCard(draft!, cardIndex, { name: e.currentTarget.value }))}
							class="flex-1 rounded border border-border bg-transparent px-2 py-1 font-semibold focus:border-accent focus:ring-0 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => update(removeArcanaCard(draft!, cardIndex))}
							class="shrink-0 rounded border border-border px-2 py-1 text-sm text-muted hover:text-danger"
						>
							Remove
						</button>
					</div>

					<label class="block text-xs text-muted">
						Mark boxes
						<input
							type="number"
							min="0"
							value={card.markBoxes}
							oninput={(e) =>
								update(
									updateArcanaCard(draft!, cardIndex, {
										markBoxes: Number(e.currentTarget.value) || 0
									})
								)}
							class="mt-0.5 w-24 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
					</label>

					<div class="space-y-2">
						<div class="flex items-baseline justify-between">
							<div class="text-xs font-medium text-muted">Mysteries</div>
							<button
								type="button"
								onclick={() => update(addArcanaSection(draft!, cardIndex))}
								class="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"
							>
								+ Mystery
							</button>
						</div>
						{#each card.sections as section, sectionIndex (sectionIndex)}
							<div class="space-y-2 rounded-md border border-border p-2">
								<div class="flex items-center gap-2">
									<input
										type="text"
										value={section.name}
										placeholder="Mystery name"
										oninput={(e) =>
											update(
												updateArcanaSection(draft!, cardIndex, sectionIndex, {
													name: e.currentTarget.value
												})
											)}
										class="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
									/>
									<label class="flex shrink-0 items-center gap-1 text-xs text-muted">
										Unlocks at
										<input
											type="number"
											min="0"
											value={section.unlockAt}
											oninput={(e) =>
												update(
													updateArcanaSection(draft!, cardIndex, sectionIndex, {
														unlockAt: Number(e.currentTarget.value) || 0
													})
												)}
											class="w-16 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
										/>
									</label>
									<button
										type="button"
										onclick={() => update(removeArcanaSection(draft!, cardIndex, sectionIndex))}
										class="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted hover:text-danger"
									>
										Remove
									</button>
								</div>
								<textarea
									value={section.text}
									placeholder="What the player reads once this unlocks…"
									oninput={(e) =>
										update(
											updateArcanaSection(draft!, cardIndex, sectionIndex, {
												text: e.currentTarget.value
											})
										)}
									rows="3"
									class="w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
								></textarea>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/if}

		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={persist}
				disabled={saving}
				class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
			{#if saved}
				<span class="text-sm text-muted">Saved</span>
			{/if}
			{#if saveError}
				<span class="text-sm text-danger">{saveError}</span>
			{/if}
		</div>
	{:else}
		<p class="text-muted">No character selected.</p>
	{/if}
</div>
