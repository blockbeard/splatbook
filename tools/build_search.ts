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
import { buildLinkIndex, serializeLinkIndex } from '../src/lib/reference/inline';
import { miniSearchOptions, toPlainText, type SearchDoc } from '../src/lib/reference/search-fields';

const CONFIG = 'tools/srd.config.json';
const INDEX_FILE = 'search-index.json';
/** GM-only sections go in a separate index, loaded only for campaign GMs (commit 62). */
const GM_INDEX_FILE = 'search-index-gm.json';
/** Wikilink targets → section ids (phase 21) — the compact lookup surfaces
 * outside the reference (move cards, steading lines) fetch instead of the
 * full trees. Derived like the search indexes: not in the manifest. */
const LINK_INDEX_FILE = 'link-index.json';

const config = JSON.parse(await readFile(CONFIG, 'utf-8')) as {
	packs: { packRoot: string }[];
};

async function writeIndex(packRoot: string, file: string, docs: SearchDoc[]): Promise<void> {
	const mini = new MiniSearch(miniSearchOptions);
	mini.addAll(docs);
	const out = join(packRoot, file);
	await writeFile(out, JSON.stringify(mini));
	console.log(`${out}: ${docs.length} sections indexed`);
}

for (const pack of config.packs) {
	const manifest = await loadManifest(pack.packRoot);
	const ruleFiles = manifest.files.filter((f) => f.startsWith('rules/')).sort();

	// Two indexes: the default one players load, and a GM-only one gated behind
	// campaign-GM membership (the reference GM gate). Splitting them keeps the
	// player-facing index free of GM text; the GM index is served the same way
	// Book II's tree already is, and loaded only when the gate is open.
	const playerDocs: SearchDoc[] = [];
	const gmDocs: SearchDoc[] = [];
	const trees: DocumentTree[] = [];
	const seen = new Set<string>();
	for (const file of ruleFiles) {
		const tree = (await loadPackFile(pack.packRoot, file)) as DocumentTree;
		trees.push(tree);
		for (const section of tree.sections) {
			if (seen.has(section.id)) continue; // MiniSearch ids must be unique across the index
			seen.add(section.id);
			(section.visibility === 'gm' ? gmDocs : playerDocs).push({
				id: section.id,
				title: section.title,
				breadcrumb: [...section.path, section.title].join(' › '),
				docTitle: tree.title,
				visibility: section.visibility,
				body: toPlainText(section.body)
			});
		}
	}

	await writeIndex(pack.packRoot, INDEX_FILE, playerDocs);
	await writeIndex(pack.packRoot, GM_INDEX_FILE, gmDocs);

	const linkIndex = serializeLinkIndex(buildLinkIndex(trees));
	const linkOut = join(pack.packRoot, LINK_INDEX_FILE);
	await writeFile(linkOut, JSON.stringify(linkIndex));
	console.log(
		`${linkOut}: ${Object.keys(linkIndex.byTitle).length} titles, ` +
			`${Object.keys(linkIndex.byBlockId).length} block ids`
	);
}
