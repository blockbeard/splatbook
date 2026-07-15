<!--
	Followers roster (commit 102), driven by `insert-followers.json`'s
	`followerBlock` — the generic, write-in insert every character can attach,
	as opposed to a playbook's own pre-built roster (Crew, Initiates of Danu,
	Animal Companion — commit 103). A follower is a free-text card: name,
	tags, HP/armor/damage, instinct, up to `moveLines` move write-ins, flags,
	cost, a Loyalty track, `gearLines` gear write-ins, and notes. Each edit
	runs a pure engine function and hands the new character up via `onChange`.
-->
<script lang="ts">
	import type { FollowersInsert } from '../pack-schemas';
	import {
		addFollower,
		followersOf,
		removeFollower,
		setFollowerLoyalty,
		toggleFollowerFlag,
		updateFollower,
		type StonetopCharacter
	} from '../engine';
	import { fetchFollowersInsert } from '../pack/inserts';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<FollowersInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchFollowersInsert(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const roster = $derived(followersOf(character));
</script>

{#snippet loyaltyBoxes(index: number, filled: number, max: number)}
	<div class="flex gap-1" role="group" aria-label="Loyalty">
		{#each Array(max) as _, i (i)}
			<button
				type="button"
				onclick={() =>
					onChange(setFollowerLoyalty(character, index, filled === i + 1 ? i : i + 1, max))}
				aria-pressed={i < filled}
				aria-label={`Loyalty: ${i + 1}`}
				class="h-5 w-5 rounded-sm border border-border transition-colors {i < filled
					? 'bg-accent'
					: 'bg-surface hover:bg-border'}"
			></button>
		{/each}
	</div>
{/snippet}

{#if loadError}
	<p class="text-muted">Couldn’t load the followers sheet: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-6">
		<div class="flex items-baseline justify-between">
			<h2 class="text-lg font-semibold">Followers</h2>
			<button
				type="button"
				onclick={() => onChange(addFollower(character, insert!))}
				class="rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-surface"
			>
				+ Follower
			</button>
		</div>

		{#if roster.length === 0}
			<p class="text-sm text-muted">
				No followers yet. NPCs who travel with you, fight for you, or serve you — add one when play
				makes it relevant.
			</p>
		{/if}

		{#each roster as follower, index (index)}
			<div class="space-y-3 rounded-lg border border-border p-4">
				<div class="flex items-start justify-between gap-2">
					<input
						type="text"
						value={follower.name}
						placeholder="Name"
						oninput={(e) =>
							onChange(updateFollower(character, index, { name: e.currentTarget.value }))}
						class="flex-1 rounded border border-border bg-transparent px-2 py-1 font-semibold focus:border-accent focus:ring-0 focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => onChange(removeFollower(character, index))}
						class="shrink-0 rounded border border-border px-2 py-1 text-sm text-muted hover:text-danger"
					>
						Dismiss
					</button>
				</div>

				<input
					type="text"
					value={follower.tags}
					placeholder="Tags"
					oninput={(e) =>
						onChange(updateFollower(character, index, { tags: e.currentTarget.value }))}
					class="w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
				/>

				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<label class="text-xs text-muted">
						HP
						<input
							type="number"
							value={follower.hp ?? ''}
							oninput={(e) =>
								onChange(
									updateFollower(character, index, {
										hp: e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
									})
								)}
							class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
					</label>
					<label class="text-xs text-muted">
						Max HP
						<input
							type="number"
							value={follower.maxHp ?? ''}
							oninput={(e) =>
								onChange(
									updateFollower(character, index, {
										maxHp: e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
									})
								)}
							class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
					</label>
					<label class="text-xs text-muted">
						Armor
						<input
							type="number"
							value={follower.armor ?? ''}
							oninput={(e) =>
								onChange(
									updateFollower(character, index, {
										armor: e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
									})
								)}
							class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
					</label>
					<label class="text-xs text-muted">
						Damage
						<input
							type="text"
							value={follower.damage}
							oninput={(e) =>
								onChange(updateFollower(character, index, { damage: e.currentTarget.value }))}
							class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
					</label>
				</div>

				<label class="block text-xs text-muted">
					Instinct
					<input
						type="text"
						value={follower.instinct}
						oninput={(e) =>
							onChange(updateFollower(character, index, { instinct: e.currentTarget.value }))}
						class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>

				{#if insert.followerBlock.flags.length}
					<div class="flex flex-wrap gap-3">
						{#each insert.followerBlock.flags as flag (flag)}
							<label class="flex items-center gap-1.5 text-xs text-muted">
								<input
									type="checkbox"
									checked={follower.flags.includes(flag)}
									onchange={() => onChange(toggleFollowerFlag(character, index, flag))}
									class="accent-accent"
								/>
								{flag}
							</label>
						{/each}
					</div>
				{/if}

				<div>
					<div class="text-xs font-medium text-muted">Moves</div>
					<div class="mt-1 space-y-1">
						{#each follower.moves as moveLine, moveIndex (moveIndex)}
							<input
								type="text"
								value={moveLine}
								oninput={(e) =>
									onChange(
										updateFollower(character, index, {
											moves: follower.moves.map((m, i) =>
												i === moveIndex ? e.currentTarget.value : m
											)
										})
									)}
								class="w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
							/>
						{/each}
					</div>
				</div>

				{#if insert.followerBlock.cost}
					<label class="block text-xs text-muted">
						Cost
						<input
							type="text"
							value={follower.cost}
							oninput={(e) =>
								onChange(updateFollower(character, index, { cost: e.currentTarget.value }))}
							class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						/>
					</label>
				{/if}

				<div>
					<div class="text-xs font-medium text-muted">Loyalty</div>
					<div class="mt-1">
						{@render loyaltyBoxes(index, follower.loyalty, insert.followerBlock.loyaltyMax)}
					</div>
				</div>

				<div>
					<div class="text-xs font-medium text-muted">Gear</div>
					<div class="mt-1 space-y-1">
						{#each follower.gear as gearLine, gearIndex (gearIndex)}
							<div class="flex items-center gap-2">
								<span class="text-xs text-muted"
									>{'◇'.repeat(insert.followerBlock.gearLines[gearIndex] ?? 1)}</span
								>
								<input
									type="text"
									value={gearLine}
									oninput={(e) =>
										onChange(
											updateFollower(character, index, {
												gear: follower.gear.map((g, i) =>
													i === gearIndex ? e.currentTarget.value : g
												)
											})
										)}
									class="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
								/>
							</div>
						{/each}
					</div>
				</div>

				{#if insert.followerBlock.notes}
					<label class="block text-xs text-muted">
						Notes
						<textarea
							value={follower.notes}
							oninput={(e) =>
								onChange(updateFollower(character, index, { notes: e.currentTarget.value }))}
							rows="2"
							class="mt-0.5 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
						></textarea>
					</label>
				{/if}
			</div>
		{/each}
	</div>
{/if}
