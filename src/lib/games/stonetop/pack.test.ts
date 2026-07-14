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
import {
	playbookSchema,
	insertSchema,
	insertFollowersSchema,
	insertCrewSchema,
	insertAnimalCompanionSchema,
	insertInitiatesOfDanuSchema,
	insertInvocationsSchema,
	insertGhostSchema,
	insertRevenantSchema,
	insertThrallSchema,
	schemaFor,
	type Playbook
} from './pack-schemas';

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
		expect(manifest.files).toHaveLength(25);
		expect(manifest.files.filter((f) => /insert-/.test(f))).toHaveLength(9);
		expect(manifest.files.filter((f) => /^rules\//.test(f))).toHaveLength(2);
		expect(manifest.files).toContain('data/basic-moves.json');
		expect(manifest.files).toContain('data/steading-moves.json');
		expect(manifest.files).toContain('data/end-of-session.json');
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

	it('typed insert interiors are stable (commit 100)', async () => {
		const ids: Record<string, unknown> = {};

		const followers = insertFollowersSchema.parse(
			await loadPackFile(packRoot, 'data/insert-followers.json')
		);
		ids[followers.id] = { fields: followers.followerBlock.fields };

		const crew = insertCrewSchema.parse(await loadPackFile(packRoot, 'data/insert-crew.json'));
		ids[crew.id] = { rules: crew.rules.map((r) => r.id) };

		const animalCompanion = insertAnimalCompanionSchema.parse(
			await loadPackFile(packRoot, 'data/insert-animal-companion.json')
		);
		ids[animalCompanion.id] = { types: animalCompanion.types.map((t) => t.id) };

		const initiates = insertInitiatesOfDanuSchema.parse(
			await loadPackFile(packRoot, 'data/insert-initiates-of-danu.json')
		);
		ids[initiates.id] = { initiates: initiates.initiates.map((i) => i.id) };

		const invocations = insertInvocationsSchema.parse(
			await loadPackFile(packRoot, 'data/insert-invocations.json')
		);
		ids[invocations.id] = { invocations: invocations.invocations.map((i) => i.id) };

		const ghost = insertGhostSchema.parse(await loadPackFile(packRoot, 'data/insert-ghost.json'));
		ids[ghost.id] = {
			moves: ghost.moves.list.map((m) => m.id),
			terriblePurpose: ghost.terriblePurpose.options.map((o) => o.id),
			consequences: ghost.consequences.list.map((c) => c.id)
		};

		const revenant = insertRevenantSchema.parse(
			await loadPackFile(packRoot, 'data/insert-revenant.json')
		);
		ids[revenant.id] = {
			moves: revenant.moves.list.map((m) => m.id),
			terriblePurposeSameAs: revenant.terriblePurpose.sameAs,
			consequences: revenant.consequences.list.map((c) => c.id)
		};

		const thrall = insertThrallSchema.parse(
			await loadPackFile(packRoot, 'data/insert-thrall.json')
		);
		ids[thrall.id] = {
			moves: thrall.moves.list.map((m) => m.id),
			marks: thrall.marks.list.map((m) => m.id)
		};

		expect(ids).toMatchSnapshot();
	});

	it("ghost and revenant's consequence childOf/requires references resolve within their own list", async () => {
		for (const [file, schema] of [
			['data/insert-ghost.json', insertGhostSchema],
			['data/insert-revenant.json', insertRevenantSchema]
		] as const) {
			const insert = schema.parse(await loadPackFile(packRoot, file));
			const consequenceIds = new Set(insert.consequences.list.map((c) => c.id));
			const missing: string[] = [];
			for (const consequence of insert.consequences.list) {
				if (consequence.childOf && !consequenceIds.has(consequence.childOf)) {
					missing.push(`${consequence.id} childOf → ${consequence.childOf}`);
				}
				for (const ref of consequence.requires?.consequences ?? []) {
					if (!consequenceIds.has(ref)) missing.push(`${consequence.id} requires → ${ref}`);
				}
			}
			expect(missing, `${insert.id}: dangling consequence references`).toEqual([]);
		}
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
