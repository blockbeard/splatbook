import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 108: the playbook's base damage die gets its own roll button — once
 * on the play sheet's header (any time), and again on any move card tagged
 * `rollsDamage` (Clash, Let Fly and kin — moves whose own resolution says
 * "deal your damage" rather than a stat notation).
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

test('the Heavy gets a Damage (d10) button on the header and on Clash', async ({ page }) => {
	await signIn(page, 'E2E Damage', 'e2e-damage@localhost');

	await page.goto('/stonetop/character/build');
	await page
		.locator('button[aria-pressed]')
		.filter({ has: page.locator('span.text-lg.font-semibold', { hasText: 'The Heavy' }) })
		.click();

	const next = page.getByRole('button', { name: 'Next', exact: true });
	for (let i = 0; i < 20 && (await next.count()) > 0; i++) {
		await next.click();
	}
	await page.getByRole('button', { name: 'Finish' }).click();
	await page.waitForURL(/\/stonetop\/character\/sheet\?id=/);
	const id = new URL(page.url()).searchParams.get('id');

	await page.goto(`/stonetop/character/play?id=${id}`);

	// The header button — always available, no move required.
	const headerDamage = page.getByRole('button', { name: 'Damage (d10)', exact: true });
	await expect(headerDamage).toBeVisible();
	await headerDamage.click();
	await expect(page.getByText('Damage', { exact: true }).first()).toBeVisible();

	// Clash is a basic move (every playbook has it), tagged rollsDamage — its
	// card gets the same button, distinct from its "Roll +STR" button.
	await page.getByRole('button', { name: 'Moves', exact: true }).click();
	const clashCard = page.locator('div.rounded-lg.border', {
		has: page.getByRole('heading', { name: 'Clash', exact: true, level: 4 })
	});
	await expect(clashCard.getByRole('button', { name: /Roll \+STR/ })).toBeVisible();
	const clashDamage = clashCard.getByRole('button', { name: /Damage/ });
	await expect(clashDamage).toBeVisible();
	await clashDamage.click();

	// The move card's button rolls with its own label, distinguishing it in
	// the roll surface from the bare header roll.
	await expect(page.getByText('Clash — damage', { exact: true })).toBeVisible();
});
