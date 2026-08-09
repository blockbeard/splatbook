/**
 * `npm run build:pages` — expand each pack's whole-book document trees into
 * the artifacts the reference serves: a nav spine and one file per page.
 *
 * Third stage of the content pipeline (vault --build_rules.py--> markdown
 * --build_srd.py--> document trees --build_pages.ts--> served artifacts).
 *
 * Emitted **generated and gitignored**, beside the trees they come from:
 *
 *   rules/nav.json         the sidebar spine, player-visible sections only
 *   rules/nav-gm.json      the same, including gated chapters
 *   rules/pages/<id>.json  one per section: the page it renders, or — for a
 *                          section below the game's page depth — the page that
 *                          hosts it, as `{ redirectTo }`
 *
 * Not committed, and not listed in `manifest.json`: they are derived from the
 * trees the way `search-index.json` and `link-index.json` are, and there are
 * ~3,400 page files — checking those in would turn every content reimport
 * into a diff nobody can read, when the trees beside them already show the
 * change in four files.
 *
 * Consequence: this must run before anything that serves or tests the
 * reference. `prebuild`/`predev` cover `vite build` (and so Playwright, which
 * builds) and `vite dev`; the projections themselves are unit-tested through
 * `$lib/reference/page-artifacts` without needing the output.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listPackRoots, loadManifest, loadPackFile } from '../src/lib/packs/fs-loader';
import { documentTreeSchema, type DocumentTree } from '../src/lib/reference/document-tree';
import {
	assertPackInvariants,
	buildDeepLinks,
	buildNav,
	buildPages
} from '../src/lib/reference/page-artifacts';
import { NAV_DEPTH, REFERENCE_LAYOUT } from '../src/lib/games/reference-configs';

const PACKS_ROOT = 'static/content-packs';

const roots = await listPackRoots(PACKS_ROOT);
if (roots.length === 0) {
	console.log(`No content packs found under ${PACKS_ROOT}/ — nothing to build.`);
	process.exit(0);
}

for (const root of roots) {
	const manifest = await loadManifest(root);
	const ruleFiles = manifest.files.filter((f) => f.startsWith('rules/')).sort();
	if (ruleFiles.length === 0) continue;

	const trees: DocumentTree[] = [];
	for (const file of ruleFiles) {
		trees.push(documentTreeSchema.parse(await loadPackFile(root, file)));
	}
	assertPackInvariants(trees);

	const pageDepth = REFERENCE_LAYOUT[manifest.id]?.pageDepth ?? Infinity;
	const rulesDir = join(root, 'rules');
	const pagesDir = join(rulesDir, 'pages');
	// Rebuilt from scratch: a section deleted upstream must not leave a stale
	// page file behind, still answering 200 at a URL the book no longer has.
	await rm(pagesDir, { recursive: true, force: true });
	await mkdir(pagesDir, { recursive: true });

	const write = (path: string, value: unknown) => writeFile(path, JSON.stringify(value));

	await write(join(rulesDir, 'nav.json'), buildNav(trees, { maxLevel: NAV_DEPTH, gmVisible: false }));
	await write(join(rulesDir, 'nav-gm.json'), buildNav(trees, { maxLevel: NAV_DEPTH, gmVisible: true }));

	let pageCount = 0;
	let redirectCount = 0;
	for (const tree of trees) {
		for (const page of buildPages(tree, pageDepth)) {
			await write(join(pagesDir, `${page.id}.json`), page);
			pageCount++;
		}
		for (const [deepId, hostId] of Object.entries(buildDeepLinks(tree, pageDepth))) {
			await write(join(pagesDir, `${deepId}.json`), { redirectTo: hostId });
			redirectCount++;
		}
	}

	console.log(
		`${root}: ${pageCount} pages + ${redirectCount} redirects, ` +
			`nav ${trees.length} document(s)`
	);
}
