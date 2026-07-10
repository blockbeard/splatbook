<!--
	Outfit / Inventory view (driven by insert-inventory.json). Mark the gear and
	small items you're carrying; the load total lands you in a band (light /
	normal / heavy). "Undefined" ◇ are reserved marks you assign to real items
	later via Have What You Need. Each edit runs a pure engine function and hands
	the new character up via `onChange`.
-->
<script lang="ts">
	import type { InventoryInsert } from '../pack-schemas';
	import {
		assignUndefinedGear,
		assignUndefinedSmall,
		carryingGear,
		carryingSmall,
		gearLoad,
		loadBand,
		setUndefinedGear,
		setUndefinedSmall,
		toggleGear,
		toggleSmallItem,
		type StonetopCharacter
	} from '../engine';
	import { fetchInventory } from '../pack/inserts';

	let {
		character,
		onChange
	}: { character: StonetopCharacter; onChange: (next: StonetopCharacter) => void } = $props();

	let insert = $state<InventoryInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchInventory(fetch)
			.then((i) => alive && (insert = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// Guard against a pre-migration blob (older saves lack `inventory`).
	const invState = $derived(
		character.inventory ?? { gear: [], smallItems: [], undefinedGear: 0, undefinedSmall: 0 }
	);
	const load = $derived(insert ? gearLoad(character, insert) : 0);
	const band = $derived(insert ? loadBand(load, insert) : null);
	// Small-item options excluding the blank write-in lines.
	const smallOptions = $derived(insert ? insert.smallItems.options.filter((o) => o.name) : []);
</script>

{#snippet boxes(count: number, filled: number, set: (n: number) => void, label: string)}
	<div class="flex flex-wrap gap-1" role="group" aria-label={label}>
		{#each Array(count) as _, i (i)}
			<button
				type="button"
				onclick={() => set(filled === i + 1 ? i : i + 1)}
				aria-pressed={i < filled}
				aria-label={`${label}: ${i + 1}`}
				class="h-5 w-5 rounded-sm border border-border transition-colors {i < filled
					? 'bg-accent'
					: 'bg-surface hover:bg-border'}"
			></button>
		{/each}
	</div>
{/snippet}

{#if loadError}
	<p class="text-muted">Couldn’t load the inventory sheet: {loadError}</p>
{:else if !insert}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="space-y-6">
		<div class="flex items-baseline justify-between">
			<h2 class="text-lg font-semibold">Inventory</h2>
			<span class="text-sm text-muted">
				Load {load} · {band?.name ?? '—'}{#if band?.tags?.length}
					<span class="italic">({band.tags.join(', ')})</span>{/if}
			</span>
		</div>

		<section>
			<h3 class="text-sm font-medium text-muted">Gear (each ◇ = 1 load)</h3>
			<ul class="mt-2 space-y-1">
				{#each insert.gear as item (item.name)}
					{@const carried = carryingGear(character, item.name)}
					<li class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => onChange(toggleGear(character, item.name))}
							aria-pressed={carried}
							class="flex-1 rounded-md border px-3 py-1.5 text-left text-sm transition-colors {carried
								? 'border-accent bg-accent/10'
								: 'border-border hover:bg-surface'}"
						>
							<span class="font-medium">{item.name}</span>
							<span class="text-muted"> {'◇'.repeat(item.slots)}</span>
							{#if item.tags?.length}<span class="text-xs text-muted">
									· {item.tags.join(', ')}</span
								>{/if}
						</button>
						{#if !carried && invState.undefinedGear >= item.slots}
							<button
								type="button"
								onclick={() => onChange(assignUndefinedGear(character, insert!, item.name))}
								class="rounded border border-border px-2 py-1 text-xs text-muted hover:text-text"
								title="Have What You Need: assign undefined ◇ to this item"
							>
								← assign
							</button>
						{/if}
					</li>
				{/each}
			</ul>
			<div class="mt-3">
				<div class="text-sm font-medium">
					Undefined ◇ <span class="text-muted">(reserved)</span>
				</div>
				<div class="mt-1">
					{@render boxes(
						insert.outfit.undefinedSlots,
						invState.undefinedGear,
						(n) => onChange(setUndefinedGear(character, n, insert!)),
						'Undefined load'
					)}
				</div>
			</div>
		</section>

		<section>
			<h3 class="text-sm font-medium text-muted">Small items</h3>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each smallOptions as item (item.name)}
					{@const carried = carryingSmall(character, item.name)}
					<div
						class="inline-flex items-center overflow-hidden rounded-full border {carried
							? 'border-accent bg-accent/10'
							: 'border-border'}"
					>
						<button
							type="button"
							onclick={() => onChange(toggleSmallItem(character, item.name))}
							aria-pressed={carried}
							class="px-3 py-1 text-sm hover:bg-surface"
						>
							{item.name}
						</button>
						{#if !carried && invState.undefinedSmall > 0}
							<button
								type="button"
								onclick={() => onChange(assignUndefinedSmall(character, item.name))}
								class="border-l border-border px-2 py-1 text-xs text-muted hover:text-text"
								title="Have What You Need: define an undefined small item as this"
							>
								← assign
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div class="mt-3">
				<div class="text-sm font-medium">
					Undefined small items <span class="text-muted">(reserved)</span>
				</div>
				<div class="mt-1">
					{@render boxes(
						insert.smallItems.undefinedSlots,
						invState.undefinedSmall,
						(n) => onChange(setUndefinedSmall(character, n, insert!)),
						'Undefined small items'
					)}
				</div>
			</div>
		</section>
	</div>
{/if}
