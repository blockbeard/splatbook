/**
 * The Stonetop game module — first game in the framework; served as
 * "Ringwall" at `/g/stonetop`.
 *
 * Contributes identity, pack schemas, and (phase 3) the pure rules engine.
 * Wizard steps and sheet component fill their slots as the phase-3 commits
 * land. The shell treats `engine` as opaque; only Stonetop's own step/sheet
 * code reaches into it with types.
 */

import type { GameModule } from '../types';
import { schemaFor } from './pack-schemas';
import { engine } from './engine';

export const stonetop: GameModule = {
	id: 'stonetop',
	name: 'Stonetop',
	packSchemas: schemaFor,
	engine
};
