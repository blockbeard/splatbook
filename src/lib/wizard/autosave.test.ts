import { describe, expect, it } from 'vitest';
import { clearDraft, draftKey, loadDraft, saveDraft, type DraftStorage } from './autosave';

/** In-memory stand-in for localStorage. */
function fakeStorage(
	seed: Record<string, string> = {}
): DraftStorage & { map: Map<string, string> } {
	const map = new Map(Object.entries(seed));
	return {
		map,
		getItem: (k) => (map.has(k) ? map.get(k)! : null),
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k)
	};
}

describe('draftKey', () => {
	it('namespaces by game, entity type, and draft id', () => {
		expect(draftKey('stonetop', 'character', 'current')).toBe(
			'splatbook:draft:stonetop:character:current'
		);
	});
});

describe('save / load round-trip', () => {
	it('stores and restores a draft', () => {
		const s = fakeStorage();
		const key = draftKey('stonetop', 'character', 'c1');
		const draft = { playbookId: 'the-blessed', moves: ['spirit-tongue'] };
		saveDraft(s, key, draft);
		expect(loadDraft(s, key)).toEqual(draft);
	});

	it('returns null when nothing is stored', () => {
		expect(loadDraft(fakeStorage(), 'missing')).toBeNull();
	});

	it('returns null (not a throw) for corrupt JSON', () => {
		const s = fakeStorage({ k: '{not json' });
		expect(loadDraft(s, 'k')).toBeNull();
	});
});

describe('clearDraft', () => {
	it('removes a stored draft', () => {
		const key = draftKey('stonetop', 'character', 'c1');
		const s = fakeStorage({ [key]: '{}' });
		clearDraft(s, key);
		expect(loadDraft(s, key)).toBeNull();
	});
});
