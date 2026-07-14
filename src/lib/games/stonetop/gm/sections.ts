/**
 * The GM guide's navigation — ordered sections (stable id + display title). This
 * is the serialisable nav the shell renders in the sidebar and routes on
 * (`/[game=game]/gm/[section]`); `GmGuide.svelte` dispatches on the same ids. Titles
 * group the GM playbook's ~20 top-level keys into nine readable pages.
 */
export const GM_SECTIONS = [
	{ id: 'overview', title: 'Agenda & core loop' },
	{ id: 'moves', title: 'GM moves & harm' },
	{ id: 'threats', title: 'Threats' },
	{ id: 'expeditions', title: 'Expeditions & travel' },
	{ id: 'sites', title: 'Sites & discoveries' },
	{ id: 'monsters', title: 'Monsters & followers' },
	{ id: 'npcs', title: 'NPCs' },
	{ id: 'homefront', title: 'Home, downtime & aftermath' },
	{ id: 'flow', title: 'Flow of play' }
] as const;

export type GmSectionId = (typeof GM_SECTIONS)[number]['id'];

/** Whether `id` names a real guide section. */
export function isGmSection(id: string): id is GmSectionId {
	return GM_SECTIONS.some((s) => s.id === id);
}

/** The id of the first section — where `/[game=game]/gm` lands. */
export const FIRST_GM_SECTION: GmSectionId = GM_SECTIONS[0].id;
