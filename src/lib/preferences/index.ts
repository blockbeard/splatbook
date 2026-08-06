/**
 * Preference keys — the shared vocabulary between a server-side reader
 * (`locals.prefs`, populated from `$lib/server/db/preferences`) and the
 * client-side `localStorage` mirror (`./client`) a signed-out reader gets
 * instead. Declared once here so a key never drifts between the two.
 */

/**
 * Whether the reference includes one game's gated setting/GM material —
 * spoilers are a per-game decision (phase 22: a Stonetop Book II opt-in must
 * not silently open another game's GM chapters, or vice versa). Stored as
 * `"true"`/`"false"` under `reference.showSetting.<gameId>`; absent means
 * "not decided yet," which the reading feature treats as `false`.
 */
export const referenceShowSetting = (gameId: string): string =>
	`reference.showSetting.${gameId}`;

/**
 * The pre-namespacing bare key (commit 97). Never written anymore — it exists
 * for read-time fallback only: stonetop was the only game before phase 22, so
 * an existing bare row/localStorage entry was a stonetop decision and stonetop
 * reads honor it. Other games never fall back (that would be the leak).
 */
export const REFERENCE_SHOW_SETTING = 'reference.showSetting';
const PRE_NAMESPACING_GAME = 'stonetop';

/**
 * The raw stored value (`"true"`/`"false"`/`null`) of one game's spoiler
 * opt-in, given a raw key reader — works over `locals.prefs` and
 * `localStorage` alike, so both halves of the preferences story share the
 * namespacing + legacy-fallback logic.
 */
export function readShowSetting(
	gameId: string,
	get: (key: string) => string | null | undefined
): string | null {
	return (
		get(referenceShowSetting(gameId)) ??
		(gameId === PRE_NAMESPACING_GAME ? get(REFERENCE_SHOW_SETTING) : null) ??
		null
	);
}

export {
	prefKey,
	getLocalPreference,
	setLocalPreference,
	clearLocalPreference,
	savePreference,
	type PrefStorage
} from './client';
