/**
 * Pure helpers for the credits & licensing page: turning the SPDX license id a
 * pack declares in its `manifest.json` into a friendly label + link, and noting
 * whether it is a share-alike (copyleft) license worth calling out. Kept out of
 * the Svelte component so the mapping is unit-tested.
 */

import { APP_REPO_URL } from '$lib/index';

export interface LicenseInfo {
	/** SPDX id as declared (e.g. `CC-BY-SA-4.0`). */
	spdx: string;
	/** Human label (e.g. `CC BY-SA 4.0`). */
	label: string;
	/** Canonical license URL, when known. */
	url?: string;
	/** A share-alike / copyleft license (redistribution must keep the license). */
	shareAlike: boolean;
}

const KNOWN: Record<string, { label: string; url: string }> = {
	'CC-BY-SA-4.0': {
		label: 'CC BY-SA 4.0',
		url: 'https://creativecommons.org/licenses/by-sa/4.0/'
	},
	'CC-BY-4.0': { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
	'GPL-3.0-or-later': {
		label: 'GPL-3.0-or-later',
		url: 'https://www.gnu.org/licenses/gpl-3.0.html'
	},
	// A LicenseRef-* id is pack-specific by nature: the book's own reuse grant,
	// reproduced verbatim (with what the pack omits and why) in the pack's
	// LICENSE.md.
	//
	// Linked on GitHub rather than at its served path: the served copy is raw
	// markdown, which a browser shows as plain text or offers to download —
	// shabby for the one link a reader follows to check a licensing claim.
	// GitHub renders it, and shows its history, which is the better answer for
	// a license anyway.
	'LicenseRef-HMtW': {
		label: 'HMtW open game text (see pack license)',
		url: `${APP_REPO_URL}/blob/main/static/content-packs/hmtw/LICENSE.md`
	}
};

/** Whether an SPDX id names a share-alike / copyleft license (CC …-SA-…, GPL). */
export function isShareAlike(spdx: string): boolean {
	const s = spdx.toUpperCase();
	return /(^|-)SA(-|$)/.test(s) || s.startsWith('GPL') || s.startsWith('AGPL');
}

/** Resolve an SPDX id to display info. Unknown ids fall back to the raw id as the label. */
export function licenseInfo(spdx: string): LicenseInfo {
	const known = KNOWN[spdx];
	return {
		spdx,
		label: known?.label ?? spdx,
		url: known?.url,
		shareAlike: isShareAlike(spdx)
	};
}
