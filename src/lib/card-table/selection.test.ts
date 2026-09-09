import { describe, expect, it, vi } from 'vitest';
import {
	DRAG_TYPE,
	createSelection,
	isContextGesture,
	readDrag,
	writeDrag,
	type Pick
} from './selection';

const card = (zone: string, card?: string): Pick => ({ zone, card });

describe('select and place', () => {
	it('holds nothing to begin with', () => {
		expect(createSelection().selected).toBeNull();
	});

	it('picks a card up and puts it where you point', () => {
		const s = createSelection();
		s.select(card('seat:s1:hand', 'swords-ace'));
		expect(s.selected).toEqual({ zone: 'seat:s1:hand', card: 'swords-ace' });
		expect(s.place('seat:s1:played')).toEqual({
			from: { zone: 'seat:s1:hand', card: 'swords-ace' },
			to: 'seat:s1:played'
		});
		expect(s.selected).toBeNull();
	});

	it('puts a card down when you pick the same one again', () => {
		// Otherwise somebody who grabs the wrong card has to find a harmless
		// place to click before they can grab the right one.
		const s = createSelection();
		s.select(card('deck:player'));
		s.select(card('deck:player'));
		expect(s.selected).toBeNull();
	});

	it('swaps to a different card rather than deselecting', () => {
		const s = createSelection();
		s.select(card('deck:player'));
		s.select(card('discard:player', 'cups-x'));
		expect(s.selected).toEqual({ zone: 'discard:player', card: 'cups-x' });
	});

	it('treats putting a card back where it came from as a cancel', () => {
		// Sending it would spend a command and reorder the pile for no reason
		// anybody intended.
		const s = createSelection();
		s.select(card('discard:player', 'cups-x'));
		expect(s.place('discard:player')).toBeNull();
		expect(s.selected).toBeNull();
	});

	it('places nothing when nothing is held', () => {
		expect(createSelection().place('discard:player')).toBeNull();
	});

	it('says where a held card could go, and nowhere when empty-handed', () => {
		const s = createSelection();
		expect(s.canDropIn('discard:player')).toBe(false);
		s.select(card('deck:player'));
		expect(s.canDropIn('discard:player')).toBe(true);
		expect(s.canDropIn('deck:player')).toBe(false);
	});

	it('tells a view layer when to redraw, and not otherwise', () => {
		const onChange = vi.fn();
		const s = createSelection(onChange);
		s.clear();
		expect(onChange).not.toHaveBeenCalled();
		s.select(card('deck:player'));
		s.clear();
		expect(onChange).toHaveBeenCalledTimes(2);
	});
});

describe('drag carries the same payload as a click', () => {
	const dragEvent = () => {
		const store: Record<string, string> = {};
		return {
			dataTransfer: {
				effectAllowed: '',
				setData: (k: string, v: string) => (store[k] = v),
				getData: (k: string) => store[k] ?? ''
			}
		} as unknown as DragEvent;
	};

	it('round-trips a pick', () => {
		const event = dragEvent();
		writeDrag(event, card('seat:s1:hand', 'wands-page'));
		expect(readDrag(event)).toEqual({ zone: 'seat:s1:hand', card: 'wands-page' });
	});

	it('ignores a drag from somewhere else entirely', () => {
		const event = dragEvent();
		event.dataTransfer!.setData('text/plain', 'a file, or some text');
		expect(readDrag(event)).toBeNull();
	});

	it('ignores our own key carrying nonsense', () => {
		const event = dragEvent();
		event.dataTransfer!.setData(DRAG_TYPE, 'not json');
		expect(readDrag(event)).toBeNull();
		event.dataTransfer!.setData(DRAG_TYPE, '{"nope":1}');
		expect(readDrag(event)).toBeNull();
	});
});

describe('context gestures', () => {
	it('counts a right-click', () => {
		expect(isContextGesture({ button: 2, ctrlKey: false } as MouseEvent)).toBe(true);
	});

	it('counts ctrl-click, which is how one of our players opens menus', () => {
		expect(isContextGesture({ button: 0, ctrlKey: true } as MouseEvent)).toBe(true);
	});

	it('leaves an ordinary click alone', () => {
		expect(isContextGesture({ button: 0, ctrlKey: false } as MouseEvent)).toBe(false);
		expect(isContextGesture({ button: 1, ctrlKey: false } as MouseEvent)).toBe(false);
	});
});
