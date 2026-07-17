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

	const before = await page.evaluate(async (id) => {
		const res = await fetch(`/api/entities/${id}`);
		return (await res.json()) as { data: { hp: { current: number } } };
	}, id);
	const hpBefore = before.data.hp.current;
	expect(hpBefore).toBeGreaterThan(1);

	// The mistap: knock a hit point off. The toast offers the way back.
	await page.getByRole('group', { name: /HP/i }).getByRole('button').first().click();
	await expect(page.getByRole('status').getByText('Change saved.')).toBeVisible();

	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();

	// The restored blob is what the server holds — reload and re-read.
	await page.reload();
	const after = await page.evaluate(async (id) => {
		const res = await fetch(`/api/entities/${id}`);
		return (await res.json()) as { data: { hp: { current: number } } };
	}, id);
	expect(after.data.hp.current).toBe(hpBefore);
});
