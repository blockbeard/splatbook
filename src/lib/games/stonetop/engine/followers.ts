/**
 * Followers (Stonetop, Book I p.147), the generic follower-tracking insert
 * every character can attach — as opposed to a playbook's own pre-built
 * roster (Crew, Initiates of Danu, Animal Companion), each of which gets its
 * own engine module once its commit lands. `insert-followers.json`'s
 * `followerBlock` prints a blank template (2 slots, up to 3 move lines, 6
 * gear lines, a Loyalty track); the player writes each follower in.
 *
 * Roster entries are edited by array index, not a generated id — same
 * convention as the steading's `ResidentsTable`/`NeighborsTable` (phase 6):
 * nothing outside the roster ever refers to a follower by id, so an index is
 * simpler than minting and threading one through.
 *
 * State lives at `character.inserts['insert-followers']`, per the
 * attachment model (commit 99): presence of the key means the insert is
 * attached. Pure functions over that blob plus the insert; no UI/DB imports.
 */

import type { FollowersInsert } from '../pack-schemas';
import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const FOLLOWERS_INSERT_ID = 'insert-followers';

export interface Follower {
	name: string;
	tags: string;
	hp: number | null;
	maxHp: number | null;
	armor: number | null;
	damage: string;
	instinct: string;
	/** Write-in move lines, count driven by the insert's `moveLines`. */
	moves: string[];
	/** Currently-set flags, a subset of the insert's `flags` (e.g. `exceptional`). */
	flags: string[];
	cost: string;
	loyalty: number;
	/** Write-in gear lines, one per the insert's `gearLines` slot weights. */
	gear: string[];
	notes: string;
}

interface FollowersState {
	followers: Follower[];
}

function readState(character: StonetopCharacter): FollowersState {
	const raw = character.inserts[FOLLOWERS_INSERT_ID] as Partial<FollowersState> | undefined;
	return { followers: Array.isArray(raw?.followers) ? raw.followers : [] };
}

function withState(character: StonetopCharacter, next: FollowersState): StonetopCharacter {
	return {
		...character,
		inserts: {
			...character.inserts,
			[FOLLOWERS_INSERT_ID]: next as unknown as Record<string, unknown>
		}
	};
}

/** Whether Followers is attached at all — distinct from an empty roster: the
 * player can attach it and still be deciding on their first follower. */
export function hasFollowersInsert(character: StonetopCharacter): boolean {
	return FOLLOWERS_INSERT_ID in character.inserts;
}

/** The roster, or `[]` if Followers isn't attached. */
export function followersOf(character: StonetopCharacter): Follower[] {
	return readState(character).followers;
}

/** A blank follower, shaped by the insert's own move/gear line counts. */
export function createFollower(insert: FollowersInsert): Follower {
	return {
		name: '',
		tags: '',
		hp: null,
		maxHp: null,
		armor: null,
		damage: '',
		instinct: '',
		moves: Array(insert.followerBlock.moveLines).fill(''),
		flags: [],
		cost: '',
		loyalty: 0,
		gear: insert.followerBlock.gearLines.map(() => ''),
		notes: ''
	};
}

/** Attach Followers (if it isn't already) and add one blank follower. */
export function addFollower(
	character: StonetopCharacter,
	insert: FollowersInsert
): StonetopCharacter {
	const attached = attachInsert(character, FOLLOWERS_INSERT_ID, { followers: [] });
	const { followers } = readState(attached);
	return withState(attached, { followers: [...followers, createFollower(insert)] });
}

/** Dismiss a follower from the roster. Attachment (and any other followers) stays. */
export function removeFollower(character: StonetopCharacter, index: number): StonetopCharacter {
	const { followers } = readState(character);
	return withState(character, { followers: followers.filter((_, i) => i !== index) });
}

/** Update one follower. A no-op if the index is out of range. */
export function updateFollower(
	character: StonetopCharacter,
	index: number,
	patch: Partial<Follower>
): StonetopCharacter {
	const { followers } = readState(character);
	if (index < 0 || index >= followers.length) return character;
	return withState(character, {
		followers: followers.map((f, i) => (i === index ? { ...f, ...patch } : f))
	});
}

/** Toggle one of the insert's printed flags (e.g. *exceptional*) on a follower. */
export function toggleFollowerFlag(
	character: StonetopCharacter,
	index: number,
	flag: string
): StonetopCharacter {
	const follower = readState(character).followers[index];
	if (!follower) return character;
	const flags = follower.flags.includes(flag)
		? follower.flags.filter((f) => f !== flag)
		: [...follower.flags, flag];
	return updateFollower(character, index, { flags });
}

/** Tap-to-set a follower's Loyalty, clamped to the insert's printed max. */
export function setFollowerLoyalty(
	character: StonetopCharacter,
	index: number,
	loyalty: number,
	max: number
): StonetopCharacter {
	return updateFollower(character, index, { loyalty: Math.min(max, Math.max(0, loyalty)) });
}
