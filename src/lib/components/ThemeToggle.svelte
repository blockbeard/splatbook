<script lang="ts">
	import { browser } from '$app/environment';

	// Initial value is read from the <html> class, which the inline script in
	// app.html sets before hydration (localStorage, falling back to the OS scheme).
	let dark = $state(browser && document.documentElement.classList.contains('dark'));

	function toggle() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		localStorage.setItem('theme', dark ? 'dark' : 'light');
	}
</script>

<button
	onclick={toggle}
	class="rounded border border-border bg-surface px-2 py-1 text-sm text-muted hover:text-text"
	aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{dark ? '☾' : '☀'}
</button>
