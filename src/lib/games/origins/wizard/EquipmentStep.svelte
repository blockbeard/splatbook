<!--
	Step 4: starting equipment.

	This is where Origins edits the SRD most visibly. Option A gains an ordinary
	equipment kit plus the reference class's own clothes, weapons and armor;
	Option B's gold rises from the SRD's 50 to 100, or 150 with medium or heavy
	armor training. The cards show both the SRD's number and the Origins one, so
	a player reading along in the SRD can see why they disagree.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import {
		CP_PER_GP,
		formatMoney,
		isTrainedFor,
		startingGold,
		type InventoryItem,
		type OriginsCharacter
	} from '../engine';
	import { packContext, type OriginsPack } from '../pack/load';
	import PackGate from './PackGate.svelte';
	import Choice from './Choice.svelte';

	let { draft, update }: WizardStepProps<OriginsCharacter> = $props();

	function chooseOption(optionId: string, items: InventoryItem[], goldCp: number): void {
		update({ equipment: { ...draft.equipment, optionId, items, goldCp } });
	}

	/** The SRD writes equipment as prose ("4 Handaxes"), so a line keeps its
	 * quantity in its name rather than being parsed into a count. */
	const toItems = (names: readonly string[]): InventoryItem[] =>
		names.map((name) => ({ name, quantity: 1 }));

	function choosePack(packId: string | null): void {
		update({ equipment: { ...draft.equipment, packId } });
	}

	function chooseArmor(armorId: string | null): void {
		update({ equipment: { ...draft.equipment, armorId } });
	}

	function toggleShield(): void {
		update({ equipment: { ...draft.equipment, shield: !draft.equipment.shield } });
	}
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const ctx = packContext(pack, draft.backgroundId, draft.referenceClassId, draft.speciesId)}
		{@const background = ctx.background}
		{@const referenceClass = ctx.referenceClass}
		{@const gold = startingGold(ctx)}

		<h2 class="text-2xl font-bold tracking-tight">Starting equipment</h2>
		<p class="mt-2 text-muted">{pack.rules.rules.equipment.text}</p>

		{#if !background}
			<p class="mt-6 text-muted">Pick a background first — it sets your starting equipment.</p>
		{:else}
			<ul class="mt-6 grid gap-3 sm:grid-cols-2">
				{#each background.equipment.options as option (option.id)}
					{@const isGoldOption = option.items.length === 0}
					{@const optionGold = isGoldOption ? gold : option.gp}
					<Choice
						title="Option {option.label}"
						selected={draft.equipment.optionId === option.id}
						onselect={() => chooseOption(option.id, toItems(option.items), optionGold * CP_PER_GP)}
					>
						{#if isGoldOption}
							<p><strong>{optionGold} GP</strong> to spend.</p>
							<p class="mt-1 opacity-70">
								Origins raises the SRD’s {option.gp} GP to {gold}{referenceClass
									? ` — ${referenceClass.name} trains ${referenceClass.armorTraining.text.toLowerCase()}`
									: ''}.
							</p>
						{:else}
							<p>{option.items.join(', ')}{option.gp ? `, and ${option.gp} GP` : ''}</p>
						{/if}
					</Choice>
				{/each}
			</ul>

			{#if draft.equipment.optionId}
				<section class="mt-10">
					<h3 class="text-lg font-semibold">Add an equipment kit</h3>
					<p class="mt-1 text-sm text-muted">
						Origins adds an ordinary kit to your background’s equipment.
					</p>
					<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each pack.equipment.packs as kit (kit.id)}
							<Choice
								title={kit.name}
								subtitle={kit.costText}
								selected={draft.equipment.packId === kit.id}
								onselect={() => choosePack(draft.equipment.packId === kit.id ? null : kit.id)}
							>
								{kit.contents.join(', ')}
							</Choice>
						{/each}
					</ul>
				</section>

				<section class="mt-10">
					<h3 class="text-lg font-semibold">Armor</h3>
					{#if referenceClass}
						<p class="mt-1 text-sm text-muted">
							{referenceClass.name} trains you in {referenceClass.armorTraining.text}. Wearing armor
							you are not trained in is allowed, and costs you: Disadvantage on anything using
							Strength or Dexterity, and no spellcasting.
						</p>
					{/if}
					<ul class="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
						<li>
							<Choice
								title="Unarmored"
								subtitle="10 + DEX"
								selected={draft.equipment.armorId === null}
								onselect={() => chooseArmor(null)}
							/>
						</li>
						{#each pack.equipment.armor.filter((a) => a.category !== 'Shield') as armor (armor.id)}
							{@const trained = isTrainedFor(armor, referenceClass)}
							<li>
								<Choice
									title={armor.name}
									subtitle="{armor.acText} · {armor.costCp === null
										? '—'
										: formatMoney(armor.costCp)}"
									selected={draft.equipment.armorId === armor.id}
									onselect={() => chooseArmor(armor.id)}
								>
									{trained ? 'Trained' : 'Not trained'}
								</Choice>
							</li>
						{/each}
					</ul>
					<label class="mt-4 flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={draft.equipment.shield}
							onchange={toggleShield}
							class="size-4"
						/>
						Carrying a shield (+2 AC)
					</label>
				</section>

				<section class="mt-10">
					<h3 class="text-lg font-semibold">Your gear</h3>
					<p class="mt-1 text-sm text-muted">Purse: {formatMoney(draft.equipment.goldCp)}</p>
					{#if draft.equipment.items.length}
						<ul class="mt-3 list-disc pl-5 text-sm">
							{#each draft.equipment.items as item (item.name)}
								<li>{item.name}</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-3 text-sm text-muted">
							Nothing yet — you took the coin. Buy what you need in play mode.
						</p>
					{/if}
				</section>
			{/if}
		{/if}
	{/snippet}
</PackGate>
