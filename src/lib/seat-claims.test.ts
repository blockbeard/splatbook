import { describe, expect, it } from 'vitest';
import { MAX_SEAT_CLAIMS, formatSeatClaims, parseSeatClaims, withSeatClaim } from './seat-claims';

describe('seat claim cookies', () => {
	it('round-trips several tables in one cookie', () => {
		const claims = {
			t1: { seatId: 's1', secret: 'aaa' },
			t2: { seatId: 's2', secret: 'bbb' }
		};
		expect(parseSeatClaims(formatSeatClaims(claims))).toEqual(claims);
	});

	it('is empty when there is no cookie', () => {
		expect(parseSeatClaims(undefined)).toEqual({});
		expect(parseSeatClaims('')).toEqual({});
	});

	it('drops a mangled entry rather than throwing', () => {
		// A broken cookie should cost somebody their seat, not the whole page.
		const parsed = parseSeatClaims('good.seat.secret broken t3..secret');
		expect(parsed).toEqual({ good: { seatId: 'seat', secret: 'secret' } });
	});

	it('replaces one table’s claim without disturbing the others', () => {
		const claims = { t1: { seatId: 's1', secret: 'aaa' } };
		const next = withSeatClaim(claims, 't2', { seatId: 's2', secret: 'bbb' });
		expect(next.t1).toEqual({ seatId: 's1', secret: 'aaa' });
		expect(next.t2).toEqual({ seatId: 's2', secret: 'bbb' });
		// And the original is untouched.
		expect(Object.keys(claims)).toEqual(['t1']);
	});

	it('keeps the cookie under a browser’s size limit', () => {
		// An unbounded list would eventually stop being sent at all, losing every
		// seat at once rather than the stalest one.
		let claims = {};
		for (let i = 0; i < MAX_SEAT_CLAIMS + 5; i++) {
			claims = withSeatClaim(claims, `table-${i}`, { seatId: `s${i}`, secret: 'x'.repeat(72) });
		}
		const parsed = parseSeatClaims(formatSeatClaims(claims));
		expect(Object.keys(parsed)).toHaveLength(MAX_SEAT_CLAIMS);
		// The ones kept are the most recent.
		expect(parsed['table-24']).toBeDefined();
		expect(parsed['table-0']).toBeUndefined();
		expect(formatSeatClaims(claims).length).toBeLessThan(4096);
	});

	it('moves a re-seated table to the newest end, not its old place', () => {
		let claims = withSeatClaim({}, 'old', { seatId: 's1', secret: 'a' });
		claims = withSeatClaim(claims, 'new', { seatId: 's2', secret: 'b' });
		claims = withSeatClaim(claims, 'old', { seatId: 's1', secret: 'refreshed' });
		expect(Object.keys(claims)).toEqual(['new', 'old']);
	});

	it('re-seating overwrites the ticket for that table', () => {
		const claims = { t1: { seatId: 's1', secret: 'old' } };
		expect(withSeatClaim(claims, 't1', { seatId: 's1', secret: 'new' }).t1.secret).toBe('new');
	});
});
