import { describe, expect, it } from 'vitest';
import { BUILT_IN_GAMES, getGame } from './index';

describe('built-in games', () => {
	// The registry replaces a repeat id rather than throwing (dev module
	// re-evaluation re-registers), so a copy-pasted id in the list would
	// otherwise silently shadow a game. This is where that can happen.
	it('claim distinct ids', () => {
		const ids = BUILT_IN_GAMES.map((g) => g.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('are all registered on import', () => {
		for (const game of BUILT_IN_GAMES) {
			expect(getGame(game.id)).toBe(game);
		}
	});
});
