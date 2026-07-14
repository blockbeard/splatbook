import { describe, expect, it } from 'vitest';
import {
	prefKey,
	getLocalPreference,
	setLocalPreference,
	clearLocalPreference,
	type PrefStorage
} from './client';

/** In-memory stand-in for localStorage. */
function fakeStorage(
	seed: Record<string, string> = {}
): PrefStorage & { map: Map<string, string> } {
	const map = new Map(Object.entries(seed));
	return {
		map,
		getItem: (k) => (map.has(k) ? map.get(k)! : null),
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k)
	};
}

describe('prefKey', () => {
	it('namespaces a preference key', () => {
		expect(prefKey('reference.showSetting')).toBe('splatbook:pref:reference.showSetting');
	});
});

describe('get / set / clear round-trip', () => {
	it('stores and restores a preference', () => {
		const s = fakeStorage();
		setLocalPreference(s, 'reference.showSetting', 'true');
		expect(getLocalPreference(s, 'reference.showSetting')).toBe('true');
	});

	it('returns null when unset', () => {
		expect(getLocalPreference(fakeStorage(), 'reference.showSetting')).toBeNull();
	});

	it('overwrites rather than duplicates', () => {
		const s = fakeStorage();
		setLocalPreference(s, 'reference.showSetting', 'true');
		setLocalPreference(s, 'reference.showSetting', 'false');
		expect(getLocalPreference(s, 'reference.showSetting')).toBe('false');
		expect(s.map.size).toBe(1);
	});

	it('clears a stored preference', () => {
		const s = fakeStorage();
		setLocalPreference(s, 'reference.showSetting', 'true');
		clearLocalPreference(s, 'reference.showSetting');
		expect(getLocalPreference(s, 'reference.showSetting')).toBeNull();
	});

	it('does not collide with an unrelated key of the same name', () => {
		const s = fakeStorage({ 'reference.showSetting': 'unnamespaced' });
		expect(getLocalPreference(s, 'reference.showSetting')).toBeNull();
	});
});
