/**
 * Pack validation harness.
 *
 * The shell validates only the envelope (manifest, generic document trees).
 * Game modules own the schemas for their data files and register them here;
 * `npm run validate:packs` then checks every pack on disk against whatever
 * its game has registered. A pack whose game registered nothing is an error —
 * unvalidated content is a bug, not a default.
 */

import type { z } from 'zod';
import { PackError, type PackManifest } from './types';

/**
 * Resolves a pack-relative file path to the schema that validates it.
 * Return `null` for files the game does not recognise — the harness reports
 * those as errors, so packs cannot silently carry unvalidated files.
 */
export type SchemaResolver = (relPath: string) => z.ZodType | null;

const resolvers = new Map<string, SchemaResolver>();

/** Register the schema resolver for one game. Later registrations replace earlier ones. */
export function registerPackSchemas(gameId: string, resolver: SchemaResolver): void {
	resolvers.set(gameId, resolver);
}

/** Test helper — forget all registrations. */
export function clearPackSchemas(): void {
	resolvers.clear();
}

export interface PackValidationResult {
	packRoot: string;
	manifest?: PackManifest;
	/** Human-readable problems; empty means the pack is valid. */
	errors: string[];
}

/**
 * Validate one pack folder: envelope first, then every listed file against its
 * game's schemas.
 *
 * The filesystem loader is imported lazily, and deliberately. Registration
 * (`registerPackSchemas`) runs in the browser — every game module calls it on
 * import — so a static `./fs-loader` import puts `node:fs/promises` in the
 * client graph, where Vite externalises it and hydration dies on first access.
 * Validation itself only ever runs under node (tooling and tests).
 */
export async function validatePack(packRoot: string): Promise<PackValidationResult> {
	const { loadManifest, loadPackFile } = await import('./fs-loader');
	const result: PackValidationResult = { packRoot, errors: [] };

	let manifest: PackManifest;
	try {
		manifest = await loadManifest(packRoot);
	} catch (e) {
		result.errors.push(e instanceof Error ? e.message : String(e));
		return result;
	}
	result.manifest = manifest;

	const resolve = resolvers.get(manifest.id);
	if (!resolve) {
		result.errors.push(
			`${packRoot}: no schemas registered for game "${manifest.id}" — ` +
				`the game module must call registerPackSchemas()`
		);
		return result;
	}

	for (const file of manifest.files) {
		const schema = resolve(file);
		if (!schema) {
			result.errors.push(`${packRoot}/${file}: game "${manifest.id}" has no schema for this file`);
			continue;
		}
		let data: unknown;
		try {
			data = await loadPackFile(packRoot, file);
		} catch (e) {
			result.errors.push(e instanceof PackError ? e.message : String(e));
			continue;
		}
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const path = issue.path.length ? issue.path.join('.') : '(root)';
				result.errors.push(`${packRoot}/${file}: ${path}: ${issue.message}`);
			}
		}
	}

	return result;
}
