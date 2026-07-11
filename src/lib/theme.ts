/**
 * Theme preference: a three-way choice, not a binary.
 *
 * "system" is the default and stays live — the app follows the OS scheme as it
 * changes. Picking light or dark stores an override that survives reloads; the
 * inline script in app.html reads the same key before first paint.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'theme';

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

export function nextPreference(current: ThemePreference): ThemePreference {
	return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

/** Anything unrecognised (or absent) means "follow the OS". */
export function parsePreference(value: string | null | undefined): ThemePreference {
	return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): ResolvedTheme {
	if (pref === 'system') return prefersDark ? 'dark' : 'light';
	return pref;
}

export const THEME_LABELS: Record<ThemePreference, string> = {
	system: 'System theme',
	light: 'Light theme',
	dark: 'Dark theme'
};

export const THEME_ICONS: Record<ThemePreference, string> = {
	system: '◐',
	light: '☀',
	dark: '☾'
};
