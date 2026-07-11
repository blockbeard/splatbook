import { describe, expect, it } from 'vitest';
import { nextPreference, parsePreference, resolveTheme } from './theme';

describe('theme preference', () => {
	it('cycles system → light → dark → system', () => {
		expect(nextPreference('system')).toBe('light');
		expect(nextPreference('light')).toBe('dark');
		expect(nextPreference('dark')).toBe('system');
	});

	it('treats missing or junk stored values as "system"', () => {
		expect(parsePreference(null)).toBe('system');
		expect(parsePreference(undefined)).toBe('system');
		expect(parsePreference('sepia')).toBe('system');
		expect(parsePreference('dark')).toBe('dark');
	});

	it('resolves "system" against the OS scheme and honours an override', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});
