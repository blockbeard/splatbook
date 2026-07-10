/**
 * Client save/migration tests. The network and storage seams are faked so the
 * key-parsing, payload-building, and best-effort migration behaviour are pinned
 * without a browser: a bad draft is skipped, a failed save is retained, a good
 * one is cleared.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	parseDraftKey,
	localDraftKeys,
	draftToPayload,
	saveEntity,
	migrateLocalDrafts
} from './client.ts';

/** A minimal in-memory Storage good enough for the helpers. */
class FakeStorage {
	private map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	getItem(k: string) {
		return this.map.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		this.map.set(k, v);
	}
	removeItem(k: string) {
		this.map.delete(k);
	}
}

function okFetch(body: unknown = { id: 'srv-1', name: 'X', status: 'draft' }) {
	return vi.fn(
		async (_url: string, _init?: RequestInit) =>
			new Response(JSON.stringify(body), { status: 200 })
	);
}

describe('parseDraftKey', () => {
	it('parses a well-formed draft key', () => {
		expect(parseDraftKey('splatbook:draft:stonetop:character:current')).toEqual({
			gameId: 'stonetop',
			entityType: 'character',
			draftId: 'current'
		});
	});

	it('rejects non-draft keys and malformed ones', () => {
		expect(parseDraftKey('theme')).toBeNull();
		expect(parseDraftKey('splatbook:draft:stonetop')).toBeNull();
	});
});

describe('localDraftKeys', () => {
	it('returns only the draft-namespaced keys', () => {
		const s = new FakeStorage();
		s.setItem('theme', 'dark');
		s.setItem('splatbook:draft:stonetop:character:current', '{}');
		s.setItem('splatbook:draft:stonetop:character:two', '{}');
		expect(localDraftKeys(s)).toEqual([
			'splatbook:draft:stonetop:character:current',
			'splatbook:draft:stonetop:character:two'
		]);
	});
});

describe('draftToPayload', () => {
	it('builds a payload from the real Stonetop entityMeta', () => {
		const payload = draftToPayload('stonetop', { name: 'Wray', schemaVersion: 1 });
		expect(payload).toMatchObject({
			gameId: 'stonetop',
			entityType: 'character',
			name: 'Wray',
			schemaVersion: 1
		});
	});

	it('returns null for an unknown game', () => {
		expect(draftToPayload('no-such-game', {})).toBeNull();
	});

	it('applies overrides (e.g. marking ready)', () => {
		const payload = draftToPayload('stonetop', { name: 'Wray' }, { status: 'ready' });
		expect(payload?.status).toBe('ready');
	});
});

describe('saveEntity', () => {
	it('POSTs JSON and returns the saved entity', async () => {
		const f = okFetch({ id: 'srv-9', name: 'Wray', status: 'ready' });
		const out = await saveEntity(
			{ gameId: 'stonetop', entityType: 'character', name: 'Wray', data: {}, schemaVersion: 1 },
			f as unknown as typeof fetch
		);
		expect(out.id).toBe('srv-9');
		const [, init] = f.mock.calls[0];
		expect(init?.method).toBe('POST');
	});

	it('throws on a non-OK response', async () => {
		const f = vi.fn(async () => new Response('no', { status: 401 }));
		await expect(
			saveEntity(
				{ gameId: 'stonetop', entityType: 'character', name: 'x', data: {}, schemaVersion: 1 },
				f as unknown as typeof fetch
			)
		).rejects.toThrow();
	});
});

describe('migrateLocalDrafts', () => {
	it('saves and clears good drafts, skips junk, retains failures', async () => {
		const s = new FakeStorage();
		s.setItem('splatbook:draft:stonetop:character:a', JSON.stringify({ name: 'A' }));
		s.setItem('splatbook:draft:stonetop:character:b', 'not json');
		s.setItem('splatbook:draft:stonetop:character:c', JSON.stringify({ name: 'C' }));
		s.setItem('unrelated', 'x');

		// Fail the save for draft "c" only.
		const f = vi.fn(async (_url: string, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			return new Response('{}', { status: body.name === 'C' ? 500 : 200 });
		});

		const migrated = await migrateLocalDrafts(s, f as unknown as typeof fetch);
		expect(migrated).toBe(1);
		expect(s.getItem('splatbook:draft:stonetop:character:a')).toBeNull(); // cleared
		expect(s.getItem('splatbook:draft:stonetop:character:b')).not.toBeNull(); // junk retained
		expect(s.getItem('splatbook:draft:stonetop:character:c')).not.toBeNull(); // failure retained
	});
});
