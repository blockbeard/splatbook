import { describe, expect, it } from 'vitest';
import { commandSchema } from '../card-table';
import { howsFor, talentCommand, type How, type Moment } from './talent';

const play = {
	holder: 's1',
	from: { zone: 'seat:s1:hand', card: 'swords-ii' },
	label: 'Heavy Metal Machine',
	target: 'zombies:A',
	give: { to: 's2', action: 'Recover', interrupt: true }
};

describe('a talent, or something else', () => {
	it('offers only what the moment allows, the usual one first', () => {
		expect(howsFor('turn')).toEqual(['now', 'ready', 'out', 'discard', 'give']);
		expect(howsFor('minor')).toEqual(['minor', 'ready', 'out', 'discard', 'give']);
		expect(howsFor('other')).toEqual(['out', 'discard', 'give']);
		// Nobody to hand it to (the GM, or a lone adventurer): no Counsel.
		expect(howsFor('other', false)).toEqual(['out', 'discard']);
	});

	it('sends an existing command for every how, which the server accepts', () => {
		for (const moment of ['turn', 'minor', 'other'] as Moment[]) {
			for (const how of howsFor(moment)) {
				const command = talentCommand(how as How, moment, play);
				expect(commandSchema().safeParse(command).success, `${moment} ${how}`).toBe(true);
			}
		}
	});

	it('readies above the initiative on a turn and below it as a minor', () => {
		expect(talentCommand('ready', 'turn', play)).toMatchObject({
			type: 'play-turn',
			mode: 'ready'
		});
		expect(talentCommand('ready', 'minor', play)).toMatchObject({ type: 'ready-minor' });
	});

	it('hands a card over with the advice, or the talent’s name without it', () => {
		expect(talentCommand('give', 'turn', play)).toEqual({
			type: 'give-card',
			holder: 's1',
			from: play.from,
			to: 's2',
			action: 'Recover',
			interrupt: true
		});
		const bare = { ...play, label: 'Counsel', give: { to: 's2', action: ' ', interrupt: false } };
		expect(talentCommand('give', 'turn', bare)).toMatchObject({ action: 'Counsel' });
	});

	it('discards with the talent’s name and no target', () => {
		expect(talentCommand('discard', 'other', play)).toEqual({
			type: 'discard-for',
			holder: 's1',
			from: play.from,
			label: 'Heavy Metal Machine'
		});
	});
});
