import { describe, it, expect, beforeEach } from 'vitest';
import { clearNavCache, fetchNav, fetchPage, isRedirect, isVisible } from './load';

describe('visibility gate', () => {
	it('hides gm content by default (gate closed) and shows it when open', () => {
		// Fails closed: no flag means player-only.
		expect(isVisible({ visibility: 'player' })).toBe(true);
		expect(isVisible({ visibility: 'gm' })).toBe(false);
		// Gate open (reader opted into spoilers): gm content becomes visible.
		expect(isVisible({ visibility: 'gm' }, true)).toBe(true);
		expect(isVisible({ visibility: 'player' }, true)).toBe(true);
	});
});

describe('fetchNav', () => {
	beforeEach(clearNavCache);

	function counting(body: unknown = [{ id: 'book', title: 'Book', chapters: [], sections: [] }]) {
		const urls: string[] = [];
		const fetchFn = async (url: string) => {
			urls.push(url);
			return new Response(JSON.stringify(body), { status: 200 });
		};
		return { fetchFn, urls };
	}

	it('fetches the spine once per isolate and variant', async () => {
		const { fetchFn, urls } = counting();
		const first = await fetchNav('hmtw', false, fetchFn);
		const second = await fetchNav('hmtw', false, fetchFn);
		expect(second).toBe(first);
		expect(urls).toHaveLength(1);
	});

	it('reads a different artifact for an opted-in reader, rather than filtering', async () => {
		// The point of two files: an opted-out Stonetop reader must not download
		// Book II's contents (259 KB) only to have them filtered away (phase 26).
		const { fetchFn, urls } = counting();
		await fetchNav('stonetop', false, fetchFn);
		await fetchNav('stonetop', true, fetchFn);
		expect(urls[0]).toMatch(/\/rules\/nav\.json$/);
		expect(urls[1]).toMatch(/\/rules\/nav-gm\.json$/);
	});

	it('does not cache a failure, so a later attempt can still succeed', async () => {
		const boom = async () => new Response('nope', { status: 500 });
		await expect(fetchNav('hmtw', false, boom)).rejects.toThrow(/failed to load/);
		const { fetchFn } = counting();
		expect(await fetchNav('hmtw', false, fetchFn)).toHaveLength(1);
	});
});

describe('fetchPage', () => {
	it('requests exactly one page artifact, by section id', async () => {
		const urls: string[] = [];
		const fetchFn = async (url: string) => {
			urls.push(url);
			return new Response(JSON.stringify({ id: 'moves', title: 'Moves' }), { status: 200 });
		};
		await fetchPage('hmtw', 'moves', fetchFn);
		expect(urls).toEqual(['/content-packs/hmtw/rules/pages/moves.json']);
	});

	it('reports a missing section as null rather than throwing', async () => {
		// Cloudflare Pages answers a missing static file with the SPA's *HTML*
		// 404 body. A caller that only checked `res.ok` and then parsed JSON
		// would turn every stale deep link into a 500, so the reference's own
		// error page — built for exactly those readers — would never be reached.
		const html = async () =>
			new Response('<!doctype html><html><body>404</body></html>', {
				status: 404,
				headers: { 'content-type': 'text/html' }
			});
		await expect(fetchPage('hmtw', 'gone', html)).resolves.toBeNull();
	});

	it('still throws on a real server error, which is not a missing page', async () => {
		const boom = async () => new Response('nope', { status: 500 });
		await expect(fetchPage('hmtw', 'moves', boom)).rejects.toThrow(/failed to load/);
	});

	it('recognises the redirect stub a below-page-depth section gets', async () => {
		const stub = async () =>
			new Response(JSON.stringify({ redirectTo: 'talents' }), { status: 200 });
		const page = await fetchPage('hmtw', 'quick-fingers', stub);
		expect(page && isRedirect(page)).toBe(true);
	});
});
