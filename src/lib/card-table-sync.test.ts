import { describe, expect, it, vi } from 'vitest';
import { pollingTransport, type TableSnapshot } from './card-table-sync';
import { POLL_BUSY_MS, POLL_IDLE_MS, POLL_MAX_MS } from './card-table-limits';

/** A hand-driven clock and timer, so the loop can be run without waiting. */
function harness(over: Partial<Parameters<typeof pollingTransport>[0]> = {}) {
	let clock = 0;
	const timers: { at: number; fn: () => void }[] = [];
	const updates: TableSnapshot[] = [];
	let hidden = false;
	let busy = false;
	let responses: (TableSnapshot | null)[] = [];
	const asked: number[] = [];

	const transport = pollingTransport({
		fetchSince: async (v) => {
			asked.push(v);
			return responses.shift() ?? null;
		},
		onUpdate: (s) => updates.push(s),
		isHidden: () => hidden,
		isBusy: () => busy,
		now: () => clock,
		setTimer: (fn, ms) => {
			const t = { at: clock + ms, fn };
			timers.push(t);
			return t;
		},
		clearTimer: (h) => {
			const i = timers.indexOf(h as (typeof timers)[number]);
			if (i >= 0) timers.splice(i, 1);
		},
		...over
	});

	return {
		transport,
		updates,
		asked,
		get pending() {
			return timers.length;
		},
		setHidden: (v: boolean) => (hidden = v),
		setBusy: (v: boolean) => (busy = v),
		reply: (...r: (TableSnapshot | null)[]) => (responses = [...responses, ...r]),
		/**
		 * Run the next scheduled timer, advancing the clock to its due time —
		 * never backwards, so an explicit `advance()` before firing is not undone.
		 */
		async fire() {
			const next = timers.shift();
			if (!next) return false;
			clock = Math.max(clock, next.at);
			next.fn();
			await Promise.resolve();
			await Promise.resolve();
			return true;
		},
		advance: (ms: number) => (clock += ms),
		delayOf: () => (timers[0] ? timers[0].at - clock : null)
	};
}

const snapshot = (version: number): TableSnapshot => ({
	version,
	state: { v: version },
	events: []
});

describe('the polling transport', () => {
	it('does nothing until it is started, and stops when told', () => {
		const h = harness();
		expect(h.pending).toBe(0);
		h.transport.start();
		expect(h.pending).toBe(1);
		h.transport.stop();
		expect(h.pending).toBe(0);
	});

	it('is safe to start twice', () => {
		const h = harness();
		h.transport.start();
		h.transport.start();
		expect(h.pending).toBe(1);
	});

	it('asks from its cursor and advances it on a change', async () => {
		const h = harness();
		h.reply(snapshot(4), snapshot(7));
		h.transport.start();
		await h.fire();
		expect(h.transport.version).toBe(4);
		await h.fire();
		expect(h.transport.version).toBe(7);
		expect(h.asked).toEqual([0, 4]);
		expect(h.updates.map((u) => u.version)).toEqual([4, 7]);
	});

	it('says nothing happened when nothing did', async () => {
		const h = harness();
		h.reply(null, null);
		h.transport.start();
		await h.fire();
		await h.fire();
		expect(h.updates).toEqual([]);
		expect(h.transport.version).toBe(0);
	});

	it('asks the server nothing while the tab is hidden', async () => {
		const h = harness();
		h.transport.start();
		h.setHidden(true);
		await h.fire();
		await h.fire();
		expect(h.asked).toEqual([]);
		// But it keeps a wake-up scheduled, so coming back is immediate.
		expect(h.pending).toBe(1);

		h.setHidden(false);
		h.reply(snapshot(1));
		await h.fire();
		expect(h.asked).toEqual([0]);
	});

	it('asks faster during a Challenge', async () => {
		const h = harness();
		h.transport.start();
		expect(h.delayOf()).toBe(POLL_IDLE_MS);
		h.transport.stop();

		h.setBusy(true);
		h.transport.start();
		expect(h.delayOf()).toBe(POLL_BUSY_MS);
	});

	it('measures quiet from the last change, not the last poll', async () => {
		const h = harness();
		h.setBusy(true);
		h.transport.start();

		// Two minutes of polling with nothing happening: the wait grows.
		h.reply(null, null);
		await h.fire();
		h.advance(120_000);
		await h.fire();
		expect(h.delayOf()).toBe(POLL_BUSY_MS * 4);

		// Something happens, and it is responsive again immediately.
		h.reply(snapshot(1));
		await h.fire();
		expect(h.delayOf()).toBe(POLL_BUSY_MS);
	});

	it('never waits longer than the ceiling', async () => {
		const h = harness();
		h.transport.start();
		h.reply(null);
		h.advance(60 * 60 * 1000);
		await h.fire();
		expect(h.delayOf()).toBe(POLL_MAX_MS);
	});

	it('never has two requests in flight', async () => {
		let release: (v: TableSnapshot | null) => void = () => {};
		const h = harness({
			fetchSince: () =>
				new Promise<TableSnapshot | null>((resolve) => {
					release = resolve;
				})
		});
		h.transport.start();
		await h.fire();
		// The first request is still open; firing again must not start a second.
		expect(h.pending).toBe(0);
		release(snapshot(1));
		await Promise.resolve();
		await Promise.resolve();
		expect(h.pending).toBe(1);
	});

	it('treats a dropped poll as harmless and keeps going', async () => {
		const onError = vi.fn();
		let calls = 0;
		const h = harness({
			fetchSince: async () => {
				calls++;
				if (calls === 1) throw new Error('network');
				return snapshot(3);
			},
			onError
		});
		h.transport.start();
		await h.fire();
		expect(onError).toHaveBeenCalledOnce();
		expect(h.pending).toBe(1);

		await h.fire();
		expect(h.transport.version).toBe(3);
	});

	it('starts from a version it was given, for a client that already has state', () => {
		const h = harness({ version: 12 });
		expect(h.transport.version).toBe(12);
	});
});
