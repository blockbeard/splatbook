<!--
	The character builder route — generic shell. It pulls a game's wizard steps
	and draft factory from the registry (never importing game code directly) and
	hands them to the wizard shell. Any game that registers `wizardSteps` +
	`newDraft` gets a builder here for free.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { Wizard } from '$lib/wizard';

	let { data } = $props();

	// The load function guaranteed the game exists with steps + a draft factory.
	const game = $derived(getGame(data.gameId)!);
	const steps = $derived(game.wizardSteps ?? []);
	const initialDraft = $derived(game.newDraft!());

	// On Finish, the draft is already autosaved; the sheet reads the same slot.
	const finish = (): void => {
		if (game.sheetComponent) goto(resolve('/g/[game]/sheet', { game: data.gameId }));
	};
</script>

<svelte:head>
	<title>New character — {data.gameName}</title>
</svelte:head>

<section class="py-8">
	<h1 class="sr-only">Build a {data.gameName} character</h1>
	<Wizard {steps} {initialDraft} gameId={data.gameId} onFinish={finish} />
</section>
