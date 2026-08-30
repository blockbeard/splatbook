/**
 * Test-only pack loading.
 *
 * The engine's tests run against the **real shipped pack**, not hand-written
 * fixtures. A hand-written fixture would let the engine and the pack drift
 * apart silently, and drift is exactly what these tests exist to catch: if a
 * re-import changes a background's feat or a class's hit die, the engine tests
 * should notice.
 *
 * Node-only (it reads from disk), so nothing outside a `*.test.ts` may import it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	backgroundsSchema,
	equipmentSchema,
	featsSchema,
	originsRulesSchema,
	referenceClassesSchema,
	referenceSchema,
	speciesSchema,
	spellsSchema
} from '../pack-schemas';

const dataDir = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'origins',
	'data'
);

const read = (file: string): unknown =>
	JSON.parse(readFileSync(join(dataDir, file), 'utf-8')) as unknown;

export const rules = originsRulesSchema.parse(read('origins-rules.json'));
export const backgrounds = backgroundsSchema.parse(read('backgrounds.json')).backgrounds;
export const species = speciesSchema.parse(read('species.json')).species;
export const referenceClasses = referenceClassesSchema.parse(
	read('reference-classes.json')
).referenceClasses;
export const feats = featsSchema.parse(read('feats.json')).feats;
export const equipment = equipmentSchema.parse(read('equipment.json'));
export const spells = spellsSchema.parse(read('spells.json')).spells;
export const reference = referenceSchema.parse(read('reference.json'));

export const background = (id: string) => backgrounds.find((b) => b.id === id)!;
export const speciesById = (id: string) => species.find((s) => s.id === id)!;
export const referenceClass = (id: string) => referenceClasses.find((c) => c.id === id)!;
export const skill = (id: string) => reference.skills.find((s) => s.id === id)!;
export const spell = (id: string) => spells.find((s) => s.id === id)!;
