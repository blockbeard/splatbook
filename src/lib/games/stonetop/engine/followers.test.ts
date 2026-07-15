import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import type { FollowersInsert } from '../pack-schemas';
import {
	addFollower,
	createFollower,
	followersOf,
	hasFollowersInsert,
	removeFollower,
	setFollowerLoyalty,
	toggleFollowerFlag,
	updateFollower
} from './followers';

const insert = {
	id: 'insert-followers',
	name: 'Followers (generic insert)',
	type: 'insert',
	appliesTo: 'all',
	followerBlock: {
		count: 2,
		fields: ['name', 'tags', 'hp', 'maxHp', 'armor', 'damage', 'instinct'],
		flags: ['exceptional', 'group'],
		moveLines: 3,
		cost: true,
		loyaltyMax: 3,
		gearLines: [1, 1, 1, 2, 2, 2],
		notes: true
	}
} as unknown as FollowersInsert;

describe('createFollower', () => {
	it('shapes a blank follower off the insert’s move/gear line counts', () => {
		const f = createFollower(insert);
		expect(f.name).toBe('');
		expect(f.moves).toEqual(['', '', '']);
		expect(f.gear).toEqual(['', '', '', '', '', '']);
		expect(f.flags).toEqual([]);
		expect(f.loyalty).toBe(0);
	});
});

describe('hasFollowersInsert / followersOf', () => {
	it('is unattached with an empty roster on a fresh character', () => {
		const c = createCharacter();
		expect(hasFollowersInsert(c)).toBe(false);
		expect(followersOf(c)).toEqual([]);
	});
});

describe('addFollower', () => {
	it('attaches the insert and adds one blank follower', () => {
		const c = addFollower(createCharacter(), insert);
		expect(hasFollowersInsert(c)).toBe(true);
		expect(followersOf(c)).toHaveLength(1);
	});

	it('appends to an existing roster without disturbing it', () => {
		let c = addFollower(createCharacter(), insert);
		c = updateFollower(c, 0, { name: 'Enfys' });
		c = addFollower(c, insert);
		expect(followersOf(c).map((f) => f.name)).toEqual(['Enfys', '']);
	});

	it('does not mutate the input', () => {
		const c = createCharacter();
		addFollower(c, insert);
		expect(hasFollowersInsert(c)).toBe(false);
	});
});

describe('removeFollower', () => {
	it('dismisses a follower by index, keeping the insert attached', () => {
		let c = addFollower(createCharacter(), insert);
		c = addFollower(c, insert);
		c = updateFollower(c, 0, { name: 'Enfys' });
		c = updateFollower(c, 1, { name: 'Olwin' });
		c = removeFollower(c, 0);
		expect(followersOf(c).map((f) => f.name)).toEqual(['Olwin']);
		expect(hasFollowersInsert(c)).toBe(true);
	});

	it('dismissing the last follower leaves an attached, empty roster', () => {
		let c = addFollower(createCharacter(), insert);
		c = removeFollower(c, 0);
		expect(followersOf(c)).toEqual([]);
		expect(hasFollowersInsert(c)).toBe(true);
	});
});

describe('updateFollower', () => {
	it('patches one follower, leaving the rest untouched', () => {
		let c = addFollower(createCharacter(), insert);
		c = addFollower(c, insert);
		c = updateFollower(c, 1, { name: 'Olwin', hp: 6, maxHp: 6 });
		expect(followersOf(c)[0].name).toBe('');
		expect(followersOf(c)[1]).toMatchObject({ name: 'Olwin', hp: 6, maxHp: 6 });
	});

	it('is a no-op for an out-of-range index', () => {
		const c = addFollower(createCharacter(), insert);
		expect(updateFollower(c, 5, { name: 'nope' })).toBe(c);
		expect(updateFollower(c, -1, { name: 'nope' })).toBe(c);
	});
});

describe('toggleFollowerFlag', () => {
	it('sets and clears a flag', () => {
		let c = addFollower(createCharacter(), insert);
		c = toggleFollowerFlag(c, 0, 'exceptional');
		expect(followersOf(c)[0].flags).toEqual(['exceptional']);
		c = toggleFollowerFlag(c, 0, 'exceptional');
		expect(followersOf(c)[0].flags).toEqual([]);
	});

	it('is a no-op for an out-of-range index', () => {
		const c = addFollower(createCharacter(), insert);
		expect(toggleFollowerFlag(c, 9, 'exceptional')).toBe(c);
	});
});

describe('setFollowerLoyalty', () => {
	it('clamps into [0, max]', () => {
		let c = addFollower(createCharacter(), insert);
		c = setFollowerLoyalty(c, 0, 9, 3);
		expect(followersOf(c)[0].loyalty).toBe(3);
		c = setFollowerLoyalty(c, 0, -2, 3);
		expect(followersOf(c)[0].loyalty).toBe(0);
	});
});
