/**
 * Origins 5.5e — game #3 (phase 28).
 *
 * A classless, level-less hack of SRD 5.2.1 by Patchwork Paladin: you build a
 * character out of the character-origin rules alone — a background, a species,
 * ability scores — and borrow a "reference class" for nothing but its Hit Point
 * Die, Armor Training, Shields, and Weapon Proficiencies. No class features, no
 * saving-throw proficiencies, no levels, and therefore a proficiency bonus
 * fixed at +2.
 *
 * Scoped to a character builder: no rules reference, no GM guide, no campaign
 * surface. The hack is one blog post and the SRD is a click away, both linked
 * from the game's front door.
 *
 * Both bodies of text are CC BY 4.0 — Origins 5.5e © 2026 Patchwork Paladin,
 * and SRD 5.2.1 © 2024 Wizards of the Coast LLC — so the pack carries one
 * licence and both credits. See the pack's LICENSE.md.
 */

import type { GameModule } from '../types';
import { schemaFor } from './pack-schemas';
// The game's own skin. Scoped to `[data-game="origins"]`, which the shell
// stamps on the game's routes — inert everywhere else.
import './theme.css';

export const origins: GameModule = {
	id: 'origins',
	name: 'Origins 5.5e',
	packSchemas: schemaFor
};
