/**
 * His Majesty the Worm — game #2 (phase 22).
 *
 * Deliberately a rules reference and nothing else: no entity types, no
 * builders, no trackers, no campaign surface. The reader lives at
 * `/hmtw/reference`, with the Gamemaster's chapters (10, and Appendices C–E)
 * behind the per-game spoiler opt-in. Primary consumer is a Zoom Whiteboard
 * iframe via the shell's embed mode (`?embed=1`).
 *
 * Text used with Josh McCrowell's direct OK (2026-08-06); the Tomb of Golden
 * Ghosts starter dungeon stays out at his request. See the pack's LICENSE.md
 * for the license text and required compatibility statement.
 */

import type { GameModule } from '../types';
import { schemaFor } from './pack-schemas';
import './theme.css';

export const hmtw: GameModule = {
	id: 'hmtw',
	name: 'His Majesty the Worm',
	packSchemas: schemaFor,
	favicon: '/content-packs/hmtw/art/worm.svg',
	// Pages stop at h3: the book's h4/h5 sections are talent entries, spell
	// components, and statblock fragments — they read inline, not as pages.
	referencePageDepth: 3,
	referenceSpoilers: {
		badge: 'GM',
		toggleLabel: 'Include the Gamemaster’s chapters — monsters, secrets, and the underworld',
		// The pack-authored "For the Gamemaster's Eyes" note (its own gated
		// document in the tree): the book has 63 player-chapter links into GM
		// chapters — 34 from the Index alone — and they should land on an
		// explanation with the opt-in, not a bare 404.
		interstitialSectionId: 'for-the-gamemaster-s-eyes'
	}
};
