/**
 * The per-game spoiler key (phase 22): namespacing, and the read-time
 * fallback that keeps a pre-namespacing stonetop opt-in working without
 * leaking it into any other game.
 */

import { describe, expect, it } from 'vitest';
import { REFERENCE_SHOW_SETTING, readShowSetting, referenceShowSetting } from './index';

const store = (entries: Record<string, string>) => (key: string) => entries[key] ?? null;

describe('referenceShowSetting', () => {
	it('namespaces the key per game', () => {
		expect(referenceShowSetting('stonetop')).toBe('reference.showSetting.stonetop');
		expect(referenceShowSetting('hmtw')).toBe('reference.showSetting.hmtw');
	});
});

describe('readShowSetting', () => {
	it('reads the namespaced key', () => {
		const get = store({ 'reference.showSetting.hmtw': 'true' });
		expect(readShowSetting('hmtw', get)).toBe('true');
		expect(readShowSetting('stonetop', get)).toBeNull();
	});

	it('falls back to the bare legacy key for stonetop only', () => {
		// Stonetop was the only game before namespacing, so a bare entry was a
		// stonetop decision — any other game inheriting it would be the exact
		// cross-game leak the namespacing exists to prevent.
		const get = store({ [REFERENCE_SHOW_SETTING]: 'true' });
		expect(readShowSetting('stonetop', get)).toBe('true');
		expect(readShowSetting('hmtw', get)).toBeNull();
	});

	it('lets a namespaced value beat the legacy fallback', () => {
		const get = store({
			[REFERENCE_SHOW_SETTING]: 'true',
			'reference.showSetting.stonetop': 'false'
		});
		expect(readShowSetting('stonetop', get)).toBe('false');
	});

	it('returns null when nothing is stored', () => {
		expect(readShowSetting('stonetop', store({}))).toBeNull();
	});
});
