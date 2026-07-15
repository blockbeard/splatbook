import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 102: the generic Followers insert. Not attached on a fresh
 * character (no "Followers" tab, just the "+" affordance); attaching adds
 * the tab and a first blank follower in one action; editing and dismissing
 * both write through the engine and land on the sheet immediately.
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

test('attaching Followers adds the tab; a follower can be added, edited, and dismissed', async ({
	page
}) => {
	await signIn(page, 'E2E Followers', 'e2e-followers@localhost');

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

	// No Followers tab yet — just the "+" affordance.
	await expect(page.getByRole('button', { name: 'Followers', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Add Followers' }).click();

	// Attaching jumps straight to the new tab with one blank follower waiting.
	await expect(page).toHaveURL(/[?&]tab=followers/);
	await expect(page.getByRole('heading', { name: 'Followers', exact: true })).toBeVisible();
	await expect(page.getByPlaceholder('Name')).toHaveCount(1);

	await page.getByPlaceholder('Name').fill('Enfys');
	await expect(page.getByPlaceholder('Name')).toHaveValue('Enfys');

	// Wait for the debounced autosave to land before reloading, or the reload
	// can race the 600ms timer and pick up the pre-edit state.
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();

	// Reload: the written name and the attached tab both persist.
	await page.reload();
	await expect(page.getByRole('button', { name: 'Followers', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Followers', exact: true }).click();
	await expect(page.getByPlaceholder('Name')).toHaveValue('Enfys');

	// A second follower, then dismiss the first.
	await page.getByRole('button', { name: '+ Follower' }).click();
	await expect(page.getByPlaceholder('Name')).toHaveCount(2);
	await page.getByRole('button', { name: 'Dismiss' }).first().click();
	await expect(page.getByPlaceholder('Name')).toHaveCount(1);
	await expect(page.getByPlaceholder('Name')).toHaveValue('');
});
