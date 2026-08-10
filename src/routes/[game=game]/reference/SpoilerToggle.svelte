<!--
	The Book II opt-in checkbox (commit 97's preference, given one home). Lives
	in the reference sidebar so it's discoverable from the TOC — the original
	placement inside the search form meant a reader browsing the contents had
	no path to Book II without incidentally searching first (staging finding,
	2026-07-17).

	Writable-$derived pattern: `local` reads the loaded value but flips
	immediately on click for feedback; the save + invalidate round-trip then
	reconciles it with whatever was actually persisted (server preferences when
	signed in, localStorage otherwise).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { invalidate } from '$app/navigation';
	import { referenceShowSetting, savePreference } from '$lib/preferences';

	let {
		checked,
		label,
		noticeId
	}: {
		checked: boolean;
		label: string;
		/**
		 * The game's opt-in explanation (`referenceSpoilers.interstitialSectionId`),
		 * linked beside the box. The label alone can only ever *name* what's behind
		 * the gate; the note says why it's there and what opting in means, and
		 * before this the two surfaces had no path between them.
		 */
		noticeId?: string;
	} = $props();

	let local = $derived(checked);

	// Suppressed when the reader is already on it — a "what's this?" pointing at
	// the page you are reading is noise. (For a game whose note is a real gated
	// chapter, like Stonetop's, this only matches once they've opted in and can
	// reach it; opted out, the link resolves to the interstitial, which is the
	// same passage.)
	const noticeHref = $derived(
		noticeId && page.params.section !== noticeId
			? resolve('/[game=game]/reference/[section]', {
					game: page.params.game as string,
					section: noticeId
				})
			: undefined
	);

	async function toggle(next: boolean): Promise<void> {
		local = next;
		try {
			await savePreference(referenceShowSetting(page.params.game as string), String(next), {
				signedIn: !!page.data.session?.user?.id
			});
		} catch {
			// Best-effort: the box shows intent locally; the invalidate below
			// reconciles with whatever was last saved successfully.
		}
		await invalidate('reference:showSetting');
	}
</script>

<div class="text-sm text-muted">
	<label class="flex items-start gap-2">
		<input
			type="checkbox"
			checked={local}
			onchange={(e) => toggle(e.currentTarget.checked)}
			class="mt-0.5 accent-accent"
		/>
		{label}
	</label>
	{#if noticeHref}
		<!-- Outside the <label>: nested inside it, clicking the link would also
		     toggle the checkbox. `ml-6` lines it up under the label's text rather
		     than under the box. -->
		<a href={noticeHref} class="mt-0.5 ml-6 inline-block text-xs underline hover:text-accent">
			What’s this?
		</a>
	{/if}
</div>
