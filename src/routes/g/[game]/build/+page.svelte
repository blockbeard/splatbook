<!--
	The character builder route — generic shell. It pulls a game's wizard steps
	and draft factory from the registry (never importing game code directly) and
	hands them to the wizard shell. Any game that registers `wizardSteps` +
	`newDraft` gets a builder here for free.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getGame } from '$lib/games';
	import { Wizard } from '$lib/wizard';
	import { draftToPayload, saveEntity } from '$lib/entities/client';

	let { data } = $props();

	// The load function guaranteed the game exists with steps + a draft factory.
	const game = $derived(getGame(data.gameId)!);
	const steps = $derived(game.wizardSteps ?? []);
	const initialDraft = $derived(game.newDraft!());

	// On Finish: if signed in, persist the finished character and open its saved
	// sheet; otherwise fall back to the local autosave slot the sheet also reads.
	const finish = async (draft: object): Promise<void> => {
		const sheet = resolve('/g/[game]/sheet', { game: data.gameId });
		if (page.data.session?.user) {
			const payload = draftToPayload(data.gameId, draft, { status: 'ready' });
			if (payload) {
				try {
					const saved = await saveEntity(payload);
					await goto(`${sheet}?id=${saved.id}`);
					return;
				} catch {
					// Network hiccup — fall through to the local sheet so work isn't lost.
				}
			}
		}
		if (game.sheetComponent) await goto(sheet);
	};
</script>

<svelte:head>
	<title>New character — {data.gameName}</title>
</svelte:head>

<section class="py-8">
	<h1 class="sr-only">Build a {data.gameName} character</h1>
	<Wizard {steps} {initialDraft} gameId={data.gameId} onFinish={finish} />
</section>
