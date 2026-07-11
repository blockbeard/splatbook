<!--
	Stonetop's end-of-session move, as a guided flow.

	Answer the two personal prompts for each character, answer the four questions
	as a table, and the XP falls out: every "yes" is an XP for everyone, plus one
	for each prompt a character marked. Jot what happened while it's fresh, then
	optionally turn the steading's season — rolling its +Fortunes, which is the
	steading's own move and the only roll on this screen.

	The prompts and questions are the pack's words. The arithmetic is the engine's
	(`engine/session.ts`). This component is the questionnaire and the "write it
	all down" button; it hands finished blobs to the shell's `save`, which is the
	only thing allowed to touch a character its player owns.
-->
<script lang="ts">
	import type { SessionProps } from '$lib/games/types';
	import type { EndOfSession } from '../pack-schemas';
	import {
		applyEndOfSession,
		emptyAnswers,
		turnSeason,
		xpFor,
		type EndOfSessionAnswers,
		type StonetopCharacter
	} from '../engine';
	import { steadingRollStat, type StonetopSteading } from '../engine/steading';
	import { rollForSteadingStat } from '../dice';
	import { fetchEndOfSession, fetchSteadingMoves } from '../pack/moves';
	import Markdown from '../wizard/components/Markdown.svelte';

	let { characters, steading, save, roll }: SessionProps = $props();

	let move = $state<EndOfSession | null>(null);
	let loadError = $state<string | null>(null);
	$effect(() => {
		let alive = true;
		fetchEndOfSession(fetch)
			.then((m) => alive && (move = m))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// The steading's change-of-seasons move, for its roll and its text.
	let seasonsChange = $state<{ id: string; name: string; text: string } | null>(null);
	$effect(() => {
		let alive = true;
		fetchSteadingMoves(fetch)
			.then((pack) => {
				if (!alive) return;
				seasonsChange = pack.moves.find((m) => m.id === 'seasons-change') ?? null;
			})
			.catch(() => {});
		return () => (alive = false);
	});

	let answers = $state<EndOfSessionAnswers>(emptyAnswers());
	let notes = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let saveError = $state<string | null>(null);

	const toggleGroup = (id: string): void => {
		answers.group = answers.group.includes(id)
			? answers.group.filter((q) => q !== id)
			: [...answers.group, id];
	};

	const togglePersonal = (characterId: string, promptId: string): void => {
		const marked = answers.personal[characterId] ?? [];
		answers.personal = {
			...answers.personal,
			[characterId]: marked.includes(promptId)
				? marked.filter((p) => p !== promptId)
				: [...marked, promptId]
		};
	};

	const marked = (characterId: string, promptId: string): boolean =>
		(answers.personal[characterId] ?? []).includes(promptId);

	const totalXp = $derived(characters.reduce((sum, c) => sum + xpFor(c.id, answers), 0));

	/** Roll the steading's Fortunes at the change of seasons. */
	const rollSeasons = (): void => {
		if (!steading || !seasonsChange || !roll) return;
		const stat = steadingRollStat(seasonsChange);
		if (!stat) return;
		const { label, notation } = rollForSteadingStat(
			steading.data as StonetopSteading,
			stat,
			seasonsChange.name
		);
		roll(label, notation);
	};

	/** Turn the season and write it through. */
	const advance = async (): Promise<void> => {
		if (!steading) return;
		const next = turnSeason(steading.data as StonetopSteading);
		try {
			await save(steading.id, next);
			steading.data = next;
		} catch {
			saveError = 'Could not write the steading.';
		}
	};

	/** Mark everyone's XP. Each character is written on its own — a failure on one
	 * shouldn't silently cost the table the rest. */
	const writeXp = async (): Promise<void> => {
		saving = true;
		saveError = null;
		try {
			for (const character of characters) {
				const next = applyEndOfSession(character.data as StonetopCharacter, character.id, answers);
				if (next !== character.data) await save(character.id, next);
				character.data = next;
			}
			saved = true;
		} catch {
			saveError = 'Could not mark XP on every character. Nothing was lost — try again.';
		} finally {
			saving = false;
		}
	};

	const season = $derived((steading?.data as StonetopSteading | undefined)?.season);
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load the end-of-session move: {loadError}</p>
{:else if !move}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="mx-auto max-w-3xl space-y-8">
		<header class="border-b-2 border-accent pb-3">
			<h1 class="text-3xl font-bold tracking-tight">{move.name}</h1>
			<p class="text-muted">Answer together. Every “yes” is an XP for everyone.</p>
		</header>

		<section>
			<h2 class="text-lg font-semibold">Each of you</h2>
			<div class="mt-3 space-y-4">
				{#each characters as character (character.id)}
					<div class="rounded-lg border border-border p-4">
						<div class="flex items-baseline justify-between">
							<h3 class="font-semibold">{character.name}</h3>
							<span class="font-mono text-sm text-accent">
								+{xpFor(character.id, answers)} XP
							</span>
						</div>
						<div class="mt-2 space-y-2">
							{#each move.personal as prompt (prompt.id)}
								<label class="flex cursor-pointer items-start gap-2 text-sm">
									<input
										type="checkbox"
										checked={marked(character.id, prompt.id)}
										onchange={() => togglePersonal(character.id, prompt.id)}
										class="mt-1"
									/>
									<span class="text-muted"><Markdown text={prompt.text} /></span>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">As a group</h2>
			<div class="mt-3 space-y-2">
				{#each move.questions as question (question.id)}
					<label
						class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors {answers.group.includes(
							question.id
						)
							? 'border-accent bg-accent/5'
							: 'border-border hover:bg-surface'}"
					>
						<input
							type="checkbox"
							checked={answers.group.includes(question.id)}
							onchange={() => toggleGroup(question.id)}
							class="mt-0.5"
						/>
						<span>{question.text}</span>
					</label>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Notable events</h2>
			<p class="text-sm text-muted">
				What happened, what was praised, what the table wished for. Yours to keep.
			</p>
			<textarea
				bind:value={notes}
				rows="4"
				class="mt-2 w-full rounded-md border border-border bg-surface p-3 text-sm"
				placeholder="The bridge burned. Vera finally trusts the Judge…"></textarea>
			{#each move.closing as line (line)}
				<div class="mt-2 text-xs text-muted"><Markdown text={line} /></div>
			{/each}
		</section>

		<section class="rounded-lg border border-accent bg-accent/5 p-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-lg font-semibold">Mark the XP</h2>
				<span class="text-sm text-muted">{totalXp} XP across the party</span>
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={writeXp}
					disabled={saving || totalXp === 0}
					class="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{saving ? 'Marking…' : 'Mark XP on every sheet'}
				</button>
				{#if saved}
					<span class="text-sm font-medium text-accent">Marked. See you next session.</span>
				{/if}
			</div>
			{#if saveError}
				<p class="mt-2 text-sm text-danger">{saveError}</p>
			{/if}
		</section>

		{#if steading && seasonsChange}
			<section>
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 class="text-lg font-semibold">{steading.name}</h2>
					{#if season}
						<span class="text-sm text-muted capitalize">Currently {season}</span>
					{/if}
				</div>
				<p class="mt-1 text-sm text-muted">
					If the season turned, the steading rolls — and only the steading rolls.
				</p>
				<div class="mt-3 rounded-lg border border-border p-3">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<h3 class="font-semibold">{seasonsChange.name}</h3>
						<div class="flex gap-2">
							{#if roll}
								<button
									type="button"
									onclick={rollSeasons}
									class="rounded-md border border-accent px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
								>
									Roll +Fortunes
								</button>
							{/if}
							<button
								type="button"
								onclick={advance}
								class="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface"
							>
								Turn the season →
							</button>
						</div>
					</div>
					<div class="mt-1 text-sm text-muted"><Markdown text={seasonsChange.text} /></div>
				</div>
			</section>
		{/if}
	</div>
{/if}
