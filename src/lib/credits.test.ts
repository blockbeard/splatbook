import { describe, it, expect } from 'vitest';
import { licenseInfo, isShareAlike } from './credits';

describe('isShareAlike', () => {
	it('flags CC …-SA-… and (A)GPL as share-alike', () => {
		expect(isShareAlike('CC-BY-SA-4.0')).toBe(true);
		expect(isShareAlike('GPL-3.0-or-later')).toBe(true);
		expect(isShareAlike('AGPL-3.0')).toBe(true);
	});

	it('does not flag permissive licenses', () => {
		expect(isShareAlike('CC-BY-4.0')).toBe(false);
		expect(isShareAlike('MIT')).toBe(false);
	});
});

describe('licenseInfo', () => {
	it('gives a friendly label and URL for a known license', () => {
		const info = licenseInfo('CC-BY-SA-4.0');
		expect(info.label).toBe('CC BY-SA 4.0');
		expect(info.url).toContain('creativecommons.org/licenses/by-sa/4.0');
		expect(info.shareAlike).toBe(true);
	});

	it('falls back to the raw SPDX id for an unknown license', () => {
		const info = licenseInfo('WTFPL');
		expect(info.label).toBe('WTFPL');
		expect(info.url).toBeUndefined();
		expect(info.shareAlike).toBe(false);
	});
});
