<!--
	Stonetop GM guide — the component the shell mounts for `/g/[game]/gm/[section]`.
	It receives the whole GM playbook pack (opaque `unknown` from the shell) plus
	the section id to show, casts the pack to `GmPlaybook`, and dispatches to the
	matching section component. Section nav and routing live in the shell; this
	just renders the requested page.
-->
<script lang="ts">
	import type { GmGuideProps } from '$lib/games/types';
	import type { GmPlaybook } from '../pack-schemas';
	import Overview from './sections/Overview.svelte';
	import Moves from './sections/Moves.svelte';
	import Threats from './sections/Threats.svelte';
	import Expeditions from './sections/Expeditions.svelte';
	import Sites from './sections/Sites.svelte';
	import Monsters from './sections/Monsters.svelte';
	import Npcs from './sections/Npcs.svelte';
	import Homefront from './sections/Homefront.svelte';
	import Flow from './sections/Flow.svelte';

	let { data, section }: GmGuideProps = $props();
	const gm = $derived(data as GmPlaybook);
</script>

<div class="gm-guide space-y-8">
	{#if section === 'overview'}
		<Overview {gm} />
	{:else if section === 'moves'}
		<Moves {gm} />
	{:else if section === 'threats'}
		<Threats {gm} />
	{:else if section === 'expeditions'}
		<Expeditions {gm} />
	{:else if section === 'sites'}
		<Sites {gm} />
	{:else if section === 'monsters'}
		<Monsters {gm} />
	{:else if section === 'npcs'}
		<Npcs {gm} />
	{:else if section === 'homefront'}
		<Homefront {gm} />
	{:else if section === 'flow'}
		<Flow {gm} />
	{/if}
</div>
