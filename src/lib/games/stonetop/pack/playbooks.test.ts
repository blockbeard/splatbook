import { describe, expect, it, vi } from 'vitest';
import type { PackManifest } from '$lib/packs/types';
import { fetchPlaybookSummaries, playbookFiles } from './playbooks';

const manifest: PackManifest = {
	id: 'stonetop',
	name: 'Stonetop',
	version: '1.0.0',
	license: 'CC BY-SA 4.0',
	attribution: 'Jeremy Strandberg',
	files: [
		'data/insert-crew.json',
		'data/the-blessed.json',
		'data/the-fox.json',
		'data/the-gm.json',
		'data/the-steading.json',
		'rules/book-i.json'
	]
};

describe('playbookFiles', () => {
	it('keeps character playbooks and drops steading, GM, inserts, and rules', () => {
		expect(playbookFiles(manifest)).toEqual(['data/the-blessed.json', 'data/the-fox.json']);
	});
});

describe('fetchPlaybookSummaries', () => {
	it('projects to id/name/flavor and sorts by name', async () => {
		const bodies: Record<string, unknown> = {
			'/content-packs/stonetop/manifest.json': manifest,
			'/content-packs/stonetop/data/the-blessed.json': {
				id: 'the-blessed',
				name: 'The Blessed',
				flavor: 'Danu provides.'
			},
			'/content-packs/stonetop/data/the-fox.json': {
				id: 'the-fox',
				name: 'The Fox',
				flavor: 'Quick and clever.'
			}
		};
		const fetchFn = vi.fn(async (url: string) => {
			const body = bodies[url];
			if (body === undefined) return new Response(null, { status: 404 });
			return new Response(JSON.stringify(body), { status: 200 });
		});

		const summaries = await fetchPlaybookSummaries(fetchFn);
		expect(summaries).toEqual([
			{ id: 'the-blessed', name: 'The Blessed', flavor: 'Danu provides.' },
			{ id: 'the-fox', name: 'The Fox', flavor: 'Quick and clever.' }
		]);
		// manifest + two playbooks, not the steading/GM/insert files
		expect(fetchFn).toHaveBeenCalledTimes(3);
	});

	it('throws a helpful error when a file is missing', async () => {
		const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
		await expect(fetchPlaybookSummaries(fetchFn)).rejects.toThrow(/failed to load/);
	});
});
