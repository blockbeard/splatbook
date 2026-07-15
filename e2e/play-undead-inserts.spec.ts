import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 104: Ghost, Revenant, and Thrall. Unlike Followers (commit 102)
 * these need no pack data to attach — blank state, nothing to seed — so all
 * three "+" buttons are always clickable, no fetch-gated `disabled`. Ghost
 * gets full coverage (attach, pick an Instinct, reload persists); Revenant
 * and Thrall just confirm their own "+" attaches and shows their own tab,
 * since the underlying attach/tab-appears mechanism is shared code already
 * exercised by Ghost's test.
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

async function buildAndOpenPlaySheet(page: Page): Promise<void> {
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
}

test('attaching Ghost adds the tab; an Instinct pick persists across reload', async ({ page }) => {
	await signIn(page, 'E2E Ghost', 'e2e-ghost@localhost');
	await buildAndOpenPlaySheet(page);

	await expect(page.getByRole('button', { name: 'Ghost', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Add Ghost' }).click();

	await expect(page).toHaveURL(/[?&]tab=ghost/);
	await expect(page.getByRole('heading', { name: 'Ghost', exact: true })).toBeVisible();

	await page.getByRole('button', { name: /^Denial\./ }).click();
	await expect(page.getByRole('button', { name: /^Denial\./ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Wait for the debounced autosave before reloading.
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Ghost', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Ghost', exact: true }).click();
	await expect(page.getByRole('button', { name: /^Denial\./ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('attaching Revenant adds its own tab', async ({ page }) => {
	await signIn(page, 'E2E Revenant', 'e2e-revenant@localhost');
	await buildAndOpenPlaySheet(page);

	await expect(page.getByRole('button', { name: 'Revenant', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Add Revenant' }).click();

	await expect(page).toHaveURL(/[?&]tab=revenant/);
	await expect(page.getByRole('heading', { name: 'Revenant', exact: true })).toBeVisible();
});

test('attaching Thrall adds its own tab', async ({ page }) => {
	await signIn(page, 'E2E Thrall', 'e2e-thrall@localhost');
	await buildAndOpenPlaySheet(page);

	await expect(page.getByRole('button', { name: 'Thrall', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Add Thrall' }).click();

	await expect(page).toHaveURL(/[?&]tab=thrall/);
	await expect(page.getByRole('heading', { name: 'Thrall', exact: true })).toBeVisible();
});
