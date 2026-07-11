/**
 * Round-trip tests for the Stonetop content pack.
 *
 * Every file in the pack manifest must parse into its typed structure, and
 * the ids that other data refers to (playbooks, backgrounds, instincts,
 * moves, inserts) are snapshotted so an accidental rename fails CI instead
 * of silently orphaning references.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadManifest, loadPackFile } from '../../packs/fs-loader';
import { validatePack } from '../../packs/harness';
import type { PackManifest } from '../../packs/types';
import '../index'; // register game modules (wires stonetop schemas into the harness)
import { playbookSchema, insertSchema, schemaFor, type Playbook } from './pack-schemas';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'stonetop'
);

let manifest: PackManifest;
beforeAll(async () => {
	manifest = await loadManifest(packRoot);
});

describe('stonetop pack round-trip', () => {
	it('has the expected inventory of files', () => {
		expect(manifest.files).toHaveLength(24);
		expect(manifest.files.filter((f) => /insert-/.test(f))).toHaveLength(9);
		expect(manifest.files.filter((f) => /^rules\//.test(f))).toHaveLength(2);
		expect(manifest.files).toContain('data/basic-moves.json');
		expect(manifest.files).toContain('data/steading-moves.json');
	});

	it('passes the validation harness end to end', async () => {
		const result = await validatePack(packRoot);
		expect(result.errors).toEqual([]);
	});

	it('every file resolves to a schema and parses into a typed structure', async () => {
		for (const file of manifest.files) {
			const schema = schemaFor(file);
			expect(schema, `${file} has no schema`).not.toBeNull();
			const parsed = schema!.safeParse(await loadPackFile(packRoot, file));
			expect(
				parsed.success,
				`${file}: ${parsed.success ? '' : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
			).toBe(true);
		}
	});
});

describe('stonetop id snapshots', () => {
	const playbookFiles = [
		'data/the-blessed.json',
		'data/the-fox.json',
		'data/the-heavy.json',
		'data/the-judge.json',
		'data/the-lightbearer.json',
		'data/the-marshal.json',
		'data/the-ranger.json',
		'data/the-seeker.json',
		'data/the-would-be-hero.json'
	];

	it('playbook ids and their choice/move ids are stable', async () => {
		const ids: Record<string, unknown> = {};
		for (const file of playbookFiles) {
			const playbook: Playbook = playbookSchema.parse(await loadPackFile(packRoot, file));
			ids[playbook.id] = {
				backgrounds: playbook.backgrounds.map((b) => b.id),
				instincts: playbook.instincts.map((i) => i.id),
				moves: playbook.moves.list.map((m) => m.id),
				extras: playbook.extras.map((e) => e.id)
			};
		}
		expect(ids).toMatchSnapshot();
	});

	it('insert ids and their playbook attachments are stable', async () => {
		const inserts: Record<string, string> = {};
		for (const file of manifest.files.filter((f) => f.includes('insert-'))) {
			const insert = insertSchema.parse(await loadPackFile(packRoot, file));
			inserts[insert.id] = insert.appliesTo;
		}
		expect(inserts).toMatchSnapshot();
	});

	it('move references inside each playbook resolve to moves in the same playbook', async () => {
		for (const file of playbookFiles) {
			const playbook: Playbook = playbookSchema.parse(await loadPackFile(packRoot, file));
			const moveIds = new Set(playbook.moves.list.map((m) => m.id));
			const missing: string[] = [];
			const check = (ref: string, from: string) => {
				if (!moveIds.has(ref)) missing.push(`${from} → ${ref}`);
			};
			for (const ref of playbook.moves.starting.fixed ?? []) check(ref, 'starting.fixed');
			for (const group of playbook.moves.starting.pickOne ?? [])
				for (const ref of group) check(ref, 'starting.pickOne');
			for (const background of playbook.backgrounds)
				for (const ref of background.grants?.moves ?? []) check(ref, `background ${background.id}`);
			for (const move of playbook.moves.list) {
				for (const ref of move.requires?.moves ?? []) check(ref, `move ${move.id} requires`);
				if (move.childOf) check(move.childOf, `move ${move.id} childOf`);
				if (move.replaces) check(move.replaces, `move ${move.id} replaces`);
			}
			expect(missing, `${playbook.id}: dangling move references`).toEqual([]);
		}
	});
});
