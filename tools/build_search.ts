/**
 * Build the client-side rules search index from a pack's document trees.
 *
 * Third stage of the content pipeline (after `build_srd.py`): flattens every
 * section into a MiniSearch document and writes a serialized index to
 * `<pack>/search-index.json`, served statically and loaded in the browser
 * (`$lib/reference/search`) for zero-server-cost, offline-capable search.
 *
 *   npm run build:search        # or: tsx tools/build_search.ts
 *
 * The index is a generated artifact — never hand-edit; re-run after rebuilding
 * the document trees. It is not listed in the manifest (it is derived, not
 * source data), so the validation harness leaves it alone.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { loadManifest, loadPackFile } from '../src/lib/packs/fs-loader';
import type { DocumentTree } from '../src/lib/reference/document-tree';
import { miniSearchOptions, toPlainText, type SearchDoc } from '../src/lib/reference/search-fields';

const CONFIG = 'tools/srd.config.json';
const INDEX_FILE = 'search-index.json';

const config = JSON.parse(await readFile(CONFIG, 'utf-8')) as {
	packs: { packRoot: string }[];
};

for (const pack of config.packs) {
	const manifest = await loadManifest(pack.packRoot);
	const ruleFiles = manifest.files.filter((f) => f.startsWith('rules/')).sort();

	const docs: SearchDoc[] = [];
	const seen = new Set<string>();
	for (const file of ruleFiles) {
		const tree = (await loadPackFile(pack.packRoot, file)) as DocumentTree;
		for (const section of tree.sections) {
			// GM-only content is never shipped in the public index (it is served to
			// every client); a gated index is the phase-9 GM gate's concern.
			if (section.visibility === 'gm') continue;
			if (seen.has(section.id)) continue; // MiniSearch ids must be unique across the index
			seen.add(section.id);
			docs.push({
				id: section.id,
				title: section.title,
				breadcrumb: [...section.path, section.title].join(' › '),
				docTitle: tree.title,
				visibility: section.visibility,
				body: toPlainText(section.body)
			});
		}
	}

	const mini = new MiniSearch(miniSearchOptions);
	mini.addAll(docs);
	const out = join(pack.packRoot, INDEX_FILE);
	await writeFile(out, JSON.stringify(mini));
	console.log(`${out}: ${docs.length} sections indexed`);
}
