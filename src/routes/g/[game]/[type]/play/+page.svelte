<!--
	Play/editor route — generic shell. Loads a saved entity (by `?id=`) or the
	local autosave draft, renders the entity type's play component, and autosaves
	whatever the game hands back: to the database when playing a saved entity,
	else to the same localStorage slot the sheet reads. Editor-first types
	(steadings) seed a fresh draft when there's nothing to load. The shell never
	inspects the entity shape.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { draftKey, loadDraft, saveDraft } from '$lib/wizard';
	import { draftToPayload, saveEntity } from '$lib/entities/client';
	import DiceRoller from '$lib/components/DiceRoller.svelte';
	import RollSurface from '$lib/components/RollSurface.svelte';
	import {
		combineModes,
		formatSigned,
		roll as rollDice,
		type DicePreset,
		type ResolvedRoll,
		type RollMode,
		type RollResult
	} from '$lib/dice';

	let { data } = $props();

	const game = $derived(getGame(data.gameId)!);
	const type = $derived(game.entityTypes[data.entityType]);
	const Play = $derived(type.playComponent!);
	// The dice panel belongs to the entity type being played: a character offers
	// its stat rolls; a steading offers none (it rolls its own moves, on its sheet).
	const dice = $derived(type.dice ?? null);
	const dicePresets = $derived(dice?.presets ?? null);
	// A character attached to a campaign logs its rolls to the shared log; a loose
	// one just rolls locally — rolling is not a privilege of being in a campaign.
	const campaignId = $derived(data.saved?.campaignId ?? null);

	// The entity's DB id, once it has one. Starts from `?id=`; an editor-first
	// type (steading) that's created here adopts the id the first save returns.
	// Deliberate one-time capture — the page reloads when the id changes.
	// svelte-ignore state_referenced_locally
	let liveId = $state<string | null>(data.saved?.id ?? null);
	const signedIn = $derived(!!page.data.session?.user);
	const localKey = $derived(draftKey(data.gameId, data.entityType, 'current'));
	const sheetPath = $derived(
		resolve('/g/[game]/[type]/sheet', { game: data.gameId, type: data.entityType })
	);
	const buildPath = $derived(
		resolve('/g/[game]/[type]/build', { game: data.gameId, type: data.entityType })
	);

	// Seed editable state once from the loaded entity, local draft, or — for
	// editor-first types — a fresh blank draft. `untrack` marks this as a
	// deliberate initial-value read (the page reloads on a new id).
	let character = $state<object | null>(
		untrack(() => {
			if (data.saved?.data) return data.saved.data;
			const local = browser
				? loadDraft<object>(localStorage, draftKey(data.gameId, data.entityType, 'current'))
				: null;
			if (local) return local;
			return data.editorFirst && type.newDraft ? type.newDraft() : null;
		})
	);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	interface RollEntry {
		label: string;
		result: RollResult;
		actorName?: string;
		key: number;
		/**
		 * commit 109: present only when this roll totalled 6 or less *and* the
		 * caller armed a follow-up for that — the result surface offers it
		 * instead of fading on its own. Damage, steading, and bare-notation
		 * rolls never arm one, so they never reach this regardless of total.
		 */
		onMiss?: { label: string; action: () => void };
	}

	let recent = $state<RollEntry[]>([]);
	let latest = $state<RollEntry | null>(null);
	let nextKey = 0;
	// Commit 107's bonus box: a one-off signed modifier armed for whatever rolls
	// next — a base die, a game preset, or a stat tapped on the sheet, since all
	// three funnel through `makeRoll`. Consumed (reset to 0) the moment a roll
	// uses it, matching "applies to the next roll", not "until changed again".
	let bonus = $state(0);

	// A roll leads with *who* rolled — the character, not the account. The shell
	// gets that name without reading the game's opaque blob: it's the saved
	// entity's own name column, or what the game's `entityMeta` calls the draft.
	const characterName = $derived(
		data.saved?.name ?? (character ? (type.entityMeta?.(character)?.name ?? null) : null)
	);

	/**
	 * Roll, surface it, and — when this character sits at a campaign — log it.
	 * Everything rolls through here: the preset buttons and whatever the game's
	 * sheet taps (a stat, a move). Rolling works with no campaign at all; logging
	 * is the extra a campaign buys, and is best-effort — a failed write must never
	 * interrupt play.
	 */
	function makeRoll(
		label: string,
		notation: string,
		opts?: { mode?: RollMode; onMiss?: { label: string; action: () => void } }
	): void {
		const mode = opts?.mode ?? 'normal';
		const armedBonus = bonus;
		const result = rollDice(notation, { mode, bonus: armedBonus });
		const fullLabel = armedBonus !== 0 ? `${label} (bonus ${formatSigned(armedBonus)})` : label;
		const entry: RollEntry = {
			label: fullLabel,
			result,
			actorName: characterName ?? undefined,
			key: nextKey++,
			onMiss: result.total <= 6 ? opts?.onMiss : undefined
		};
		recent = [entry, ...recent].slice(0, 8);
		latest = entry;
		bonus = 0;

		if (!campaignId || !browser) return;
		fetch(`/api/campaigns/${campaignId}/rolls`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ label: fullLabel, result, characterName })
		}).catch(() => {});
	}

	/** A preset button. The game resolves the preset's dynamic modifier against
	 * the character — a stat it holds and the shell can't read. With no resolver,
	 * or nothing in play, the bare notation is the right roll (and never a
	 * candidate for `onMiss`, since a bare `ResolvedRoll` never carries one). */
	function rollPreset(preset: DicePreset, mode: RollMode): void {
		const resolved: ResolvedRoll =
			dice?.resolve && character
				? dice.resolve(preset, character)
				: { label: preset.label, notation: preset.notation };
		makeRoll(resolved.label, resolved.notation, {
			// Entity-imposed mode (marked debility → disadvantage) meets the
			// panel's dialled-in mode; opposed modes cancel.
			mode: combineModes(mode, resolved.mode ?? 'normal'),
			onMiss:
				resolved.onMiss && character
					? {
							label: resolved.onMiss.label,
							action: () => onChange(resolved.onMiss!.apply(character!))
						}
					: undefined
		});
	}

	/**
	 * Persist the current entity — debounced. To the DB when it has an id; for a
	 * signed-in editor-first type with no id yet, create it in the DB and adopt
	 * the returned id (so it lands in the dashboard like a character). Otherwise
	 * fall back to the local autosave slot.
	 */
	function persist(next: object): void {
		if (liveId) {
			saveState = 'saving';
			const payload = draftToPayload(data.gameId, data.entityType, next, { id: liveId });
			if (!payload) {
				saveState = 'error';
				return;
			}
			saveEntity(payload)
				.then(() => (saveState = 'saved'))
				.catch(() => (saveState = 'error'));
		} else if (signedIn && data.editorFirst) {
			saveState = 'saving';
			const payload = draftToPayload(data.gameId, data.entityType, next, { status: 'ready' });
			if (!payload) {
				saveState = 'error';
				return;
			}
			saveEntity(payload)
				.then((saved) => {
					liveId = saved.id;
					saveState = 'saved';
					// Adopt the id in the URL so a reload loads it from the DB.
					if (browser) replaceState(`${page.url.pathname}?id=${saved.id}`, {});
				})
				.catch(() => (saveState = 'error'));
		} else if (browser) {
			saveDraft(localStorage, localKey, next);
			saveState = 'saved';
		}
	}

	/** The game handed us a new version: show it, then debounce a save. */
	function onChange(next: object): void {
		character = next;
		saveState = 'saving';
		clearTimeout(timer);
		timer = setTimeout(() => persist(next), 600);
	}

	const savedLabel = $derived(
		{ idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[saveState]
	);
</script>

<svelte:head>
	<title>{data.typeLabel} — {data.gameName}</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
	{#if data.hasSheet}
		<a
			href={liveId ? `${sheetPath}?id=${liveId}` : sheetPath}
			class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
		>
			← {data.typeLabel} sheet
		</a>
	{:else}
		<a
			href={resolve('/g/[game]', { game: data.gameId })}
			class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
		>
			← {data.gameName}
		</a>
	{/if}
	<div class="flex items-center gap-3">
		<span class="text-sm text-muted" aria-live="polite">{savedLabel}</span>
		{#if data.hasSheet && character}
			<!-- What you want a PDF *of* is the sheet, not the play controls — so the
			     PDF button hands off to the sheet view, which prints itself on arrival. -->
			<a
				href={liveId ? `${sheetPath}?id=${liveId}&print=1` : `${sheetPath}?print=1`}
				class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
			>
				Save as PDF
			</a>
		{/if}
	</div>
</div>

{#if !character}
	<p class="text-muted">
		No {data.typeLabel.toLowerCase()} to play.
		{#if type.wizardSteps?.length}
			<a href={buildPath} class="text-accent hover:underline">Build one first.</a>
		{/if}
	</p>
{:else}
	<Play {character} {onChange} roll={makeRoll} />
	{#if dicePresets}
		<div class="mt-6">
			<DiceRoller
				presets={dicePresets}
				onRoll={rollPreset}
				{bonus}
				onBonusChange={(n) => (bonus = n)}
				{recent}
				logged={!!campaignId}
			/>
		</div>
	{/if}
	<RollSurface entry={latest} logged={!!campaignId} onDismiss={() => (latest = null)} />
{/if}
