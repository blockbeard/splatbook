<!--
	The GM's draw: a checklist, not a number box.

	Ch.7 gives three cards plus six cumulative reasons, rechecked at the start of
	every round — "if the number of enemies decreases, you will draw fewer". So
	the interface asks the questions the book asks and totals them up, and the GM
	can still deal whatever they like. It suggests; it does not insist.
-->
<script lang="ts">
	interface Modifier {
		id: string;
		label: string;
		amount: number;
		kind: 'toggle' | 'count';
	}

	let {
		base,
		modifiers,
		mulliganNote,
		value = $bindable()
	}: {
		base: number;
		modifiers: Modifier[];
		mulliganNote: string;
		value: number;
	} = $props();

	let ticks = $state<Record<string, boolean | number>>({});

	const suggested = $derived(
		modifiers.reduce((total, m) => {
			const picked = ticks[m.id];
			if (picked === undefined || picked === false) return total;
			const times = m.kind === 'count' ? Math.max(0, Math.floor(Number(picked) || 0)) : 1;
			return total + m.amount * times;
		}, base)
	);

	// Follow the checklist unless the GM has said otherwise this round.
	let overridden = $state(false);
	$effect(() => {
		if (!overridden) value = suggested;
	});
</script>

<fieldset class="draw">
	<legend class="ct-zone-label">The GM draws</legend>
	<ul>
		{#each modifiers as m (m.id)}
			<li>
				{#if m.kind === 'toggle'}
					<label>
						<input type="checkbox" bind:checked={ticks[m.id] as boolean} />
						{m.label}
						<span class="draw__amount">+{m.amount}</span>
					</label>
				{:else}
					<label>
						<input
							type="number"
							min="0"
							max="20"
							bind:value={ticks[m.id] as number}
							placeholder="0"
						/>
						{m.label}
						<span class="draw__amount">+{m.amount} each</span>
					</label>
				{/if}
			</li>
		{/each}
	</ul>

	<p class="draw__total">
		<label>
			Cards
			<input type="number" min="0" max="30" bind:value oninput={() => (overridden = true)} />
		</label>
		{#if overridden && value !== suggested}
			<button type="button" class="draw__reset" onclick={() => (overridden = false)}>
				back to {suggested}
			</button>
		{/if}
	</p>
	<p class="draw__note">{mulliganNote}</p>
</fieldset>

<style>
	.draw {
		border: 1px solid var(--ct-rule);
		border-radius: 4px;
		padding: 0.75rem;
		margin: 0;
		max-inline-size: 22rem;
	}
	ul {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
		display: grid;
		gap: 0.3rem;
	}
	label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
	}
	input[type='number'] {
		inline-size: 3.5rem;
		background: transparent;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: inherit;
		font: inherit;
		padding: 0.25rem;
		min-block-size: 2.2rem;
	}
	input[type='checkbox'] {
		inline-size: 1.1rem;
		block-size: 1.1rem;
	}
	.draw__amount {
		margin-inline-start: auto;
		color: var(--ct-quiet);
		font-size: 0.8rem;
	}
	.draw__total {
		border-block-start: 1px solid var(--ct-rule);
		padding-block-start: 0.5rem;
		margin: 0;
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.draw__reset {
		background: none;
		border: 0;
		font: inherit;
		font-size: 0.8rem;
		color: var(--ct-mark);
		text-decoration: underline;
		cursor: pointer;
	}
	.draw__note {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--ct-quiet);
	}
</style>
