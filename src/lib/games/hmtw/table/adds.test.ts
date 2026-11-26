import { describe, expect, it } from 'vitest';
import { addsWords, readiedAdds } from './adds';

describe('what a total is made of', () => {
	it('names each kind, and nothing for a play from before v17', () => {
		expect(addsWords(true)).toBe('+ attribute');
		expect(addsWords(false)).toBe('face value');
		expect(addsWords(undefined)).toBeNull();
	});

	it('goes by where a readied card was put down', () => {
		expect(readiedAdds('turn')).toBe(true);
		expect(readiedAdds('minor')).toBe(false);
	});
});
