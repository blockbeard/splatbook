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
	import { invalidate } from '$app/navigation';
	import { REFERENCE_SHOW_SETTING, savePreference } from '$lib/preferences';

	let { checked, label }: { checked: boolean; label: string } = $props();

	let local = $derived(checked);

	async function toggle(next: boolean): Promise<void> {
		local = next;
		try {
			await savePreference(REFERENCE_SHOW_SETTING, String(next), {
				signedIn: !!page.data.session?.user?.id
			});
		} catch {
			// Best-effort: the box shows intent locally; the invalidate below
			// reconciles with whatever was last saved successfully.
		}
		await invalidate('reference:showSetting');
	}
</script>

<label class="flex items-start gap-2 text-sm text-muted">
	<input
		type="checkbox"
		checked={local}
		onchange={(e) => toggle(e.currentTarget.checked)}
		class="mt-0.5 accent-accent"
	/>
	{label}
</label>
