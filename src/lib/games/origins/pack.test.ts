/**
 * Round-trip tests for the Origins 5.5e content pack (phase 28).
 *
 * Almost every file here is generated from a *community* markdown conversion of
 * SRD 5.2.1, so these tests are what make a re-import trustworthy. Two jobs:
 *
 * 1. **Snapshot the ids.** A re-import that loses a background, renames a feat,
 *    or drops half the spell list should fail CI, not quietly shrink the
 *    builder. The extractor is strict about parsing; this is strict about what
 *    came out.
 * 2. **Check the joins.** A background names a feat; a species choice names a
 *    skill; a Magic Initiate background names a spell list. Nothing in the
 *    pipeline enforces that those resolve — so this does.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadManifest, loadPackFile } from '../../packs/fs-loader';
import { validatePack } from '../../packs/harness';
import type { PackManifest } from '../../packs/types';
import '../index'; // register game modules (wires origins schemas into the harness)
import {
	backgroundsSchema,
	equipmentSchema,
	featsSchema,
	originsRulesSchema,
	referenceClassesSchema,
	referenceSchema,
	speciesSchema,
	spellsSchema,
	type Backgrounds,
	type Equipment,
	type Feats,
	type OriginsRules,
	type ReferenceClasses,
	type ReferenceData,
	type SpeciesPack,
	type Spells
} from './pack-schemas';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'origins'
);

let manifest: PackManifest;
let backgrounds: Backgrounds;
let species: SpeciesPack;
let classes: ReferenceClasses;
let feats: Feats;
let equipment: Equipment;
let spells: Spells;
let reference: ReferenceData;
let rules: OriginsRules;

beforeAll(async () => {
	const load = async (file: string) => await loadPackFile(packRoot, file);
	manifest = await loadManifest(packRoot);
	backgrounds = backgroundsSchema.parse(await load('data/backgrounds.json'));
	species = speciesSchema.parse(await load('data/species.json'));
	classes = referenceClassesSchema.parse(await load('data/reference-classes.json'));
	feats = featsSchema.parse(await load('data/feats.json'));
	equipment = equipmentSchema.parse(await load('data/equipment.json'));
	spells = spellsSchema.parse(await load('data/spells.json'));
	reference = referenceSchema.parse(await load('data/reference.json'));
	rules = originsRulesSchema.parse(await load('data/origins-rules.json'));
});

describe('origins pack round-trip', () => {
	it('validates through the shared harness', async () => {
		const result = await validatePack(packRoot);
		expect(result.errors).toEqual([]);
	});

	it('declares one licence for two bodies of CC BY 4.0 text', () => {
		expect(manifest.license).toBe('CC-BY-4.0');
		// Both credits are required by the licence, and /credits renders this
		// field verbatim — losing either one is a licensing defect, not a typo.
		expect(manifest.attribution).toContain('Patchwork Paladin');
		expect(manifest.attribution).toContain('SRD 5.2.1');
		expect(manifest.attribution).toContain('Wizards of the Coast');
	});

	it('ships exactly the SRD’s four backgrounds', () => {
		expect(backgrounds.backgrounds.map((b) => b.id)).toEqual([
			'acolyte',
			'criminal',
			'sage',
			'soldier'
		]);
	});

	it('ships exactly the SRD’s nine species', () => {
		expect(species.species.map((s) => s.id)).toEqual([
			'dragonborn',
			'dwarf',
			'elf',
			'gnome',
			'goliath',
			'halfling',
			'human',
			'orc',
			'tiefling'
		]);
	});

	it('ships all twelve classes, each with a hit die and armor training', () => {
		expect(classes.referenceClasses.map((c) => c.id)).toEqual([
			'barbarian',
			'bard',
			'cleric',
			'druid',
			'fighter',
			'monk',
			'paladin',
			'ranger',
			'rogue',
			'sorcerer',
			'warlock',
			'wizard'
		]);
		for (const c of classes.referenceClasses) {
			expect([6, 8, 10, 12], c.id).toContain(c.hitDie);
		}
		// Spot-check the two ends of the range against the SRD's own tables.
		const by = (id: string) => classes.referenceClasses.find((c) => c.id === id)!;
		expect(by('barbarian').hitDie).toBe(12);
		expect(by('wizard').hitDie).toBe(6);
		expect(by('fighter').armorTraining).toMatchObject({ heavy: true, shields: true });
		expect(by('wizard').armorTraining).toMatchObject({ light: false, shields: false });
	});

	it('ships exactly the SRD’s four Origin feats', () => {
		expect(feats.feats.map((f) => f.id)).toEqual([
			'alert',
			'magic-initiate',
			'savage-attacker',
			'skilled'
		]);
	});

	it('every background’s feat resolves to a shipped feat', () => {
		const featIds = new Set(feats.feats.map((f) => f.id));
		for (const b of backgrounds.backgrounds) {
			expect(featIds.has(b.feat.id), `${b.id} → ${b.feat.id}`).toBe(true);
		}
	});

	it('every background’s skills resolve to real skills', () => {
		const skills = new Set(reference.skills.map((s) => s.name));
		for (const b of backgrounds.backgrounds) {
			for (const skill of b.skillProficiencies) {
				expect(skills.has(skill), `${b.id} → ${skill}`).toBe(true);
			}
		}
	});

	it('only Magic Initiate backgrounds name a spell list, and the list has spells', () => {
		const casters = backgrounds.backgrounds.filter((b) => b.feat.spellList);
		// Acolyte (Cleric) and Sage (Wizard) — Criminal and Soldier are not casters.
		expect(casters.map((b) => [b.id, b.feat.spellList])).toEqual([
			['acolyte', 'cleric'],
			['sage', 'wizard']
		]);
		for (const b of casters) {
			expect(b.feat.id).toBe('magic-initiate');
			const available = spells.spells.filter((s) => s.lists.includes(b.feat.spellList!));
			expect(available.length, b.id).toBeGreaterThan(0);
		}
	});

	it('carries only cantrips and level 1 spells, on the three Magic Initiate lists', () => {
		expect(spells.spells.length).toBeGreaterThan(50);
		for (const s of spells.spells) {
			expect([0, 1], s.name).toContain(s.level);
		}
		const lists = new Set(spells.spells.flatMap((s) => s.lists));
		expect([...lists].sort()).toEqual(['cleric', 'druid', 'wizard']);
		// Each list needs both tiers, or the builder has nothing to offer.
		for (const list of ['cleric', 'druid', 'wizard'] as const) {
			for (const level of [0, 1]) {
				const found = spells.spells.filter((s) => s.lists.includes(list) && s.level === level);
				expect(found.length, `${list} level ${level}`).toBeGreaterThan(0);
			}
		}
	});

	it('flags rituals, which Origins casts for free', () => {
		const rituals = spells.spells.filter((s) => s.ritual);
		expect(rituals.length).toBeGreaterThan(0);
		for (const s of rituals) expect(s.castingTime, s.name).toContain('Ritual');
	});

	it('ships the equipment packs Origins names by name', () => {
		const names = equipment.packs.map((p) => p.name);
		// The post's own examples — a missing one is a rule the builder can't follow.
		for (const pack of ["Burglar's Pack", "Scholar's Pack", "Dungeoneer's Pack", "Priest's Pack"]) {
			expect(names, pack).toContain(pack);
		}
		for (const p of equipment.packs) expect(p.contents.length, p.id).toBeGreaterThan(0);
	});

	it('gives armor an AC formula the sheet can compute from', () => {
		const by = (id: string) => equipment.armor.find((a) => a.id === id)!;
		expect(by('leather-armor')).toMatchObject({ baseAc: 11, addsDex: true, dexCap: null });
		expect(by('half-plate-armor')).toMatchObject({ baseAc: 15, addsDex: true, dexCap: 2 });
		expect(by('plate-armor')).toMatchObject({ baseAc: 18, addsDex: false });
		// A Shield adds rather than sets — the one row that breaks the pattern.
		expect(by('shield')).toMatchObject({ category: 'Shield', baseAc: null, acBonus: 2 });
	});

	it('every species choice offers options or names a pool that exists', () => {
		const skills = new Set(reference.skills.map((s) => s.name));
		const featIds = new Set(feats.feats.map((f) => f.id));
		for (const sp of species.species) {
			for (const choice of sp.choices ?? []) {
				// A choice usually hangs off a named trait; the size choices hang off
				// the species' Size line instead, and say so by omitting `trait`.
				if (choice.trait) {
					expect(
						sp.traits.some((t) => t.name === choice.trait),
						`${sp.id}/${choice.id} names trait "${choice.trait}", which the species does not have`
					).toBe(true);
				} else {
					expect(choice.grants, `${sp.id}/${choice.id}`).toBe('size');
				}
				if (choice.options && choice.grants === 'skill') {
					for (const o of choice.options) expect(skills.has(o.name), o.name).toBe(true);
				}
			}
		}
		// Human's Versatile draws from the origin feats; the pool must be real.
		const human = species.species.find((s) => s.id === 'human')!;
		const versatile = human.choices?.find((c) => c.id === 'versatile');
		expect(versatile?.from).toBe('origin-feats');
		expect(featIds.size).toBeGreaterThan(0);
	});

	it('carries the SRD’s eighteen skills and its standard languages', () => {
		expect(reference.skills).toHaveLength(18);
		expect(reference.languages).toContain('Common');
		expect(reference.languages.length).toBeGreaterThan(5);
	});

	it('states the Origins rules that differ from plain 5e', () => {
		// Each of these is a place someone could "fix" the builder back to
		// standard 5e without noticing. The pack is where the hack lives.
		expect(rules.rules.proficiencyBonus).toBe(2);
		expect(rules.rules.referenceClass.grants).toEqual([
			'hitDie',
			'armorTraining',
			'shields',
			'weaponProficiencies'
		]);
		expect(rules.rules.equipment.startingGold.base).toBe(100);
		expect(rules.rules.equipment.startingGold.withMediumOrHeavyArmorTraining).toBe(150);
		expect(rules.rules.hitPoints.method).toBe('roll');
		expect(rules.rules.spellcasting.maxSpellLevel).toBe(1);
		expect(rules.rules.languages.count).toBe(2);
		expect(rules.abilityGeneration.standardArray).toEqual([15, 14, 13, 12, 10, 8]);
		expect(rules.abilityGeneration.pointBuy.budget).toBe(27);
	});

	it('credits the hack’s author and links the post it came from', () => {
		expect(rules.source.author).toBe('Patchwork Paladin');
		expect(rules.source.url).toContain('patchworkpaladin.com');
	});
});
