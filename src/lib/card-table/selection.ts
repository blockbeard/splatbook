/**
 * The input model: click to select, click to place — with drag as the same
 * thing by another route.
 *
 * Framework-free on purpose, so it can be tested without a browser and reused
 * by whatever renders the table.
 *
 * **Why click-to-place is primary.** It is the only interaction that works on a
 * phone without fighting the scroll, and it carries most of the keyboard and
 * screen-reader story for free: select is a button press, place is a button
 * press, and both announce themselves. Drag is the enhancement for people with
 * a pointer, who reasonably expect a card table to behave like one. Neither is
 * a fallback for the other; both do everything.
 *
 * **Nothing is reachable only by right-click.** A player who never finds
 * right-click in a VTT should not lose half the table, so any context menu is a
 * duplicate of a visible control — and where one exists, `ctrl`-click on macOS
 * must open it, which is what `isContextGesture` is for.
 */

/** What is being moved: a slot, and a card within it only where that is public. */
export interface Pick {
	zone: string;
	card?: string;
}

export interface Placement {
	from: Pick;
	to: string;
}

export interface SelectionState {
	/** What is picked up, if anything. */
	readonly selected: Pick | null;
	/** Pick something up, or put it down if it was already held. */
	select(pick: Pick): void;
	/** Put down whatever is held, without moving it. */
	clear(): void;
	/**
	 * Place what is held into `zone`. Returns the move to send, or null if
	 * nothing was held — or if it would land where it started, which is a
	 * cancel rather than a move nobody asked for.
	 */
	place(zone: string): Placement | null;
	/** Whether this zone is a place the held card could go. */
	canDropIn(zone: string): boolean;
}

const samePick = (a: Pick, b: Pick): boolean => a.zone === b.zone && a.card === b.card;

/**
 * Create a selection.
 *
 * `onChange` fires whenever what is held changes, so a view layer can re-render
 * without this module knowing what a view layer is.
 */
export function createSelection(onChange?: () => void): SelectionState {
	let selected: Pick | null = null;
	const changed = () => onChange?.();

	return {
		get selected() {
			return selected;
		},
		select(pick) {
			// Selecting the held card again puts it down. Without this, a player
			// who picks up the wrong card has to find somewhere harmless to click.
			selected = selected && samePick(selected, pick) ? null : pick;
			changed();
		},
		clear() {
			if (selected === null) return;
			selected = null;
			changed();
		},
		place(zone) {
			if (!selected) return null;
			const from = selected;
			selected = null;
			changed();
			// Landing where it started is a cancel, not a move: sending it would
			// spend a command and reorder the pile for no reason anyone intended.
			return from.zone === zone ? null : { from, to: zone };
		},
		canDropIn(zone) {
			return selected !== null && selected.zone !== zone;
		}
	};
}

/**
 * Whether an event is asking for a context menu.
 *
 * `ctrl`-click on macOS is a right-click and browsers do fire `contextmenu` for
 * it — but only if nothing has swallowed the click first, which is easy to do
 * by accident on a surface where every card is clickable. Checking explicitly
 * means the gesture keeps working on the one setup most likely to need it.
 */
export function isContextGesture(event: MouseEvent): boolean {
	return event.button === 2 || (event.ctrlKey && event.button === 0);
}

/** The data key a drag carries. One place, so producer and consumer agree. */
export const DRAG_TYPE = 'application/x-splatbook-card';

/** Put a pick on a drag event. Drag and click carry exactly the same payload. */
export function writeDrag(event: DragEvent, pick: Pick): void {
	event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(pick));
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

/** Read a pick off a drag event, or nothing if it is carrying something else. */
export function readDrag(event: DragEvent): Pick | null {
	const raw = event.dataTransfer?.getData(DRAG_TYPE);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Pick;
		return typeof parsed?.zone === 'string' ? parsed : null;
	} catch {
		// A drag from somewhere else entirely. Not an error, just not ours.
		return null;
	}
}
