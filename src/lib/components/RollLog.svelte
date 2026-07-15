<!--
	Campaign roll log — the shared, live dice history (phase 10, commit 68).
	Seeded from the page load, then polled from `/api/campaigns/[id]/rolls` every
	few seconds so a whole table sees each other's rolls without a refresh. A
	short poll is plenty for a tabletop; it pauses while the tab is hidden and
	never overlaps requests. Generic shell UI: it renders the dice engine's
	`RollResult`, and the labels are whatever the roller sent.
-->
<script lang="ts">
	import { formatSigned } from '$lib/dice';
	import type { RollLogEntry } from '$lib/rolls';

	let {
		campaignId,
		initial
	}: {
		campaignId: string;
		initial: RollLogEntry[];
	} = $props();

	// Seed once from the server-rendered load; polling replaces it thereafter.
	// svelte-ignore state_referenced_locally
	let entries = $state<RollLogEntry[]>(initial);

	const POLL_MS = 3000;

	async function refresh(): Promise<void> {
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/rolls`);
			if (!res.ok) return;
			const body = (await res.json()) as { rolls: RollLogEntry[] };
			entries = body.rolls;
		} catch {
			// A dropped poll is harmless — the next tick tries again.
		}
	}

	// Poll while mounted and the tab is visible; a single in-flight guard keeps a
	// slow response from stacking up behind the interval.
	$effect(() => {
		let inFlight = false;
		const tick = async () => {
			if (inFlight || document.hidden) return;
			inFlight = true;
			await refresh();
			inFlight = false;
		};
		const id = setInterval(tick, POLL_MS);
		return () => clearInterval(id);
	});

	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	function ago(at: number): string {
		const secs = Math.round((at - Date.now()) / 1000);
		if (secs > -45) return 'just now';
		if (secs > -3600) return rtf.format(Math.round(secs / 60), 'minute');
		if (secs > -86400) return rtf.format(Math.round(secs / 3600), 'hour');
		return rtf.format(Math.round(secs / 86400), 'day');
	}
</script>

<section class="mt-6">
	<h2 class="text-sm font-semibold">Roll log</h2>
	{#if entries.length === 0}
		<p class="mt-1 text-xs text-muted">
			No rolls yet. Rolls made on a character's sheet show up here.
		</p>
	{:else}
		<ul class="mt-2 divide-y divide-border rounded-md border border-border" aria-live="polite">
			{#each entries as e (e.id)}
				<li class="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
					<!-- The table knows each other by their characters, so the log leads with
					     the character and keeps the account name as small print. A roll made
					     with no character in play has only the account name to give. -->
					<span class="min-w-0">
						<span class="font-medium">{e.characterName ?? e.actorName}</span>
						{#if e.characterName}
							<span class="text-xs text-muted">({e.actorName})</span>
						{/if}
						<span class="text-muted"> · {e.label}</span>
						{#if e.result.mode !== 'normal'}
							<span class="text-xs text-muted">({e.result.mode})</span>
						{/if}
					</span>
					<span class="flex shrink-0 items-baseline gap-2">
						<span class="text-xs text-muted">
							{#each e.result.dice as d, i (i)}<span class={d.kept ? '' : 'line-through'}
									>{d.value}</span
								>{i < e.result.dice.length - 1 ? ' ' : ''}{/each}{#if e.result.modifier !== 0}<span
									>{e.result.modifier > 0
										? ` + ${e.result.modifier}`
										: ` − ${-e.result.modifier}`}</span
								>{/if}{#if e.result.bonus !== 0}<span class="text-accent"
									>{` bonus ${formatSigned(e.result.bonus)}`}</span
								>{/if}
						</span>
						<span class="min-w-6 text-right font-semibold text-text">{e.result.total}</span>
						<span class="w-16 text-right text-xs text-muted" title={new Date(e.at).toLocaleString()}
							>{ago(e.at)}</span
						>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
