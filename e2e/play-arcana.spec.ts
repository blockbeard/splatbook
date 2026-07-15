import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 105: Arcana. Like Ghost/Revenant/Thrall (commit 104), attaching
 * needs no pack data — a blank card, nothing to seed — so the "+" button is
 * never fetch-gated. This spec covers the player's own half: attach, add a
 * card, mark it, reload persists. The GM-authoring half (writing a mystery
 * onto a party member's card, and the campaign visibility setting) is
 * covered end-to-end in `campaign-arcana-gm.spec.ts`, since it needs a
 * second write path this single-character flow doesn't exercise.
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

test('attaching Arcana adds the tab; a card can be added and marked, and it persists', async ({
	page
}) => {
	await signIn(page, 'E2E Arcana', 'e2e-arcana@localhost');

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

	await expect(page.getByRole('button', { name: 'Arcana', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Add Arcana' }).click();

	await expect(page).toHaveURL(/[?&]tab=arcana/);
	await expect(page.getByRole('heading', { name: 'Arcana', exact: true })).toBeVisible();

	await page.getByRole('button', { name: '+ Card' }).click();
	await page.getByPlaceholder('Name').fill('Twisted Spear');
	// Mark the first box.
	await page.getByRole('button', { name: 'Mark 1' }).click();
	await expect(page.getByRole('button', { name: 'Mark 1' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await expect(page.getByText('Saved', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Arcana', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Arcana', exact: true }).click();
	await expect(page.getByPlaceholder('Name')).toHaveValue('Twisted Spear');
	await expect(page.getByRole('button', { name: 'Mark 1' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
