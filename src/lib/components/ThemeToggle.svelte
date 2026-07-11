<script lang="ts">
	import { browser } from '$app/environment';
	import {
		nextPreference,
		parsePreference,
		resolveTheme,
		THEME_ICONS,
		THEME_KEY,
		THEME_LABELS,
		type ThemePreference
	} from '$lib/theme';

	// The inline script in app.html has already applied the right class from this
	// same stored value; here we only need the preference itself.
	let pref = $state<ThemePreference>(
		parsePreference(browser ? localStorage.getItem(THEME_KEY) : null)
	);

	const query = browser ? matchMedia('(prefers-color-scheme: dark)') : null;
	let prefersDark = $state(query?.matches ?? false);

	// In "system" mode the OS can change under us (nightfall, a manual flip) and
	// the app follows it live.
	$effect(() => {
		if (!query) return;
		const onChange = (e: MediaQueryListEvent) => (prefersDark = e.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	$effect(() => {
		const dark = resolveTheme(pref, prefersDark) === 'dark';
		document.documentElement.classList.toggle('dark', dark);
	});

	function cycle() {
		pref = nextPreference(pref);
		localStorage.setItem(THEME_KEY, pref);
	}

	const label = $derived(`${THEME_LABELS[pref]} — switch to ${THEME_LABELS[nextPreference(pref)]}`);
</script>

<button
	onclick={cycle}
	class="rounded border border-border bg-surface px-2 py-1 text-sm text-muted hover:text-text"
	aria-label={label}
	title={label}
>
	{THEME_ICONS[pref]}
</button>
