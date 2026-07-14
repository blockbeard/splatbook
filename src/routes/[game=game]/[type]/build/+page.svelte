<!--
	The entity builder route — generic shell. It pulls an entity type's wizard
	steps and draft factory from the registry (never importing game code
	directly) and hands them to the wizard shell. Any entity type that registers
	`wizardSteps` + `newDraft` gets a builder here for free.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getGame } from '$lib/games';
	import { Wizard } from '$lib/wizard';
	import { draftToPayload, saveEntity } from '$lib/entities/client';

	let { data } = $props();

	// The load function guaranteed the type exists with steps + a draft factory.
	const type = $derived(getGame(data.gameId)!.entityTypes[data.entityType]);
	const steps = $derived(type.wizardSteps ?? []);
	const initialDraft = $derived(type.newDraft!());

	// On Finish: if signed in, persist the finished entity and open its saved
	// sheet; otherwise fall back to the local autosave slot the sheet also reads.
	const finish = async (draft: object): Promise<void> => {
		const sheet = resolve('/[game=game]/[type]/sheet', { game: data.gameId, type: data.entityType });
		if (page.data.session?.user) {
			const payload = draftToPayload(data.gameId, data.entityType, draft, { status: 'ready' });
			if (payload) {
				try {
					const saved = await saveEntity(payload);
					// `sheet` is a resolved path; we only append a query string (rule
					// disabled for this file in eslint.config.js).
					await goto(`${sheet}?id=${saved.id}`);
					return;
				} catch {
					// Network hiccup — fall through to the local sheet so work isn't lost.
				}
			}
		}
		if (type.sheetComponent) await goto(sheet);
	};
</script>

<svelte:head>
	<title>New {data.typeLabel.toLowerCase()} — {data.gameName}</title>
</svelte:head>

<section class="py-8">
	<h1 class="sr-only">Build a {data.gameName} {data.typeLabel.toLowerCase()}</h1>
	<Wizard
		{steps}
		{initialDraft}
		gameId={data.gameId}
		entityType={data.entityType}
		summary={type.summary}
		onFinish={finish}
	/>
</section>
