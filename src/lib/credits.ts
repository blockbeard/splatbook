/**
 * Pure helpers for the credits & licensing page: turning the SPDX license id a
 * pack declares in its `manifest.json` into a friendly label + link, and noting
 * whether it is a share-alike (copyleft) license worth calling out. Kept out of
 * the Svelte component so the mapping is unit-tested.
 */

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
