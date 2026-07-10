/**
 * The Stonetop game module — first game in the framework; served as
 * "Ringwall" at `/g/stonetop`.
 *
 * Engine, wizard steps, and sheet component arrive in phase 3. Until then
 * the module contributes identity and pack schemas only.
 */

import type { GameModule } from '../types';
import { schemaFor } from './pack-schemas';

export const stonetop: GameModule = {
	id: 'stonetop',
	name: 'Stonetop',
	packSchemas: schemaFor
};
