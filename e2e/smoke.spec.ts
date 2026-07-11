import { test, expect } from '@playwright/test';

/**
 * Phase-4 smoke: create → save → reload → print view. Exercises the whole
 * persistence loop through the real UI — sign in with the dev-login provider,
 * build a character in the wizard, finish (which saves it and opens the saved
 * sheet by id), reload to prove it came from the database, and confirm the
 * print view drops the app chrome.
 */
test('create, save, reload, and print a character', async ({ page }) => {
	// --- Sign in via the dev-login provider ---
	await page.goto('/');
	// The header's control — the landing page has a Sign in prompt of its own.
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	// Auth.js's default sign-in page renders the dev provider's credential fields.
	await page.locator('input[name="name"]').fill('E2E Player');
	await page.locator('input[name="email"]').fill('e2e@localhost');
	await page.getByRole('button', { name: /Dev Login/i }).click();
	// Back in the app, now authenticated.
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

	// --- Build a character ---
	await page.goto('/g/stonetop/character/build');
	// Pick the first playbook (all playbook cards carry aria-pressed).
	await page.locator('button[aria-pressed]').first().click();
	// Step through to the end; Next is ungated, so click it until it becomes Finish.
	const next = page.getByRole('button', { name: 'Next', exact: true });
	for (let i = 0; i < 20 && (await next.count()) > 0; i++) {
		await next.click();
	}
	await page.getByRole('button', { name: 'Finish' }).click();

	// --- Saved to the database, opened by id ---
	await page.waitForURL(/\/g\/stonetop\/character\/sheet\?id=/);
	const savedUrl = page.url();
	await expect(page.locator('article.character-sheet')).toBeVisible();

	// --- Reload: the sheet still renders, now loaded from the DB ---
	await page.reload();
	await expect(page).toHaveURL(savedUrl);
	await expect(page.locator('article.character-sheet')).toBeVisible();

	// --- Print view: app chrome and the screen-only export controls drop out ---
	await page.emulateMedia({ media: 'print' });
	await expect(page.locator('.sheet-toolbar')).toBeHidden();
	await expect(page.locator('.sheet-export')).toBeHidden();
	await expect(page.locator('article.character-sheet')).toBeVisible();
});
