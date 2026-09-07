import { describe, expect, it } from 'vitest';
import { formatSeatClaims, parseSeatClaims, withSeatClaim } from './seat-claims';

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

	it('re-seating overwrites the ticket for that table', () => {
		const claims = { t1: { seatId: 's1', secret: 'old' } };
		expect(withSeatClaim(claims, 't1', { seatId: 's1', secret: 'new' }).t1.secret).toBe('new');
	});
});
