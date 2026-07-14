<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	// `data-game` selects the game module's theme (scoped in its own CSS; see
	// app.css). hooks.server.ts stamps it on <html> for the first, server-rendered
	// paint; this keeps it in step across client-side navigation, and takes it off
	// again when you leave the game's routes.
	$effect(() => {
		const game = page.params.game;
		if (!game) return;
		document.documentElement.setAttribute('data-game', game);
		return () => document.documentElement.removeAttribute('data-game');
	});
</script>

{@render children()}
