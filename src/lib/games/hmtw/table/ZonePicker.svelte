<!--
	Which zone somebody is standing in — one drop-down, for an adventurer or a
	creature alike.

	A native <select>, because it is the control that already does everything
	this needs on every device: a phone gets its own picker, a keyboard gets
	arrow keys, and a screen reader gets the name. Anyone can move anyone, the
	same as anyone can move a card; the table records where people are and does
	not rule on how they got there.

	Hidden while the scene has no zones, since "Not placed" is the only answer
	and a control with one answer is clutter.
-->
<script lang="ts">
	let {
		who,
		label,
		zones,
		at,
		disabled = false,
		onCommand
	}: {
		who: string;
		/** Who this is, for the control's accessible name: "Where Zombie A is". */
		label: string;
		zones: { id: string; name: string }[];
		at: string | null | undefined;
		disabled?: boolean;
		onCommand: (command: unknown) => void;
	} = $props();

	const current = $derived(at && zones.some((z) => z.id === at) ? at : '');
</script>

{#if zones.length > 0}
	<span class="zone-pick">
		<span class="zone-pick__in" aria-hidden="true">in</span>
		<select
			class="ct-field zone-pick__select"
			aria-label={`Where ${label} is`}
			value={current}
			{disabled}
			onchange={(e) =>
				onCommand({
					type: 'place',
					who,
					zone: (e.currentTarget as HTMLSelectElement).value || null
				})}
		>
			<option value="">Not placed</option>
			{#each zones as zone (zone.id)}
				<option value={zone.id}>{zone.name}</option>
			{/each}
		</select>
	</span>
{/if}

<style>
	.zone-pick {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-inline-size: 0;
	}
	.zone-pick__in {
		color: var(--ct-quiet);
		font-size: var(--ct-step-label);
	}
	/* A name-width field would push a combatant's row past its column; a zone
	   name is short, and the native picker shows the whole list when opened. */
	.zone-pick__select {
		inline-size: auto;
		max-inline-size: 10rem;
	}
</style>
