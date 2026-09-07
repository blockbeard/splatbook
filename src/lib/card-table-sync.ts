/**
 * The client half of keeping a card table in step: a polling loop behind a seam.
 *
 * Polling rather than push, and the reasoning is recorded in the phase plan: the
 * point of this feature is that other people can run it, and a Durable Object is
 * the one primitive a self-hoster cannot. WebSockets would also have cost a
 * custom server entrypoint, reverse-proxy configuration for every self-hoster,
 * and a silent failure the moment anyone ran two containers. The operations
 * whose latency is most visible — a deal, a reveal — cannot be applied
 * optimistically by a client that does not hold the cards, so they round-trip on
 * any transport anyway.
 *
 * `TableTransport` is the seam that keeps that decision cheap to revisit. If a
 * real table ever finds the delay annoying, a push implementation goes behind
 * this interface and nothing above it changes.
 *
 * No framework and no globals: the timer, the clock and the page's visibility
 * all arrive as functions, so the whole loop is testable without a browser.
 */

import { pollDelayMs } from './card-table-limits';

/** What a poll brings back. `null` means nothing has changed since the cursor. */
export interface TableSnapshot {
	version: number;
	/** The table as this seat may see it — the game's projection, opaque here. */
	state: unknown;
	/** Public facts since the client's cursor, oldest first. */
	events: { version: number; kind: string; data: unknown }[];
}

export interface TableTransport {
	/** Begin asking. Safe to call twice. */
	start(): void;
	/** Stop asking and forget any pending wait. */
	stop(): void;
	/** The version this client has seen. */
	readonly version: number;
}

export interface SyncOptions {
	/** Ask the server for anything after `version`. */
	fetchSince: (version: number) => Promise<TableSnapshot | null>;
	/** Called whenever something arrives. */
	onUpdate: (snapshot: TableSnapshot) => void;
	/** Called when a poll throws. A dropped poll is not an error worth stopping for. */
	onError?: (error: unknown) => void;
	/** Whether the tab is out of sight. Hidden tabs ask nothing at all. */
	isHidden: () => boolean;
	/** Whether a Challenge is running, where a beat of delay shows. */
	isBusy: () => boolean;
	/** Where to start from. */
	version?: number;
	now?: () => number;
	setTimer?: (fn: () => void, ms: number) => unknown;
	clearTimer?: (handle: unknown) => void;
}

/**
 * A polling transport.
 *
 * Three behaviours worth naming. It never has two requests in flight, so a slow
 * response cannot stack up behind the interval. It measures quiet from the last
 * *change*, not the last poll, so a busy table stays responsive while a
 * forgotten tab backs off to the ceiling. And a hidden tab schedules a wake-up
 * without asking anything, so returning to it is immediate but sitting on it
 * costs nothing.
 */
export function pollingTransport(opts: SyncOptions): TableTransport {
	const now = opts.now ?? (() => Date.now());
	const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
	const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

	let version = opts.version ?? 0;
	let running = false;
	let inFlight = false;
	let handle: unknown = null;
	let lastChangeAt = now();

	function schedule(): void {
		if (!running) return;
		const hidden = opts.isHidden();
		const delay =
			pollDelayMs({
				hidden,
				busy: opts.isBusy(),
				quietMs: now() - lastChangeAt
			}) ??
			// Hidden: wake up on the slow cadence to notice becoming visible again,
			// without asking the server anything in the meantime.
			3000;
		handle = setTimer(tick, delay);
	}

	async function tick(): Promise<void> {
		handle = null;
		if (!running) return;
		if (inFlight || opts.isHidden()) {
			schedule();
			return;
		}

		inFlight = true;
		try {
			const snapshot = await opts.fetchSince(version);
			if (snapshot && snapshot.version !== version) {
				version = snapshot.version;
				lastChangeAt = now();
				opts.onUpdate(snapshot);
			}
		} catch (error) {
			// A dropped poll is harmless; the next one tries again.
			opts.onError?.(error);
		} finally {
			inFlight = false;
		}
		schedule();
	}

	return {
		start() {
			if (running) return;
			running = true;
			lastChangeAt = now();
			schedule();
		},
		stop() {
			running = false;
			if (handle !== null) clearTimer(handle);
			handle = null;
		},
		get version() {
			return version;
		}
	};
}
