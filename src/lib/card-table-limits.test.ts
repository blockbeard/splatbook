import { describe, expect, it } from 'vitest';
import { POLL_BUSY_MS, POLL_IDLE_MS, POLL_MAX_MS, pollDelayMs } from './card-table-limits';

const state = (over: Partial<Parameters<typeof pollDelayMs>[0]> = {}) =>
	pollDelayMs({ hidden: false, busy: false, quietMs: 0, ...over });

describe('poll cadence', () => {
	it('asks nothing at all while the tab is hidden', () => {
		expect(state({ hidden: true })).toBeNull();
		expect(state({ hidden: true, busy: true })).toBeNull();
	});

	it('asks faster during a Challenge, where a beat of delay shows', () => {
		expect(state({ busy: true })).toBe(POLL_BUSY_MS);
		expect(state({ busy: false })).toBe(POLL_IDLE_MS);
	});

	it('backs off as a table goes quiet, so a forgotten tab costs little', () => {
		expect(state({ busy: true, quietMs: 59_000 })).toBe(POLL_BUSY_MS);
		expect(state({ busy: true, quietMs: 60_000 })).toBe(POLL_BUSY_MS * 2);
		expect(state({ busy: true, quietMs: 120_000 })).toBe(POLL_BUSY_MS * 4);
	});

	it('never waits longer than the ceiling, however long it has been', () => {
		expect(state({ quietMs: 60 * 60 * 1000 })).toBe(POLL_MAX_MS);
		expect(state({ quietMs: Number.MAX_SAFE_INTEGER })).toBe(POLL_MAX_MS);
	});

	it('treats nonsense as now', () => {
		expect(state({ quietMs: -5000 })).toBe(POLL_IDLE_MS);
	});

	it('costs a table roughly what the budget assumed', () => {
		// Six clients, four hours, all busy and none idle: the worst case the
		// plan priced at about 86k reads.
		const readsPerClient = (4 * 60 * 60 * 1000) / POLL_BUSY_MS;
		expect(readsPerClient * 6).toBeLessThan(90_000);
	});
});
