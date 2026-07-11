/**
 * End of session — the move the table makes when you stop playing.
 *
 * Two prompts each player answers about their own character ("point out how you
 * demonstrated or struggled with your instinct… if you can, mark XP"), and four
 * questions the table answers together, where every "yes" is an XP for
 * *everyone*. The prompts and questions themselves are game text and live in the
 * pack (`data/end-of-session.json`); what lives here is the arithmetic and the
 * write-through, pure and testable.
 *
 * The season is the steading's half of the ritual: at the change of seasons the
 * steading rolls +Fortunes. That roll is the steading's own move (see
 * `steading-moves.json`); all this module contributes is whether the flow should
 * offer it.
 */

import type { StonetopCharacter } from './character';
import { markXp } from './play';
import { advanceSeason, type StonetopSteading } from './steading';

/** What the table answered. */
export interface EndOfSessionAnswers {
	/** Ids of the group questions answered "yes" — each is an XP for everyone. */
	group: string[];
	/** Per character id, the ids of the personal prompts they marked XP for. */
	personal: Record<string, string[]>;
}

export function emptyAnswers(): EndOfSessionAnswers {
	return { group: [], personal: {} };
}

/**
 * The XP one character takes away: one for every "yes" the table gave, plus one
 * for each personal prompt they marked.
 */
export function xpFor(characterId: string, answers: EndOfSessionAnswers): number {
	return answers.group.length + (answers.personal[characterId]?.length ?? 0);
}

/** Mark the session's XP on a character. XP banks past the threshold (see markXp). */
export function applyEndOfSession(
	character: StonetopCharacter,
	characterId: string,
	answers: EndOfSessionAnswers
): StonetopCharacter {
	const xp = xpFor(characterId, answers);
	return xp > 0 ? markXp(character, xp) : character;
}

/** Turn the steading's season — the change of seasons the group rolls Fortunes for. */
export function turnSeason(steading: StonetopSteading): StonetopSteading {
	return advanceSeason(steading);
}
