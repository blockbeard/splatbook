/**
 * Filesystem pack loader — node-only.
 *
 * Used by build-time tooling, the validation harness (`npm run validate:packs`)
 * and tests. Client-side pack access goes through `fetch` against
 * `/content-packs/…` instead; never import this module from browser code.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PackError, type PackManifest } from './types';

const MANIFEST = 'manifest.json';

/** Read and parse a JSON file inside a pack, throwing `PackError` on failure. */
async function readJson(packRoot: string, relPath: string): Promise<unknown> {
	let raw: string;
	try {
		raw = await readFile(join(packRoot, relPath), 'utf-8');
	} catch {
		throw new PackError('file missing or unreadable', packRoot, relPath);
	}
	try {
		return JSON.parse(raw);
	} catch (e) {
		throw new PackError(`invalid JSON — ${e instanceof Error ? e.message : e}`, packRoot, relPath);
	}
}

/**
 * Load and structurally check a pack's `manifest.json`.
 *
 * Checks here are the *envelope* contract only: required fields present and
 * of the right type, id matches the folder name, every listed file exists.
 * Schema validation of file contents is the game module's job.
 */
export async function loadManifest(packRoot: string): Promise<PackManifest> {
	const data = await readJson(packRoot, MANIFEST);

	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new PackError('manifest must be a JSON object', packRoot, MANIFEST);
	}
	const m = data as Record<string, unknown>;
	for (const key of ['id', 'name', 'version', 'license', 'attribution'] as const) {
		if (typeof m[key] !== 'string' || m[key] === '') {
			throw new PackError(`manifest field "${key}" must be a non-empty string`, packRoot, MANIFEST);
		}
	}
	if (!Array.isArray(m.files) || m.files.some((f) => typeof f !== 'string')) {
		throw new PackError('manifest field "files" must be an array of strings', packRoot, MANIFEST);
	}

	const manifest = m as unknown as PackManifest;

	if (manifest.id !== basename(packRoot)) {
		throw new PackError(
			`manifest id "${manifest.id}" does not match pack folder name "${basename(packRoot)}"`,
			packRoot,
			MANIFEST
		);
	}

	for (const file of manifest.files) {
		try {
			await stat(join(packRoot, file));
		} catch {
			throw new PackError('listed in manifest but not found on disk', packRoot, file);
		}
	}

	return manifest;
}

/** Load one data file from a pack as parsed-but-untyped JSON. */
export async function loadPackFile(packRoot: string, relPath: string): Promise<unknown> {
	return readJson(packRoot, relPath);
}

/** List pack folders (those containing a `manifest.json`) under a packs root. */
export async function listPackRoots(packsRoot: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(packsRoot, { withFileTypes: true });
	} catch {
		return [];
	}
	const roots: string[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const root = join(packsRoot, entry.name);
		try {
			await stat(join(root, MANIFEST));
			roots.push(root);
		} catch {
			// A folder without a manifest is not a pack; skip silently.
		}
	}
	return roots.sort();
}
