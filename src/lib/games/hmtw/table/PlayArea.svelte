<!--
	In play: every card on the table for the number being resolved, with who
	played it and what for.

	The first live test (25 November 2026) asked for this in so many words:
	"played cards should go to an area where we can see them properly like in
	the crawl phase" — Decks mode's turned-over cards — "where we can see what
	they were for." Cards had been dropped in front of whoever they were played
	at, unlabelled, so nobody could read the turn back.

	Minor actions put down but not yet turned over show here too, face down with
	what they were declared for, because the book has everyone declare before the
	reveal. Readied cards are not here: they stay sideways with their holder
	until they are used, and then they come here, labelled.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import { stepOn } from './guide';
	import type { FaceIndex } from './faces';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { creatureLabel } from '../engine/creatures';
	import { addsWords } from './adds';

	let {
		table,
		seats,
		faces,
		runs = false,
		busy = false,
		onCommand
	}: {
		table: ProjectedTable;
		seats: readonly { id: string; name: string }[];
		faces: FaceIndex;
		/** Whether this viewer runs the table, and so moves the round on. */
		runs?: boolean;
		busy?: boolean;
		onCommand?: (command: unknown) => void;
	} = $props();

	const nameOf = (id: string) =>
		seats.find((s) => s.id === id)?.name ??
		table.opponents.find((o) => o.id === id)?.name ??
		creatureLabel(table.opponents, id) ??
		'Somebody';

	const kindWords: Record<string, string> = {
		turn: '',
		minor: 'minor action',
		readied: 'readied',
		'out-of-turn': 'out of turn'
	};

	const holders = $derived([
		...table.seats.map((id) => ({ id, zone: `seat:${id}` })),
		...table.opponents.map((o) => ({ id: o.id, zone: `opponent:${o.id}` }))
	]);

	/** Face-up cards with what they were for, in seat order then enemy order. */
	const faceUp = $derived(
		holders.flatMap((h) =>
			(table.zones[`${h.zone}:played`]?.cards ?? []).map((card) => ({
				card,
				holder: h.id,
				play: table.plays[card]
			}))
		)
	);

	/** Minor actions put down and waiting for everyone else's. */
	const waitingDown = $derived(
		holders
			.filter((h) => (table.zones[`${h.zone}:minor`]?.count ?? 0) > 0)
			.map((h) => ({
				holder: h.id,
				zone: `${h.zone}:minor`,
				label: table.minorDeclared[`${h.zone}:minor`] ?? 'Minor action',
				target: table.minorTargets?.[`${h.zone}:minor`],
				guard: (table.minorGuards ?? []).includes(`${h.zone}:minor`),
				card: table.zones[`${h.zone}:minor`]?.cards?.[0]
			}))
	);
</script>

{#if faceUp.length > 0 || waitingDown.length > 0}
	<section class="play" aria-labelledby="play-heading">
		<h2 id="play-heading" class="ct-zone-label">
			In play{table.round.count !== null ? ` — initiative ${table.round.count}` : ''}
		</h2>
		<ul class="play__cards">
			{#each faceUp as { card, holder, play } (card)}
				<li class="play__item">
					<Card
						face={faces[card] ?? null}
						greaterDoom={faces[card]?.greaterDoom ?? false}
						pick={{ zone: `${holder}`, card }}
					/>
					<p class="play__what">
						<span class="play__who">{nameOf(play?.by ?? holder)}</span>
						{#if play}
							<span class="play__action">{play.action}</span>
							{#if play.target}<span class="play__target">→ {nameOf(play.target)}</span>{/if}
							{#if kindWords[play.kind]}<span class="play__kind">{kindWords[play.kind]}</span>{/if}
							{#if addsWords(play.adds)}<span class="play__adds">{addsWords(play.adds)}</span>{/if}
						{/if}
					</p>
				</li>
			{/each}
			{#each waitingDown as down (down.zone)}
				<li class="play__item">
					<Card
						face={down.card ? (faces[down.card] ?? null) : null}
						faceDown
						declared={down.label}
						pick={{ zone: down.zone }}
					/>
					<p class="play__what">
						<span class="play__who">{nameOf(down.holder)}</span>
						<span class="play__action">{down.label}</span>
						{#if down.target}<span class="play__target">→ {nameOf(down.target)}</span>{/if}
						<span class="play__kind">minor action, face down</span>
						<span class="play__adds">{down.guard ? 'becomes the initiative' : 'face value'}</span>
					</p>
				</li>
			{/each}
		</ul>
		{#if runs && onCommand && table.round.step === 'resolve'}
			<!-- Where the GM is already looking while working out the hits (second
			     live test: "it needs to be more obvious"). -->
			<p class="play__next">
				<button
					type="button"
					class="ct-btn ct-btn--primary"
					disabled={busy}
					onclick={() => onCommand(stepOn(table))}>Next: clear these and move on</button
				>
			</p>
		{/if}
	</section>
{/if}

<style>
	.play {
		border: 1px solid var(--ct-rule);
		border-radius: 4px;
		padding: 0.75rem;
	}
	.play h2 {
		margin: 0 0 0.5rem;
	}
	.play__cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.play__item {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
		max-inline-size: 9rem;
	}
	.play__what {
		margin: 0;
		display: grid;
		justify-items: center;
		text-align: center;
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.play__who {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
	}
	.play__action {
		color: var(--ct-mark);
	}
	.play__next {
		margin: 0.75rem 0 0;
	}
	/* What the total is made of: read with the card, so the mark, not the quiet. */
	.play__adds {
		color: var(--ct-mark);
		font-size: 0.8rem;
		font-style: italic;
	}
	.play__target,
	.play__kind {
		color: var(--ct-quiet);
		font-size: 0.8rem;
	}
</style>
