/**
 * The Origins 5.5e rules engine — pure TypeScript, opaque to the shell.
 *
 * Nothing here imports UI, DB or SvelteKit code, and nothing here holds a rules
 * *number*: the hack's constants (proficiency bonus, starting gold, the
 * point-buy table) all arrive as pack data, so the engine states the rules and
 * the pack states the values.
 */

export * from './character';
export * from './abilities';
export * from './derived';
export * from './proficiencies';
export * from './spellcasting';
export * from './validation';

import { createCharacter, migrateCharacter } from './character';

export const engine = { createCharacter, migrateCharacter };
