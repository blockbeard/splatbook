<!--
	Step 6: the person, rather than the numbers — name, languages, and the
	post's own list: history, appearance, personality, alignment.

	Skills and tools live here too, because they are the one place a character
	accumulates proficiencies from several sources at once (the background's
	two, plus whatever a species choice granted), and seeing them in one list is
	the only way to notice a duplicate.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import { skillProficiencies, toolProficiencies, type OriginsCharacter } from '../engine';
	import { packContext, type OriginsPack } from '../pack/load';
	import PackGate from './PackGate.svelte';

	let { draft, update }: WizardStepProps<OriginsCharacter> = $props();

	function toggleLanguage(language: string, limit: number): void {
		const chosen = draft.languages;
		update({
			languages: chosen.includes(language)
				? chosen.filter((l) => l !== language)
				: [...chosen, language].slice(-limit)
		});
	}

	function setDetail(field: keyof OriginsCharacter['details'], value: string): void {
		update({ details: { ...draft.details, [field]: value } });
	}
</script>

<PackGate>
	{#snippet children(pack: OriginsPack)}
		{@const wanted = pack.rules.rules.languages.count}
		{@const ctx = packContext(pack, draft.backgroundId, draft.referenceClassId, draft.speciesId)}

		<h2 class="text-2xl font-bold tracking-tight">{pack.rules.steps[3].title}</h2>
		<p class="mt-2 text-muted">{pack.rules.steps[3].text}</p>

		<label class="mt-6 block">
			<span class="text-sm font-semibold">Name</span>
			<input
				type="text"
				value={draft.name}
				oninput={(e) => update({ name: e.currentTarget.value })}
				placeholder="Who are they?"
				class="mt-1 w-full rounded border border-border bg-surface px-3 py-2"
			/>
		</label>

		<section class="mt-8">
			<h3 class="text-lg font-semibold">
				Languages
				<span class="text-sm font-normal text-muted">
					— choose {wanted} ({draft.languages.length}/{wanted} chosen)
				</span>
			</h3>
			<ul class="mt-3 flex flex-wrap gap-2">
				{#each pack.reference.languages as language (language)}
					<li>
						<button
							type="button"
							onclick={() => toggleLanguage(language, wanted)}
							aria-pressed={draft.languages.includes(language)}
							class="rounded-full border px-3 py-1 text-sm transition-colors {draft.languages.includes(
								language
							)
								? 'border-accent bg-accent/10'
								: 'border-border hover:border-accent'}"
						>
							{language}
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<section class="mt-8">
			<h3 class="text-lg font-semibold">Proficiencies</h3>
			{#if !ctx.background}
				<p class="mt-1 text-sm text-muted">Pick a background to see what you are trained in.</p>
			{:else}
				<p class="mt-1 text-sm text-muted">
					Derived from your background and species — nothing here is a free pick.
				</p>
				<dl class="mt-3 space-y-1 text-sm">
					{#each [...skillProficiencies(draft, ctx), ...toolProficiencies(draft, ctx)] as proficiency (proficiency.id)}
						<div>
							<dt class="inline font-medium">{proficiency.name}</dt>
							—
							<dd class="inline text-muted">{proficiency.source}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</section>

		<section class="mt-8 grid gap-4 sm:grid-cols-2">
			{#each [{ field: 'appearance' as const, label: 'Appearance' }, { field: 'personality' as const, label: 'Personality' }, { field: 'history' as const, label: 'History' }, { field: 'alignment' as const, label: 'Alignment (if your table uses it)' }] as entry (entry.field)}
				<label class="block">
					<span class="text-sm font-semibold">{entry.label}</span>
					<textarea
						rows="3"
						value={draft.details[entry.field]}
						oninput={(e) => setDetail(entry.field, e.currentTarget.value)}
						class="mt-1 w-full rounded border border-border bg-surface px-3 py-2"></textarea>
				</label>
			{/each}
		</section>
	{/snippet}
</PackGate>
