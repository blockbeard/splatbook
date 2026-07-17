import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 114: every play-mode edit autosaves, so every mistap persists — undo
 * is the counterweight. A change surfaces a toast whose Undo writes the
 * previous blob back through the same save path. Worth covering end to end
 * because the interesting half is persistence: after undoing and reloading,
 * the *server's* copy must be the restored one.
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

test('a mistap on the play sheet can be undone, and the undo persists', async ({ page }) => {
	await signIn(page, 'E2E Play Undo', 'e2e-play-undo@localhost');

	// Golden-path a character (same blind-Next path as play-tabs.spec.ts).
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
	await expect(page.getByRole('heading', { name: 'HP', exact: true })).toBeVisible();

	// Assert on what the sheet *shows*, not blob internals: a fresh-from-wizard
	// blob stores hp 0/0 until PlayMode's enterPlay normalises it on open, so
	// the displayed "18 / 18" is the truth the player acts on. Scope to the HP
	// section — other trackers print numbers too.
	const hpSection = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'HP', exact: true }) });
	const hpReadout = hpSection.getByText(/^\d+ \/ \d+$/);
	await expect(hpReadout).toBeVisible();
	// enterPlay normalises once the playbook loads — wait out the 0/0 moment.
	await expect(hpReadout).not.toHaveText('0 / 0');
	const [current, max] = (await hpReadout.innerText()).split(' / ').map(Number);
	expect(current).toBe(max);
	expect(max).toBeGreaterThan(1);

	// No toast yet: the normalisation autosave the page just did is the game's
	// housekeeping, not a mistap — nothing to offer undo for.
	await expect(page.getByRole('status')).toHaveCount(0);

	// The mistap: tap the first HP box, dropping current to 1.
	await page.getByRole('group', { name: 'HP' }).getByRole('button').first().click();
	await expect(hpReadout).toHaveText(`1 / ${max}`);
	await expect(page.getByRole('status').getByText('Change saved.')).toBeVisible();

	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(hpReadout).toHaveText(`${max} / ${max}`);
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();

	// The restored value is what the server holds: reload — the page loads the
	// blob back from the database — and the sheet still reads full.
	await page.reload();
	await expect(hpSection.getByText(/^\d+ \/ \d+$/)).toHaveText(`${max} / ${max}`);
});
