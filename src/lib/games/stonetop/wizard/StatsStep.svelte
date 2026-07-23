<!--
	Wizard step: assign stats. The playbook prints a fixed array of six numbers;
	distribute them across the six stats, each value used once. Live validation
	via the engine keeps values from being double-spent.
-->
<script lang="ts">
	import type { WizardStepProps } from '$lib/wizard';
	import type { Playbook } from '../pack-schemas';
	import {
		STAT_KEYS,
		isStatArrayComplete,
		remainingValues,
		type StatKey,
		type StonetopCharacter
	} from '../engine';
	import { fetchPlaybook } from '../pack/playbooks';

	let { draft, update }: WizardStepProps<StonetopCharacter> = $props();

	let playbook = $state<Playbook | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		const id = draft.playbookId;
		if (!id) return;
		let alive = true;
		fetchPlaybook(id, fetch)
			.then((p) => alive && (playbook = p))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const array = $derived(playbook?.stats.array ?? []);
	const distinct = $derived([...new Set(array)].sort((a, b) => b - a));
	const complete = $derived(playbook ? isStatArrayComplete(array, draft.stats) : false);

	function available(stat: StatKey, value: number): boolean {
		return remainingValues(array, draft.stats, stat).includes(value);
	}

	function set(stat: StatKey, value: number): void {
		if (draft.stats[stat]?.value === value) {
			const next = { ...draft.stats };
			delete next[stat];
			update({ stats: next });
			return;
		}
		update({ stats: { ...draft.stats, [stat]: { value } } });
	}

	const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
</script>

<h2 class="text-2xl font-bold tracking-tight">Assign your stats</h2>

{#if !draft.playbookId}
	<p class="mt-6 text-muted">Choose a playbook first.</p>
{:else if loadError}
	<p class="mt-6 text-muted">Couldn’t load the playbook: {loadError}</p>
{:else if !playbook}
	<p class="mt-6 text-muted">Loading…</p>
{:else}
	<p class="mt-2 text-muted">
		Spend the array <span class="font-medium">{array.map(fmt).join(', ')}</span> — one value per stat.
	</p>

	<div class="mt-6 space-y-3">
		{#each STAT_KEYS as stat (stat)}
			<div class="flex items-center gap-3">
				<span class="w-12 font-mono font-semibold">{stat}</span>
				<div class="flex flex-wrap gap-2">
					{#each distinct as value (value)}
						{@const on = draft.stats[stat]?.value === value}
						<button
							type="button"
							onclick={() => set(stat, value)}
							disabled={!on && !available(stat, value)}
							aria-pressed={on}
							class="min-w-11 rounded-md border px-3 py-1.5 text-sm font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-30 {on
								? 'border-accent bg-accent/5 ring-1 ring-accent'
								: 'border-border hover:border-accent'}"
						>
							{fmt(value)}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<p class="mt-4 text-sm" class:text-accent={complete} class:text-muted={!complete}>
		{complete ? 'All stats assigned.' : 'Assign every stat to continue.'}
	</p>
{/if}
