import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 101: PlayMode's tab bar (Sheet · Moves · Inventory). `?tab=` makes
 * the active tab shareable and survives a reload — the thing worth covering
 * end to end, since it's a same-document URL update (`replaceState`), not a
 * navigation, and that's exactly the kind of state a unit test can't see.
 */

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('the play sheet remembers which tab is open across a reload', async ({ page }) => {
	await signIn(page, 'E2E Play Tabs', 'e2e-play-tabs@localhost');

	// Golden-path a character through the wizard (same blind-Next path as
	// smoke.spec.ts) to land on a saved, playable character.
	await page.goto('/stonetop/character/build');
	await page.locator('button[aria-pressed]').first().click();
	const next = page.getByRole('button', { name: 'Next', exact: true });
	for (let i = 0; i < 20 && (await next.count()) > 0; i++) {
		await next.click();
	}
	await page.getByRole('button', { name: 'Finish' }).click();
	await page.waitForURL(/\/stonetop\/character\/sheet\?id=/);
	const id = new URL(page.url()).searchParams.get('id');

	await page.goto(`/stonetop/character/play?id=${id}`);

	// Defaults to Sheet — HP shows, Moves/Inventory content doesn't.
	await expect(page.getByRole('heading', { name: 'HP', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Moves', exact: true })).toHaveCount(0);

	await page.getByRole('button', { name: 'Moves', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Moves', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'HP', exact: true })).toHaveCount(0);
	await expect(page).toHaveURL(/[?&]tab=moves/);

	// Reload: the URL alone decides the tab, no client state to lose.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Moves', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Inventory', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
	await expect(page).toHaveURL(/[?&]tab=inventory/);
});
