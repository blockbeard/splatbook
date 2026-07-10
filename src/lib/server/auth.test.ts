/**
 * Auth wiring is exercised end-to-end by Playwright; these unit tests pin the
 * pure decision logic that's easy to get subtly wrong: which providers are
 * enabled for a given environment, and the token ⇄ session id plumbing.
 */

import { describe, it, expect } from 'vitest';
import { enabledProviderIds, applyTokenId, applySessionId } from './auth.ts';

describe('enabledProviderIds', () => {
	it('enables dev-login by default with an empty environment', () => {
		expect(enabledProviderIds({})).toEqual(['dev']);
	});

	it('disables dev-login only when explicitly set to "false"', () => {
		expect(enabledProviderIds({ AUTH_DEV_LOGIN: 'false' })).toEqual([]);
		expect(enabledProviderIds({ AUTH_DEV_LOGIN: 'true' })).toEqual(['dev']);
		// Any other value leaves the default on.
		expect(enabledProviderIds({ AUTH_DEV_LOGIN: '0' })).toEqual(['dev']);
	});

	it('enables an OAuth provider only when both id and secret are present', () => {
		expect(enabledProviderIds({ AUTH_GOOGLE_ID: 'x' })).toEqual(['dev']);
		expect(enabledProviderIds({ AUTH_GOOGLE_SECRET: 'y' })).toEqual(['dev']);
		expect(enabledProviderIds({ AUTH_GOOGLE_ID: 'x', AUTH_GOOGLE_SECRET: 'y' })).toEqual([
			'dev',
			'google'
		]);
	});

	it('supports a production shape: no dev-login, Google + Discord on', () => {
		expect(
			enabledProviderIds({
				AUTH_DEV_LOGIN: 'false',
				AUTH_GOOGLE_ID: 'g',
				AUTH_GOOGLE_SECRET: 'g',
				AUTH_DISCORD_ID: 'd',
				AUTH_DISCORD_SECRET: 'd'
			})
		).toEqual(['google', 'discord']);
	});
});

describe('token ⇄ session id plumbing', () => {
	it('writes the user id onto the token at sign-in only', () => {
		expect(applyTokenId({}, { id: 'user-1' })).toEqual({ id: 'user-1' });
		// No user (subsequent requests) leaves the token untouched.
		expect(applyTokenId({ id: 'user-1', foo: 1 })).toEqual({ id: 'user-1', foo: 1 });
		expect(applyTokenId({}, null)).toEqual({});
	});

	it('surfaces the token id on session.user.id', () => {
		const session = { user: { name: 'Wray' } as { name: string; id?: string } };
		const out = applySessionId(session, { id: 'user-1' });
		expect(out.user.id).toBe('user-1');
	});

	it('is a no-op when there is no user or no id on the token', () => {
		expect(applySessionId({ user: undefined }, { id: 'user-1' })).toEqual({ user: undefined });
		const session = { user: { id: undefined } };
		expect(applySessionId(session, {}).user.id).toBeUndefined();
	});
});
