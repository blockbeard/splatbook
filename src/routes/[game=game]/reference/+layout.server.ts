/**
 * The reference spoiler gate (phase 13, commit 97 — replacing the phase-9 GM
 * gate). A `visibility: 'gm'` section (Book II) is no longer withheld by
 * campaign-GM membership; the book's own stance is "it's okay for players to
 * read this if they want to," so the reader opts in for themself, once,
 * remembered as a preference (`$lib/server/db/preferences`,
 * `REFERENCE_SHOW_SETTING`).
 *
 * This load only surfaces the *signed-in* half of that preference —
 * `locals.prefs`, populated once per request in `hooks.server.ts`. A
 * signed-out reader's preference lives in their own browser's `localStorage`
 * instead, unreadable here; the sibling `+layout.ts` (a universal load, which
 * also runs in the browser) is where the two are reconciled.
 */

import { REFERENCE_SHOW_SETTING } from '$lib/preferences';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return { showSettingPref: locals.prefs[REFERENCE_SHOW_SETTING] };
};
