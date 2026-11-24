import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 31: the scene and its creatures, played across two browsers.
 *
 * A GM and a guest player, as in card-table.spec.ts. The GM names the zones
 * and brings on lettered zombies with HD; the *player* places themselves and
 * marks the damage, because "anyone can move anyone" is the claim most likely
 * to break quietly — the controls could render for the GM alone and every
 * single-browser test would still pass.
 *
 * Every cross-browser assertion waits on the poll. The database is not reset
 * between local runs, so locators are scoped to this run's names.
 */

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const POLLED = { timeout: 15_000 };
const SHOTS = process.env.SCENE_SCREENSHOTS;

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** WCAG 2.1 AA in both rooms, the same bar card-table-a11y.spec.ts holds. */
async function violations(page: Page): Promise<string[]> {
	const found: string[] = [];
	for (const theme of ['light', 'dark'] as const) {
		await page.evaluate(
			(t) => document.documentElement.classList.toggle('dark', t === 'dark'),
			theme
		);
		await page.addScriptTag({ content: AXE });
		const result = (await page.evaluate(async () =>
			// @ts-expect-error injected above
			window.axe.run(document, {
				runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
			})
		)) as { violations: { id: string; nodes: { target: string[] }[] }[] };
		for (const v of result.violations) {
			for (const n of v.nodes) found.push(`[${theme}] ${v.id} — ${n.target.join(' ')}`);
		}
	}
	await page.evaluate(() => document.documentElement.classList.remove('dark'));
	return found;
}

async function shot(page: Page, name: string) {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test('the scene, lettered creatures and their HD, shared between two browsers', async ({
	browser
}) => {
	const run = Date.now().toString(36);
	const hero = `Tatyana ${run}`;

	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Scene GM', `e2e-scene-gm-${run}@localhost`);
	await gm.goto('/hmtw/cards');
	await gm.locator('input[name="name"]').fill(`Arena ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();

	const playerContext = await browser.newContext();
	const player = await playerContext.newPage();
	await player.goto(roomUrl);
	await player.getByLabel("Your character's name").fill(hero);
	await player.getByRole('button', { name: 'Ask for a seat' }).click();
	await expect(gm.getByText(hero)).toBeVisible(POLLED);
	await gm
		.locator('.ch__waiter, li, span', { hasText: hero })
		.getByRole('button', { name: 'Let in' })
		.first()
		.click();
	await expect(player.getByText(/Waiting for the GM to let you in/)).toHaveCount(0, POLLED);

	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();
	await expect(gm.getByRole('heading', { name: 'Where everyone is' })).toBeVisible();
	await expect(player.getByText('The GM has not named the zones yet.')).toBeVisible(POLLED);

	// --- The GM names the zones. ---
	await gm.getByText('Name the zones…').click();
	await gm.getByRole('textbox', { name: 'Zone 1', exact: true }).fill('Arena');
	await gm.getByRole('textbox', { name: 'Zone 2', exact: true }).fill("King's Pillar");
	await gm.getByRole('button', { name: 'Save the zones' }).click();
	const gmScene = gm.locator('.scene');
	await expect(gmScene.getByText('Arena', { exact: true })).toBeVisible();

	// --- The player places themselves, and the GM sees it. ---
	const playerScene = player.locator('.scene');
	await expect(playerScene.getByText("King's Pillar", { exact: true })).toBeVisible(POLLED);
	await player.getByLabel(`Where ${hero} is`).selectOption({ label: 'Arena' });
	await expect(gmScene.locator('.scene__row', { hasText: 'Arena' })).toContainText(hero, POLLED);

	// --- Three zombies at 1/0, and the King at 4/10. ---
	await gm.getByLabel('Enemy name').fill('Zombie');
	await gm.getByLabel('How many').fill('3');
	await gm.getByLabel('Health', { exact: true }).fill('1');
	await gm.getByLabel('Defense', { exact: true }).fill('0');
	await gm.locator('.add-enemy').getByRole('button', { name: 'Add' }).click();
	await gm.getByLabel('Enemy name').fill('King of Swords');
	await gm.getByLabel('Health', { exact: true }).fill('4');
	await gm.getByLabel('Defense', { exact: true }).fill('10');
	await gm.locator('.add-enemy').getByRole('button', { name: 'Add' }).click();

	// A lone enemy goes by its name; its HD is open, not folded away.
	await expect(gm.getByRole('button', { name: 'King of Swords: Defense down one' })).toBeVisible();
	await expect(gm.getByText('3 of 3 up')).toBeVisible();

	// The GM puts Zombie A on the Pillar.
	await gm.getByText('3 of 3 up').click();
	await gm.getByLabel('Where Zombie A is').selectOption({ label: "King's Pillar" });
	await expect(gmScene.locator('.scene__row', { hasText: "King's Pillar" })).toContainText(
		'Zombie A'
	);

	// --- The player marks the damage and a kill: anyone's, not only the GM's. ---
	await expect(player.getByText('3 of 3 up')).toBeVisible(POLLED);
	await player.getByText('3 of 3 up').click();
	await player.getByRole('button', { name: 'Zombie B: Health down one' }).click();
	await expect(player.getByRole('button', { name: 'Zombie B: Health down one' })).toBeDisabled(
		POLLED
	);
	await player
		.locator('.cr', { hasText: 'Zombie B' })
		.getByRole('button', { name: 'Down', exact: true })
		.click();
	await expect(gm.getByText('2 of 3 up')).toBeVisible(POLLED);
	// Down is crossed out and kept, never removed.
	await expect(gmScene.locator('.scene__who--down', { hasText: 'Zombie B' })).toBeVisible();

	// The player has no split or merge, and no "Add an enemy".
	await expect(player.getByRole('button', { name: /Split off/ })).toHaveCount(0);
	await expect(player.getByLabel('Enemy name')).toHaveCount(0);

	await shot(gm, 'gm-desktop');
	await shot(player, 'player-desktop');

	// --- The GM splits Zombie C off, and rejoins it. ---
	await gm.getByLabel('Choose Zombie C to split off').check();
	await gm.getByRole('button', { name: /Split off 1/ }).click();
	await expect(gm.getByRole('button', { name: 'Rejoin the rest' })).toBeVisible();
	await shot(gm, 'gm-after-split');
	await gm.getByRole('button', { name: 'Rejoin the rest' }).click();
	await expect(gm.getByRole('button', { name: 'Rejoin the rest' })).toHaveCount(0);

	// --- Accessibility, with every new panel open and populated. ---
	expect(await violations(gm)).toEqual([]);
	expect(await violations(player)).toEqual([]);

	// --- And at phone width, where the combatant columns are narrowest. ---
	await player.setViewportSize({ width: 390, height: 844 });
	await shot(player, 'player-phone');
	const overflow = await player.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow, 'the page scrolls sideways at 390px').toBeLessThanOrEqual(0);

	await gmContext.close();
	await playerContext.close();
});
