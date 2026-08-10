/**
 * Every content pack ships its license, and the app can link it.
 *
 * This is the check that has to fail *for a game nobody has written yet*, so
 * it discovers packs from disk (`listPackRoots`) rather than iterating the
 * registry or naming stonetop and hmtw: adding `static/content-packs/<newgame>/`
 * puts it under these assertions with no edit here.
 *
 * The invariant is not paperwork. Splatbook redistributes other people's game
 * text under grants that require attribution, and two of the three surfaces
 * that carry it are generated from pack data — `/credits` builds its table from
 * every manifest, and a game's landing colophon renders its own. A pack that
 * declares a license the app doesn't know renders a label with nothing to
 * click, which is indistinguishable from a licensing claim we can't back up.
 * HMtW shipped for two days documenting only Stonetop's license in the README
 * because nothing was watching this.
 */

import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { licenseInfo } from '../credits';
import { listPackRoots, loadManifest } from './fs-loader';

const packsRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'static',
	'content-packs'
);

// Top-level await: the pack list has to exist before `describe.each` builds
// the cases, which a `beforeAll` is too late to do.
const roots = await listPackRoots(packsRoot);

describe('content-pack licensing', () => {
	it('finds packs to check', () => {
		// Guards the whole file: a broken path would otherwise make zero
		// assertions look like a pass.
		expect(roots.length).toBeGreaterThan(0);
	});

	describe.each(roots.map((root) => [basename(root), root] as const))('%s', (id, root) => {
		it('declares a license and an attribution in its manifest', async () => {
			const manifest = await loadManifest(root);
			expect(manifest.license?.trim(), `${id}: manifest.license is empty`).toBeTruthy();
			expect(
				manifest.attribution?.trim(),
				`${id}: manifest.attribution is empty — /credits and the game's landing colophon ` +
					`both render this, so an empty one publishes a blank where the rights holder goes`
			).toBeTruthy();
		});

		it('ships its own LICENSE.md', async () => {
			// Required even when the SPDX id has a canonical URL: the canonical
			// text says what CC BY-SA *is*, not who holds this text, what the
			// pack omits, or what permission it was reused under.
			const file = join(root, 'LICENSE.md');
			await expect(
				stat(file),
				`${id}: no LICENSE.md in the pack — every pack carries its own license text`
			).resolves.toBeTruthy();
			expect((await readFile(file, 'utf-8')).trim().length).toBeGreaterThan(0);
		});

		it('declares a license the app knows how to link', async () => {
			const { license } = await loadManifest(root);
			const info = licenseInfo(license);
			expect(
				info.url,
				`${id}: licenseInfo("${license}") has no URL, so /credits and the landing colophon ` +
					`render a label with nothing to click. Add the id to KNOWN in src/lib/credits.ts`
			).toBeTruthy();
		});

		it('points a pack-specific license at that pack’s own text', async () => {
			const { license } = await loadManifest(root);
			// A `LicenseRef-*` id names a grant with no canonical URL anywhere —
			// the pack's own LICENSE.md is the only authority, so the link has to
			// resolve to *this* pack's copy and not to a sibling's.
			if (!license.startsWith('LicenseRef-')) return;
			expect(
				licenseInfo(license).url,
				`${id}: LicenseRef must link this pack's LICENSE.md`
			).toMatch(new RegExp(`content-packs/${id}/LICENSE\\.md$`));
		});
	});
});
