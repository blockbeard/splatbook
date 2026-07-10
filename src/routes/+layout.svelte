<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { APP_NAME } from '$lib';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg text-text">
	<header class="border-b border-border bg-surface">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href="/" class="text-lg font-semibold tracking-tight">
				{APP_NAME}<span class="text-accent">*</span>
			</a>
			<nav class="flex items-center gap-4 text-sm text-muted">
				<!-- Game navigation appears here once modules are registered (phase 1). -->
				<ThemeToggle />
			</nav>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>

	<footer class="border-t border-border bg-surface">
		<div class="mx-auto max-w-5xl px-4 py-4 text-xs text-muted">
			<p>
				Splatbook is free software under the
				<a href="https://www.gnu.org/licenses/gpl-3.0.html" class="underline hover:text-text"
					>GPL-3.0-or-later</a
				>. Game text belongs to its respective publishers — see per-game credits.
			</p>
		</div>
	</footer>
</div>
