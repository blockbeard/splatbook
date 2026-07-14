/**
 * Preference keys — the shared vocabulary between a server-side reader
 * (`locals.prefs`, populated from `$lib/server/db/preferences`) and the
 * client-side `localStorage` mirror (`./client`) a signed-out reader gets
 * instead. Declared once here so a key never drifts between the two.
 */

/**
 * Whether the reference's search includes Book II — setting spoilers
 * (commit 97, replacing the old GM-only gate). Stored as `"true"`/`"false"`;
 * absent means "not decided yet," which the reading feature treats as `false`
 * — Book I only, the same default a fresh gate had.
 */
export const REFERENCE_SHOW_SETTING = 'reference.showSetting';

export {
	prefKey,
	getLocalPreference,
	setLocalPreference,
	clearLocalPreference,
	type PrefStorage
} from './client';
