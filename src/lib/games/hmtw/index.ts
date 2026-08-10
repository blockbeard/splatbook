/**
 * His Majesty the Worm — game #2 (phase 22).
 *
 * Deliberately a rules reference and nothing else: no entity types, no
 * builders, no trackers, no campaign surface. The reader lives at
 * `/hmtw/reference`, with the Gamemaster's chapters (10, and Appendices C–E)
 * behind the per-game spoiler opt-in. Primary consumer is a Zoom Whiteboard
 * iframe via the shell's embed mode (`?embed=1`).
 *
 * Text used under the book's own published reuse grant — its mechanics and
 * game text may be reused freely, and third-party compatible works are
 * welcomed. That grant is the whole basis, and it is enough on its own: this
 * project has no permission from Josh McCrowell specific to it, and must not
 * claim one. The Tomb of Golden Ghosts starter dungeon stays out. See the
 * pack's LICENSE.md for the grant verbatim and the required compatibility
 * statement.
 */

import type { GameModule } from '../types';
import { schemaFor } from './pack-schemas';
import { referencePageDepth } from './reference-config';
import './theme.css';

export const hmtw: GameModule = {
	id: 'hmtw',
	name: 'His Majesty the Worm',
	packSchemas: schemaFor,
	favicon: '/content-packs/hmtw/art/ouroboros.svg',
	// Pages stop at h3 (see ./reference-config, which the page-artifact build
	// shares so the two can't disagree).
	referencePageDepth,
	// The book opens chapters with a literary epigraph — Leiber, Dante, Zork.
	// Lovely in a book you read front to back; pure toll in a reference you
	// open mid-session with a question, because it sits above the fold on
	// exactly the pages a reader lands on. The corpus settles it: 40 of them,
	// median 290 characters, 12 over 400, longest 804 — on a phone the Leiber
	// quotation is a full screen of centred script between the reader and the
	// rule they came for. Length-gating the display face was considered and
	// rejected: a 200-character cut-off would demote 26 of 40, so the
	// treatment is wrong rather than the length.
	//
	// Omitted here, not deleted from the pack: the text stays in
	// `content/hmtw/rules/` and this line is the whole of the decision.
	referenceOmitCallouts: ['epigraph'],
	referenceSpoilers: {
		badge: 'GM',
		toggleLabel: 'Include the Gamemaster’s chapters — monsters, secrets, and the underworld',
		// The pack-authored "Gamemaster Content" note (its own document in the
		// tree): the book has 63 player-chapter links into GM chapters — 34 from
		// the Index alone — and they should land on an explanation with the
		// opt-in, not a bare 404.
		//
		// The note is player-visible, so it also lists in the contents and
		// answers a search. Gated (as it was until now) it was invisible to
		// exactly the reader it was written for, and the sidebar checkbox was
		// the only trace of the gate a player could find — worse on mobile,
		// where the contents is a drawer you have to go looking in.
		interstitialSectionId: 'gamemaster-content'
	}
};
