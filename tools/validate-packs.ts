/**
 * `npm run validate:packs` — validate every content pack under
 * static/content-packs/ against the envelope contract and whatever schemas
 * each pack's game module has registered. Exits non-zero on any problem,
 * so CI can gate on it.
 *
 * Run with tsx from the repo root.
 */

import { listPackRoots } from '../src/lib/packs/fs-loader';
import { validatePack } from '../src/lib/packs/harness';

// Game modules register their pack schemas as an import side effect.
// (None yet — the stonetop module arrives with its pack.)

const PACKS_ROOT = 'static/content-packs';

const roots = await listPackRoots(PACKS_ROOT);
if (roots.length === 0) {
	console.log(`No content packs found under ${PACKS_ROOT}/ — nothing to validate.`);
	process.exit(0);
}

let failed = false;
for (const root of roots) {
	const result = await validatePack(root);
	if (result.errors.length === 0) {
		console.log(`✓ ${root} (${result.manifest?.name}, ${result.manifest?.files.length} files)`);
	} else {
		failed = true;
		console.error(`✗ ${root}`);
		for (const error of result.errors) console.error(`  ${error}`);
	}
}

process.exit(failed ? 1 : 0);
