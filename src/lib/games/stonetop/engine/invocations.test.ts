import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import {
	activeInvocation,
	attachInvocations,
	hasInvocationsInsert,
	INVOCATIONS_INSERT_ID,
	knownInvocations,
	toggleActiveInvocation,
	toggleKnownInvocation
} from './invocations';

describe('attachInvocations', () => {
	it('attaches with nothing known and nothing active', () => {
		const c = attachInvocations(createCharacter('the-lightbearer'));
		expect(hasInvocationsInsert(c)).toBe(true);
		expect(knownInvocations(c)).toEqual([]);
		expect(activeInvocation(c)).toBeNull();
	});

	it('is idempotent', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'dancing-light');
		c = attachInvocations(c);
		expect(knownInvocations(c)).toEqual(['dancing-light']);
	});
});

describe('hasInvocationsInsert / knownInvocations', () => {
	it('is false and empty before attaching', () => {
		const c = createCharacter('the-lightbearer');
		expect(hasInvocationsInsert(c)).toBe(false);
		expect(knownInvocations(c)).toEqual([]);
	});
});

describe('toggleKnownInvocation', () => {
	it('learns an invocation', () => {
		const c = toggleKnownInvocation(
			attachInvocations(createCharacter('the-lightbearer')),
			'bath-of-healing-light'
		);
		expect(knownInvocations(c)).toEqual(['bath-of-healing-light']);
	});

	it('forgets a known invocation on a second toggle', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'bath-of-healing-light');
		c = toggleKnownInvocation(c, 'bath-of-healing-light');
		expect(knownInvocations(c)).toEqual([]);
	});

	it('forgetting the active invocation ends it too', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'dancing-light');
		c = toggleActiveInvocation(c, 'dancing-light');
		c = toggleKnownInvocation(c, 'dancing-light');
		expect(activeInvocation(c)).toBeNull();
	});

	it('forgetting an unrelated invocation leaves the active one alone', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'dancing-light');
		c = toggleKnownInvocation(c, 'cold-light-of-day');
		c = toggleActiveInvocation(c, 'dancing-light');
		c = toggleKnownInvocation(c, 'cold-light-of-day');
		expect(activeInvocation(c)).toBe('dancing-light');
	});
});

describe('toggleActiveInvocation', () => {
	it('activates a known invocation', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'dancing-light');
		c = toggleActiveInvocation(c, 'dancing-light');
		expect(activeInvocation(c)).toBe('dancing-light');
	});

	it('is a no-op for an unknown invocation', () => {
		const c = toggleActiveInvocation(
			attachInvocations(createCharacter('the-lightbearer')),
			'dancing-light'
		);
		expect(activeInvocation(c)).toBeNull();
	});

	it('activating a second invocation replaces the first (only one ongoing)', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'dancing-light');
		c = toggleKnownInvocation(c, 'cold-light-of-day');
		c = toggleActiveInvocation(c, 'dancing-light');
		c = toggleActiveInvocation(c, 'cold-light-of-day');
		expect(activeInvocation(c)).toBe('cold-light-of-day');
	});

	it('toggling the already-active invocation ends it', () => {
		let c = attachInvocations(createCharacter('the-lightbearer'));
		c = toggleKnownInvocation(c, 'dancing-light');
		c = toggleActiveInvocation(c, 'dancing-light');
		c = toggleActiveInvocation(c, 'dancing-light');
		expect(activeInvocation(c)).toBeNull();
	});
});

it('stores state under the documented insert id', () => {
	const c = toggleKnownInvocation(
		attachInvocations(createCharacter('the-lightbearer')),
		'dancing-light'
	);
	expect(c.inserts[INVOCATIONS_INSERT_ID]).toBeDefined();
});
