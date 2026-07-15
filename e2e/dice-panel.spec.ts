import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 107: the dice panel's base row (the whole polyhedral set, always
 * available regardless of what a game's own presets offer) and the one-shot
 * bonus box ("applies to the next roll" — armed, consumed by whatever rolls
 * next, then back to 0).
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

test('the dice panel offers the full polyhedral set and a one-shot bonus', async ({ page }) => {
	await signIn(page, 'E2E Dice', 'e2e-dice@localhost');

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

	const dice = page.locator('section[aria-label="Dice roller"]');
	for (const label of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', '2d6']) {
		await expect(dice.getByRole('button', { name: label, exact: true })).toBeVisible();
	}

	await dice.getByLabel('Bonus').fill('2');
	await expect(page.getByText('Bonus +2 armed for your next roll.')).toBeVisible();

	await dice.getByRole('button', { name: 'd20', exact: true }).click();

	// The roll surface reads the bonus back distinctly from any base modifier.
	await expect(page.getByText(/\(bonus \+2\)/)).toBeVisible();

	// One-shot: consumed by that roll — back to 0 and no longer armed.
	await expect(dice.getByLabel('Bonus')).toHaveValue('0');
	await expect(page.getByText('armed for your next roll')).toHaveCount(0);
});
