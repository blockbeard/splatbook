import { test, expect, type Page } from '@playwright/test';

/**
 * Phase-9 invite/join loop. Two separate browser contexts (two accounts) prove
 * the whole capability: a GM creates a campaign and gets an invite link; a
 * second person opens that link, signs in, and joins as a player; and the GM
 * then sees the player in the party roster. Also exercises the reference GM gate
 * — running a campaign reveals Book II to the GM.
 */

/** Sign in through the dev-login provider as a named account. */
async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('a GM invites a player, who joins and appears in the party', async ({ browser }) => {
	// --- GM: sign in and create a campaign ---
	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'E2E GM', 'e2e-gm@localhost');

	await gm.goto('/campaigns');
	await gm.locator('input[name="name"]').fill('E2E Campaign');
	await gm.getByRole('button', { name: 'Create campaign' }).click();

	// Landed on the campaign page as GM, with an invite link.
	await gm.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
	const campaignUrl = gm.url();
	await expect(gm.getByRole('heading', { name: 'E2E Campaign' })).toBeVisible();
	const inviteUrl = await gm.getByLabel('Invite link').inputValue();
	expect(inviteUrl).toContain('/campaigns/join/');

	// The GM runs a stonetop campaign, so the reference now includes Book II.
	await gm.goto('/g/stonetop/reference');
	await expect(gm.getByText(/GM-only rules \(Book II\) are included/i)).toBeVisible();

	// --- Player: open the invite in a fresh context, sign in, join ---
	const playerContext = await browser.newContext();
	const player = await playerContext.newPage();
	await player.goto(inviteUrl);
	await expect(player.getByRole('heading', { name: 'E2E Campaign' })).toBeVisible();

	// Signed out: prompt to sign in, then return to the invite.
	await player.getByRole('button', { name: /Sign in to join/i }).click();
	await player.waitForURL(/\/auth\/signin/);
	await player.locator('input[name="name"]').fill('E2E Player');
	await player.locator('input[name="email"]').fill('e2e-player@localhost');
	await player.getByRole('button', { name: /Dev Login/i }).click();

	// Back on the invite, now able to join.
	await player.waitForURL(/\/campaigns\/join\//);
	await player.getByRole('button', { name: 'Join as player' }).click();

	// Joined: on the campaign page, seated as a player — the roster row for
	// this member carries the exact role badge.
	await player.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
	const seat = player.locator('li', { hasText: 'E2E Player' });
	await expect(seat.getByText('player', { exact: true })).toBeVisible();
	// A player never sees the invite controls.
	await expect(player.getByLabel('Invite link')).toHaveCount(0);

	// --- GM: the roster now lists both members ---
	await gm.goto(campaignUrl);
	const party = gm.locator('section', { hasText: 'Party' });
	await expect(party.getByText('E2E GM')).toBeVisible();
	await expect(party.getByText('E2E Player')).toBeVisible();

	await gmContext.close();
	await playerContext.close();
});
