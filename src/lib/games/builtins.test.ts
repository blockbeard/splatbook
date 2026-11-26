import { describe, expect, it } from 'vitest';
import { BUILT_IN_GAMES, getGame } from './index';
import { BUILT_IN_GAME_IDS } from './ids';
import { match } from '../../params/game';

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

	// The URL matcher reads a plain list so that it doesn't load every game
	// (phase 33). The list has to stay the registry's.
	it('are the ids the URL matcher accepts', () => {
		expect([...BUILT_IN_GAME_IDS].sort()).toEqual(BUILT_IN_GAMES.map((g) => g.id).sort());
		for (const game of BUILT_IN_GAMES) expect(match(game.id)).toBe(true);
		expect(match('not-a-game')).toBe(false);
	});
});
