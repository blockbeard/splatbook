import { describe, expect, it } from 'vitest';
import { reverseOf, type PublicEvent } from './undo';

const move = (version: number, from: string, to: string, seat = 's1'): PublicEvent => ({
	version,
	kind: 'move',
	data: { from, to, seat }
});

describe('putting a card back', () => {
	it('reverses the last move', () => {
		const r = reverseOf([move(1, 'deck:player', 'discard:player')], 's1');
		expect(r?.command).toEqual({
			type: 'move',
			from: { zone: 'discard:player' },
			to: 'deck:player'
		});
	});

	it('reverses the *last* one, not the first', () => {
		const r = reverseOf([move(1, 'deck:player', 'fate'), move(2, 'fate', 'discard:player')], 's1');
		expect(r?.command).toMatchObject({ from: { zone: 'discard:player' }, to: 'fate' });
	});

	it('looks past events that could not have disturbed a pile', () => {
		const events: PublicEvent[] = [
			move(1, 'deck:player', 'fate'),
			{ version: 2, kind: 'count', data: { count: 4 } },
			{ version: 3, kind: 'guided', data: { on: true } }
		];
		expect(reverseOf(events, 's1')?.command).toMatchObject({ to: 'deck:player' });
	});

	it('gives up once something has moved cards since', () => {
		// A reshuffle put a different card on top of the fate slot, so putting
		// "that card" back would put back one nobody touched.
		const events: PublicEvent[] = [
			move(1, 'deck:player', 'fate'),
			{ version: 2, kind: 'reshuffle', data: { deck: 'player' } }
		];
		expect(reverseOf(events, 's1')).toBeNull();
	});

	it('treats a kind it has never heard of as having moved cards', () => {
		const events: PublicEvent[] = [
			move(1, 'deck:player', 'fate'),
			{ version: 2, kind: 'some-later-command', data: {} }
		];
		expect(reverseOf(events, 's1')).toBeNull();
	});

	it('offers nothing when nothing has been moved', () => {
		expect(reverseOf([], 's1')).toBeNull();
		expect(reverseOf([{ version: 1, kind: 'count', data: {} }], 's1')).toBeNull();
	});

	it('undoes a move into your own hand, because that is yours to reach into', () => {
		const r = reverseOf([move(1, 'deck:player', 'seat:s1:hand')], 's1');
		expect(r?.command).toMatchObject({ from: { zone: 'seat:s1:hand' } });
	});

	it('offers nothing for a card that went into somebody else’s hand', () => {
		expect(reverseOf([move(1, 'deck:player', 'seat:s2:hand')], 's1')).toBeNull();
	});

	it('offers nothing for a card that came out of somebody else’s hand', () => {
		expect(reverseOf([move(1, 'seat:s2:hand', 'discard:player')], 's1')).toBeNull();
	});

	it('offers a watcher nothing that touches a hand', () => {
		// No seat, no reach: every hand is somebody else's.
		expect(reverseOf([move(1, 'deck:player', 'seat:s1:hand')], null)).toBeNull();
	});

	it('ignores an event whose shape it does not recognise', () => {
		const odd: PublicEvent[] = [{ version: 1, kind: 'move', data: { nothing: true } }];
		expect(reverseOf(odd, 's1')).toBeNull();
	});
});
