import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPackFile } from '../../../packs/fs-loader';
import { buildFaces, type FaceIndex } from './faces';
import { actionsForCard, cardsForAction, type ActionCatalogue } from './actions';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

let faces: FaceIndex;
let catalogue: ActionCatalogue;

beforeAll(async () => {
	faces = buildFaces((await loadPackFile(packRoot, 'data/deck.json')) as never);
	catalogue = (
		(await loadPackFile(packRoot, 'data/challenge.json')) as { actions: ActionCatalogue }
	).actions;
});

const names = (list: { name: string }[]) => list.map((a) => a.name).sort();

describe('a player reads from the suit', () => {
	it('offers a suit’s own actions and the miscellaneous ones', () => {
		// Ch.7: "A Cups card must be spent to make a Cups action."
		const { fits } = actionsForCard(catalogue, faces['cups-v']);
		expect(names(fits)).toContain('Aid Another');
		expect(names(fits)).toContain('Use Item');
		// The any-suit actions come with every card.
		expect(names(fits)).toContain('Move');
		expect(names(fits)).toContain('Test Fate');
		// But not another suit's.
		expect(names(fits)).not.toContain('Attack');
		expect(names(fits)).not.toContain('Dodge');
	});

	it('offers Swords actions to a Swords card', () => {
		const { fits } = actionsForCard(catalogue, faces['swords-king']);
		expect(names(fits)).toContain('Attack');
		expect(names(fits)).toContain('Riposte');
		expect(names(fits)).not.toContain('Banter');
	});

	it('never removes anything — the rest stays selectable', () => {
		// A menu that only lists legal choices refuses a play exactly as a rule
		// would, and the GM rules on things the book never anticipated.
		const { fits, rest } = actionsForCard(catalogue, faces['cups-v']);
		expect(rest.length).toBeGreaterThan(0);
		expect(names(rest)).toContain('Attack');
		expect(fits.length + rest.length).toBeGreaterThan(20);
	});

	it('gives a major nothing but the miscellaneous ones, having no suit', () => {
		const { fits } = actionsForCard(catalogue, faces['star']);
		expect(names(fits)).toContain('Guard');
		expect(names(fits)).not.toContain('Attack');
	});
});

describe('the GM reads from the doom tier', () => {
	const asGm = { asGm: true };

	it('lets a lesser doom pay for any Challenge Action', () => {
		// "Play any lesser doom card to make any Challenge Action."
		const { fits } = actionsForCard(catalogue, faces['justice'], asGm); // XI
		expect(faces['justice'].greaterDoom).toBe(false);
		expect(names(fits)).toContain('Attack');
		expect(names(fits)).toContain('Dodge');
		expect(names(fits)).toContain('Banter');
	});

	it('holds a greater doom to its own powers, the odd jobs, and favour', () => {
		// "You cannot typically play a greater doom card to make Challenge Actions
		// like Attack, Dash, Dodge… You *can* play greater doom cards to use any
		// miscellaneous action except for Vigilance."
		const { fits } = actionsForCard(catalogue, faces['moon'], asGm); // XVIII
		expect(faces['moon'].greaterDoom).toBe(true);
		expect(names(fits)).toContain('Greater doom ability');
		expect(names(fits)).toContain('Discard for favour');
		expect(names(fits)).toContain('Move');
		expect(names(fits)).not.toContain('Attack');
		// The one miscellaneous action a greater doom may not pay for.
		expect(names(fits)).not.toContain('Vigilance');
	});

	it('keeps the greater-doom powers away from a lesser doom', () => {
		const { fits } = actionsForCard(catalogue, faces['emperor'], asGm); // IV
		expect(names(fits)).not.toContain('Greater doom ability');
		expect(names(fits)).not.toContain('Discard for favour');
	});

	it('offers a player nothing that is the GM’s alone', () => {
		const { fits, rest } = actionsForCard(catalogue, faces['swords-v']);
		const all = [...fits, ...rest];
		expect(names(all)).not.toContain('Greater doom ability');
	});
});

describe('the other direction', () => {
	it('lights up the cards that pay for an action', () => {
		const attack = catalogue.bySuit.swords.find((a) => a.id === 'attack')!;
		const hand = ['swords-v', 'cups-x', 'wands-page', 'swords-king'].map((id) => faces[id]);
		expect(cardsForAction(catalogue, attack, hand)).toEqual(['swords-v', 'swords-king']);
	});

	it('lights up every card for an any-suit action', () => {
		const move = catalogue.anySuit.find((a) => a.id === 'move')!;
		const hand = ['swords-v', 'cups-x', 'wands-page'].map((id) => faces[id]);
		expect(cardsForAction(catalogue, move, hand)).toHaveLength(3);
	});

	it('lights up only the greater dooms for a greater doom ability', () => {
		const ability = catalogue.gmOnly.find((a) => a.id === 'greater-doom')!;
		const hand = ['emperor', 'moon', 'sun', 'death'].map((id) => faces[id]);
		expect(cardsForAction(catalogue, ability, hand, { asGm: true })).toEqual(['moon', 'sun']);
	});

	it('agrees with itself in both directions', () => {
		// Whatever a card is offered for, that card is offered back for it.
		const hand = ['cups-v', 'swords-king', 'moon'].map((id) => faces[id]);
		for (const face of hand) {
			for (const action of actionsForCard(catalogue, face, { asGm: true }).fits) {
				expect(cardsForAction(catalogue, action, [face], { asGm: true })).toEqual([face.id]);
			}
		}
	});
});
