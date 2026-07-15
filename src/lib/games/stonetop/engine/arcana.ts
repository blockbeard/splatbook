/**
 * Arcana (Stonetop, Book II Appendix C/D) — free-form cards (commit 105).
 * Matches the paper ritual where the GM hands you a card: a write-in name and
 * notes, a configurable row of mark boxes, and *mysteries* (sections) that
 * unlock as marks accumulate — "when you mark the Nth box, unlock this."
 * Structured Minor/Major Arcana data (Hearthfire's transcription) is a
 * planned fast-follow; this commit ships the free-form shape any GM can use
 * today without waiting on that import.
 *
 * Unlike every other insert, a card's sections are edited by two different
 * parties: the player marks boxes as they play, and the GM authors/reveals
 * section text through the campaign's GM-write path (same
 * `updateCampaignEntityData` end-of-session already uses). Both go through
 * these same pure functions — only the caller differs, not the shape.
 *
 * Cards and sections are edited by index, same convention as Followers/Crew
 * (commits 102-103): nothing outside a card ever refers to a section by id.
 *
 * State lives at `character.inserts['insert-arcana']`.
 */

import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const ARCANA_INSERT_ID = 'insert-arcana';

export interface ArcanaSection {
	name: string;
	/** GM-authored mystery text — blank until the GM writes it. */
	text: string;
	/** The mark count at which this section unlocks. */
	unlockAt: number;
}

export interface ArcanaCard {
	name: string;
	notes: string;
	markBoxes: number;
	marked: number;
	sections: ArcanaSection[];
}

interface ArcanaState {
	cards: ArcanaCard[];
}

function readState(character: StonetopCharacter): ArcanaState {
	const raw = character.inserts[ARCANA_INSERT_ID] as Partial<ArcanaState> | undefined;
	return { cards: Array.isArray(raw?.cards) ? raw.cards : [] };
}

function withState(character: StonetopCharacter, next: ArcanaState): StonetopCharacter {
	return {
		...character,
		inserts: {
			...character.inserts,
			[ARCANA_INSERT_ID]: next as unknown as Record<string, unknown>
		}
	};
}

export function hasArcanaInsert(character: StonetopCharacter): boolean {
	return ARCANA_INSERT_ID in character.inserts;
}

export function arcanaCardsOf(character: StonetopCharacter): ArcanaCard[] {
	return readState(character).cards;
}

/** Whether a section is currently visible to its owner — enough marks made. */
export function isArcanaSectionUnlocked(card: ArcanaCard, section: ArcanaSection): boolean {
	return card.marked >= section.unlockAt;
}

/** Attach Arcana (if it isn't already), with no cards yet. */
export function attachArcana(character: StonetopCharacter): StonetopCharacter {
	return attachInsert(character, ARCANA_INSERT_ID, { cards: [] });
}

/** Attach Arcana (if needed) and add one card — "the GM hands you a card." */
export function addArcanaCard(
	character: StonetopCharacter,
	init: { name?: string; markBoxes?: number } = {}
): StonetopCharacter {
	const attached = attachArcana(character);
	const { cards } = readState(attached);
	const card: ArcanaCard = {
		name: init.name ?? '',
		notes: '',
		markBoxes: init.markBoxes ?? 3,
		marked: 0,
		sections: []
	};
	return withState(attached, { cards: [...cards, card] });
}

export function removeArcanaCard(character: StonetopCharacter, index: number): StonetopCharacter {
	const { cards } = readState(character);
	return withState(character, { cards: cards.filter((_, i) => i !== index) });
}

/** Patch a card's simple fields — name, notes, mark-box count. */
export function updateArcanaCard(
	character: StonetopCharacter,
	index: number,
	patch: Partial<Pick<ArcanaCard, 'name' | 'notes' | 'markBoxes'>>
): StonetopCharacter {
	const { cards } = readState(character);
	if (index < 0 || index >= cards.length) return character;
	return withState(character, {
		cards: cards.map((c, i) => (i === index ? { ...c, ...patch } : c))
	});
}

/** Tap-to-set a card's marked count, clamped to its own `markBoxes`. */
export function setArcanaMarked(
	character: StonetopCharacter,
	index: number,
	marked: number
): StonetopCharacter {
	const { cards } = readState(character);
	const card = cards[index];
	if (!card) return character;
	const clamped = Math.min(card.markBoxes, Math.max(0, marked));
	return withState(character, {
		cards: cards.map((c, i) => (i === index ? { ...c, marked: clamped } : c))
	});
}

/** Add a blank mystery section to a card — the GM's next thing to author. */
export function addArcanaSection(
	character: StonetopCharacter,
	cardIndex: number
): StonetopCharacter {
	const { cards } = readState(character);
	const card = cards[cardIndex];
	if (!card) return character;
	const section: ArcanaSection = { name: '', text: '', unlockAt: 1 };
	return withState(character, {
		cards: cards.map((c, i) => (i === cardIndex ? { ...c, sections: [...c.sections, section] } : c))
	});
}

export function removeArcanaSection(
	character: StonetopCharacter,
	cardIndex: number,
	sectionIndex: number
): StonetopCharacter {
	const { cards } = readState(character);
	const card = cards[cardIndex];
	if (!card) return character;
	return withState(character, {
		cards: cards.map((c, i) =>
			i === cardIndex ? { ...c, sections: c.sections.filter((_, j) => j !== sectionIndex) } : c
		)
	});
}

/** Patch a section — its name, GM-authored text, or unlock threshold. */
export function updateArcanaSection(
	character: StonetopCharacter,
	cardIndex: number,
	sectionIndex: number,
	patch: Partial<ArcanaSection>
): StonetopCharacter {
	const { cards } = readState(character);
	const card = cards[cardIndex];
	if (!card || sectionIndex < 0 || sectionIndex >= card.sections.length) return character;
	return withState(character, {
		cards: cards.map((c, i) =>
			i === cardIndex
				? {
						...c,
						sections: c.sections.map((s, j) => (j === sectionIndex ? { ...s, ...patch } : s))
					}
				: c
		)
	});
}
