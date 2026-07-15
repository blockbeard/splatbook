import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 109: a stat roll that totals 6 or less arms a "Mark XP" follow-up on
 * the roll surface — Stonetop's classic "on a miss, mark experience." The
 * surface holds the follow-up open (no auto-fade) until the player runs it,
 * then shows a short confirmation. Damage and bare dice never arm one.
 *
 * The bonus box (commit 107) is the deterministic lever here: dialling in a
 * large negative bonus guarantees a miss without needing a seeded RNG.
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

test('a missed stat roll offers to mark XP, and marking it updates the sheet', async ({ page }) => {
	await signIn(page, 'E2E Miss', 'e2e-miss@localhost');

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

	await expect(page.getByText(/^0 \/ \d+ to level/)).toBeVisible();

	// A bonus this far underwater guarantees 2d6+stat+bonus totals 6 or less.
	const dice = page.locator('section[aria-label="Dice roller"]');
	await dice.getByLabel('Bonus').fill('-20');

	const statButton = page.locator('button[title^="Roll +"]').first();
	await statButton.click();

	// The follow-up holds the surface open — a miss doesn't fade on its own.
	const markXp = page.getByRole('button', { name: 'Mark XP', exact: true });
	await expect(markXp).toBeVisible();
	await page.waitForTimeout(1500);
	await expect(markXp).toBeVisible();

	await markXp.click();
	await expect(page.getByText('✓ Marked.', { exact: true })).toBeVisible();

	// The sheet reflects the mark once the follow-up's own edit is saved.
	await expect(page.getByText(/^1 \/ \d+ to level/)).toBeVisible();
});

test('a damage roll never offers to mark XP, even on a low total', async ({ page }) => {
	await signIn(page, 'E2E Miss Damage', 'e2e-miss-damage@localhost');

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
	await dice.getByLabel('Bonus').fill('-20');

	await page.getByRole('button', { name: /^Damage \(d\d+\)$/ }).click();
	await expect(page.getByText('Damage', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mark XP', exact: true })).toHaveCount(0);
});
