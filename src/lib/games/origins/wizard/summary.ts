/**
 * The choices-so-far rail: the draft as already-human label/value rows.
 *
 * Async because resolving ids to names means reading the pack; the shell awaits
 * and re-renders as the draft changes. Every row names the step that owns it,
 * so the rail doubles as navigation.
 */

import type { WizardSummary } from '$lib/wizard';
import { ABILITIES, finalScores, formatModifier, maxHitPoints, modifier } from '../engine';
import type { OriginsCharacter } from '../engine';
import { loadPack } from '../pack/load';

export const originsSummary: WizardSummary = async (draft) => {
	const c = draft as OriginsCharacter;
	const pack = await loadPack(fetch);

	const background = pack.backgrounds.find((b) => b.id === c.backgroundId);
	const referenceClass = pack.referenceClasses.find((r) => r.id === c.referenceClassId);
	const species = pack.species.find((s) => s.id === c.speciesId);
	const scores = finalScores(c);
	const hp = maxHitPoints(c);

	const spellNames = [...c.spells.cantrips, ...c.spells.level1]
		.map((id) => pack.spells.find((s) => s.id === id)?.name)
		.filter(Boolean)
		.join(', ');

	return [
		{
			title: 'Origin',
			items: [
				{ label: 'Background', value: background?.name, stepId: 'background' },
				{ label: 'Reference class', value: referenceClass?.name, stepId: 'background' },
				{ label: 'Species', value: species?.name, stepId: 'species' }
			]
		},
		{
			title: 'Ability scores',
			items: ABILITIES.map((ability) => ({
				label: ability,
				value:
					scores[ability] === null
						? undefined
						: `${scores[ability]} (${formatModifier(modifier(scores[ability]!))})`,
				stepId: 'abilities'
			}))
		},
		{
			title: 'The rest',
			items: [
				{ label: 'Hit points', value: hp === null ? undefined : String(hp), stepId: 'abilities' },
				{
					label: 'Equipment',
					value: c.equipment.optionId ? `Option ${c.equipment.optionId.toUpperCase()}` : undefined,
					stepId: 'equipment'
				},
				{ label: 'Spells', value: spellNames || undefined, stepId: 'spells' },
				{ label: 'Languages', value: c.languages.join(', ') || undefined, stepId: 'details' },
				{ label: 'Name', value: c.name || undefined, stepId: 'details' }
			]
		}
	];
};
