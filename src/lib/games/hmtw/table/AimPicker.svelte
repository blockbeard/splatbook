<!--
	Whom a play is aimed at: nobody in particular, any number of people, or
	everyone in a zone (phase 33).

	It was one drop-down. In Card Table Test 3 the Devil's Tail Whip hit every
	adventurer in its zone and could only be aimed at "no one in particular".
	Everyone in a zone is expanded by the table when the card is played, so it
	is whoever stands there then. Nothing checked is nobody in particular.
-->
<script lang="ts">
	let {
		people,
		zones = [],
		targets = $bindable(),
		inZone = $bindable()
	}: {
		/** Who may be aimed at: adventurers and creatures still up. */
		people: { id: string; name: string }[];
		/** The scene's zones, for "everyone in". */
		zones?: { id: string; name: string }[];
		targets: string[];
		inZone: string;
	} = $props();

	function toggleZone(id: string, on: boolean) {
		inZone = on ? id : inZone === id ? '' : inZone;
	}
</script>

<fieldset class="aim">
	<legend>At</legend>
	{#each zones as zone (zone.id)}
		<label>
			<input
				type="checkbox"
				checked={inZone === zone.id}
				onchange={(e) => toggleZone(zone.id, e.currentTarget.checked)}
			/>
			Everyone in {zone.name}
		</label>
	{/each}
	{#each people as person (person.id)}
		<label>
			<input type="checkbox" value={person.id} bind:group={targets} />
			{person.name}
		</label>
	{/each}
	{#if targets.length === 0 && !inZone}
		<span class="aim__none">Nobody in particular.</span>
	{/if}
</fieldset>

<style>
	.aim {
		border: 1px solid var(--ct-rule);
		border-radius: 3px;
		margin: 0;
		padding: 0.25rem 0.6rem 0.4rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.9rem;
		font-size: 0.9rem;
	}
	.aim legend {
		color: var(--ct-quiet);
		padding-inline: 0.25rem;
	}
	.aim label {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		min-block-size: 2.75rem;
	}
	.aim input {
		inline-size: 1.1rem;
		block-size: 1.1rem;
	}
	.aim__none {
		align-self: center;
		color: var(--ct-quiet);
		font-size: 0.85rem;
	}
</style>
