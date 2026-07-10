import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadManifest, loadPackFile, listPackRoots } from './fs-loader';
import { PackError } from './types';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('loadManifest', () => {
	it('loads a well-formed manifest', async () => {
		const manifest = await loadManifest(join(fixtures, 'test-pack'));
		expect(manifest).toEqual({
			id: 'test-pack',
			name: 'Test Pack',
			version: '1.0.0',
			license: 'CC0-1.0',
			attribution: 'Splatbook test fixture',
			files: ['data/things.json']
		});
	});

	it('rejects a manifest whose id does not match the folder name', async () => {
		await expect(loadManifest(join(fixtures, 'wrong-id'))).rejects.toThrow(
			/does not match pack folder name/
		);
	});

	it('rejects a manifest listing files that do not exist', async () => {
		await expect(loadManifest(join(fixtures, 'missing-file'))).rejects.toThrow(
			/listed in manifest but not found/
		);
	});

	it('rejects malformed JSON with a PackError naming the file', async () => {
		const err = await loadManifest(join(fixtures, 'not-json')).catch((e) => e);
		expect(err).toBeInstanceOf(PackError);
		expect(err.file).toBe('manifest.json');
	});

	it('rejects a pack with no manifest at all', async () => {
		await expect(loadManifest(join(fixtures, 'no-such-pack'))).rejects.toThrow(
			/missing or unreadable/
		);
	});
});

describe('loadPackFile', () => {
	it('returns parsed JSON for a data file', async () => {
		const data = await loadPackFile(join(fixtures, 'test-pack'), 'data/things.json');
		expect(data).toMatchObject({ id: 'things' });
	});
});

describe('listPackRoots', () => {
	it('finds every fixture folder with a manifest', async () => {
		const roots = await listPackRoots(fixtures);
		expect(roots.map((r) => r.split('/').pop())).toEqual([
			'missing-file',
			'not-json',
			'test-pack',
			'wrong-id'
		]);
	});

	it('returns an empty list for a nonexistent root', async () => {
		await expect(listPackRoots(join(fixtures, 'nowhere'))).resolves.toEqual([]);
	});
});
