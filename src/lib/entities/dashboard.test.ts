import { describe, it, expect } from 'vitest';
import { groupByGame, statusLabel, type DashboardItem } from './dashboard.ts';

function item(over: Partial<DashboardItem>): DashboardItem {
	return {
		id: 'x',
		name: 'n',
		gameId: 'stonetop',
		gameName: 'Stonetop',
		entityType: 'character',
		typeLabel: 'Character',
		status: 'draft',
		updatedAt: '2026-07-10T00:00:00.000Z',
		...over
	};
}

describe('groupByGame', () => {
	it('groups by game, preserving newest-first order across and within groups', () => {
		const groups = groupByGame([
			item({ id: '1', gameId: 'stonetop', gameName: 'Stonetop' }),
			item({ id: '2', gameId: 'hmtw', gameName: 'HMtW' }),
			item({ id: '3', gameId: 'stonetop', gameName: 'Stonetop' })
		]);
		expect(groups.map((g) => g.gameId)).toEqual(['stonetop', 'hmtw']);
		expect(groups[0].items.map((i) => i.id)).toEqual(['1', '3']);
		expect(groups[1].items.map((i) => i.id)).toEqual(['2']);
	});

	it('returns an empty array for no items', () => {
		expect(groupByGame([])).toEqual([]);
	});
});

describe('statusLabel', () => {
	it('labels known statuses and passes through unknown', () => {
		expect(statusLabel('draft')).toBe('Draft');
		expect(statusLabel('ready')).toBe('Ready');
		expect(statusLabel('archived')).toBe('Archived');
		expect(statusLabel('weird')).toBe('weird');
	});
});
