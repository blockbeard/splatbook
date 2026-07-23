/**
 * Shell dice infrastructure — the generic core the app and game modules share.
 * Layer: shell (`architecture.md`). Pure and game-agnostic; per-game rolls come
 * in as {@link DiceModule} presets through the `GameModule.dice` slot.
 */

export {
	parseNotation,
	isValidNotation,
	formatSpec,
	type DiceTerm,
	type DiceSpec
} from './notation';
export {
	roll,
	rollDie,
	combineModes,
	formatSigned,
	type Rng,
	type RollMode,
	type DieRoll,
	type RollResult
} from './roll';
export { type DicePreset, type DiceModule, type ResolvedRoll } from './presets';
export { rollResultSchema } from './result-schema';
