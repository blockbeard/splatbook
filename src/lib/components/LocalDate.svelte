<!--
	A timestamp that renders identically on server and client, then upgrades.

	The problem it solves: `toLocaleDateString()` formats with the *server's*
	locale during SSR and the *reader's* on hydration — when they differ, the
	text mismatches and flicks. So SSR (and the first hydration pass) renders
	the unambiguous ISO form, guaranteeing server and client markup agree; a
	post-hydration effect then swaps in the reader's own locale format. The
	swap is deliberate and happens once, not a repair.

	Semantic <time datetime> throughout, so the machine-readable instant rides
	along whatever the display shows.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let { ms, style = 'date' }: { ms: number; style?: 'date' | 'datetime' } = $props();

	// Flips exactly once, after hydration — onMount never runs during SSR, and
	// runs after the hydration pass has already matched the server's markup.
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	const d = $derived(new Date(ms));
	const iso = $derived(d.toISOString());
	const isoText = $derived(
		style === 'date' ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ')
	);
	const localText = $derived(
		style === 'date'
			? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
			: d.toLocaleString()
	);
</script>

<time datetime={iso}>{hydrated ? localText : isoText}</time>
