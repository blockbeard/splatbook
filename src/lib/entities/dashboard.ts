/**
 * Dashboard view helpers — pure shaping of a user's saved entities for display.
 * Kept out of the Svelte component so the grouping/formatting is unit-testable.
 */

/** One saved entity, flattened for the dashboard (no opaque `data`). */
export interface DashboardItem {
	id: string;
	name: string;
	gameId: string;
	gameName: string;
	entityType: string;
	/** Human label for the entity type ("Character", "Steading"). */
	typeLabel: string;
	status: string;
	/** ISO string — serialisable across the load boundary. */
	updatedAt: string;
}

/** A game's saved entities, grouped for a sectioned list. */
export interface DashboardGroup {
	gameId: string;
	gameName: string;
	items: DashboardItem[];
}

/**
 * Group items by game, preserving the incoming order (which is newest-touched
 * first) both across groups and within each. A game appears in the position of
 * its most recently touched entity.
 */
export function groupByGame(items: DashboardItem[]): DashboardGroup[] {
	const groups: DashboardGroup[] = [];
	const byId = new Map<string, DashboardGroup>();
	for (const item of items) {
		let group = byId.get(item.gameId);
		if (!group) {
			group = { gameId: item.gameId, gameName: item.gameName, items: [] };
			byId.set(item.gameId, group);
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
}

/** Human label for a lifecycle status. */
export function statusLabel(status: string): string {
	switch (status) {
		case 'draft':
			return 'Draft';
		case 'ready':
			return 'Ready';
		case 'archived':
			return 'Archived';
		default:
			return status;
	}
}
