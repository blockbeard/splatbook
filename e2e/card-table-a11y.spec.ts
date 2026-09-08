import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * WCAG 2.1 AA over the card table, in every state it has and in both rooms.
 *
 * This exists because the palette is monochrome and has nothing but *value* to
 * spend, so a colour here is one measurement away from failing 1.4.3 and the
 * failure is invisible to whoever made it — the first audit found thirty-four
 * violations from a single token being 55% ink instead of 75%, and one rule
 * that had never been looked at in the light room at all. A design like that
 * needs a guard rather than a memory.
 *
 * Automated scanning catches roughly a third of accessibility problems; the
 * rest are in `card-table.spec.ts` (the live region, keyboard operation) or
 * were checked by hand at the time. This is the third, kept honest.
 */

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

interface AxeResult {
	violations: { id: string; impact: string | null; nodes: { target: string[] }[] }[];
}

/** Scan the page as it stands, in both rooms. Returns the failures, flattened. */
async function scan(page: Page, label: string): Promise<string[]> {
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
		)) as AxeResult;
		for (const v of result.violations) {
			for (const n of v.nodes) found.push(`${label} [${theme}] ${v.id} — ${n.target.join(' ')}`);
		}
	}
	await page.evaluate(() => document.documentElement.classList.remove('dark'));
	return found;
}

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('the table meets WCAG 2.1 AA in every state, in both rooms', async ({ browser }) => {
	test.slow();
	const run = Date.now().toString(36);
	const failures: string[] = [];

	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'A11y GM', `a11y-gm-${run}@localhost`);

	await gm.goto('/hmtw/cards');
	failures.push(...(await scan(gm, 'index')));

	await gm.locator('input[name="name"]').fill(`A11y ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();
	failures.push(...(await scan(gm, 'decks')));

	// The two overlays. They sit on the *recessed* ground rather than the table,
	// which is the surface that decides how dark the quiet token may be — and
	// the first audit never opened either of them.
	// A flip goes to the fate slot, not the discard — that is what a Test of
	// Fate is — so putting something in a discard takes both steps. "look
	// through" only exists on a discard, and only once there is one.
	await gm.getByRole('button', { name: 'Turn one over' }).first().click();
	await gm.getByRole('button', { name: 'Into the discard' }).click({ timeout: 15_000 });
	await gm.getByRole('button', { name: 'look through' }).first().click({ timeout: 15_000 });
	await expect(gm.locator('.pane')).toBeVisible();
	failures.push(...(await scan(gm, 'discard pane')));
	await gm.getByRole('button', { name: 'Look closer' }).first().click();
	failures.push(...(await scan(gm, 'zoomed card')));
	await gm.keyboard.press('Escape');
	await gm.keyboard.press('Escape');

	// A watcher, then somebody waiting on the GM.
	const pc = await browser.newContext();
	const player = await pc.newPage();
	await player.goto(roomUrl);
	failures.push(...(await scan(player, 'watching')));
	await player.getByLabel("Your character's name").fill(`Grimwold ${run}`);
	await player.getByRole('button', { name: 'Ask for a seat' }).click();
	failures.push(...(await scan(player, 'waiting')));

	await expect(gm.getByText(`Grimwold ${run}`)).toBeVisible({ timeout: 15_000 });
	await gm.getByRole('button', { name: 'Let in' }).first().click();

	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();
	await gm.getByRole('button', { name: 'Deal the round' }).click();
	await expect(gm.getByText('Lesser dooms', { exact: false })).toBeVisible({ timeout: 15_000 });
	failures.push(...(await scan(gm, 'challenge, dealt')));

	await expect(player.locator('.hand button').first()).toBeVisible({ timeout: 15_000 });
	failures.push(...(await scan(player, 'challenge, player')));

	// A card in hand: drop targets and the declare buttons appear.
	await player.locator('.hand button').first().click();
	failures.push(...(await scan(player, 'card picked up')));
	await player
		.locator('.combatant--mine')
		.getByRole('button', { name: /Play facedown — your turn/ })
		.click();
	failures.push(...(await scan(player, 'declaring')));
	await player.getByRole('button', { name: 'Never mind' }).click();

	await gm.getByRole('button', { name: 'Guide the round' }).click();
	failures.push(...(await scan(gm, 'guided')));

	expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);

	await gmContext.close();
	await pc.close();
});
