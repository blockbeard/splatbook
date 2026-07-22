import { test, expect, type Page } from '@playwright/test';

/**
 * Phase-9 invite/join loop. Two separate browser contexts (two accounts) prove
 * the whole capability: a GM creates a campaign and gets an invite link; a
 * second person opens that link, signs in, and joins as a player; and the GM
 * then sees the player in the party roster.
 *
 * Book II visibility is no longer tied to campaign-GM membership (commit 97
 * replaced that gate with a reader opt-in preference) — see
 * `reference-spoilers.spec.ts` for that coverage.
 */

/** Sign in through the dev-login provider as a named account. */
async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	// The header's control — the landing page has a Sign in prompt of its own.
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
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

test('the GM delegates steading edit to a player, who then gets the tracker', async ({
	browser
}) => {
	// --- GM: sign in, create a campaign, create its steading ---
	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Steading GM', 'e2e-steading-gm@localhost');

	await gm.goto('/campaigns');
	await gm.locator('input[name="name"]').fill('Steading Camp');
	await gm.getByRole('button', { name: 'Create campaign' }).click();
	await gm.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
	const campaignUrl = gm.url();
	const inviteUrl = await gm.getByLabel('Invite link').inputValue();

	await gm.getByRole('button', { name: 'Create campaign steading' }).click();
	await gm.waitForURL(/\/campaigns\/[0-9a-f-]{36}\/steading$/);

	// --- Player: join as a player ---
	const playerContext = await browser.newContext();
	const player = await playerContext.newPage();
	await player.goto(inviteUrl);
	await player.getByRole('button', { name: /Sign in to join/i }).click();
	await player.waitForURL(/\/auth\/signin/);
	await player.locator('input[name="name"]').fill('Steading Player');
	await player.locator('input[name="email"]').fill('e2e-steading-player@localhost');
	await player.getByRole('button', { name: /Dev Login/i }).click();
	await player.waitForURL(/\/campaigns\/join\//);
	await player.getByRole('button', { name: 'Join as player' }).click();
	await player.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);

	// Before the grant, the shared steading is read-only for the player: they can
	// see it, but there's no tracker to open.
	await player.goto(`${campaignUrl}/steading`);
	await expect(player.getByRole('link', { name: 'Open tracker' })).toHaveCount(0);

	// --- GM: grant the player edit on the steading ---
	await gm.goto(campaignUrl);
	const playerRow = gm.locator('li', { hasText: 'Steading Player' });
	await playerRow.getByLabel('Can edit the steading').check();
	// The grant persists (the toggle stays checked through its own save).
	await expect(playerRow.getByLabel('Can edit the steading')).toBeChecked();

	// --- Player: now the tracker is theirs to open ---
	await player.goto(`${campaignUrl}/steading`);
	const tracker = player.getByRole('link', { name: 'Open tracker' });
	await expect(tracker).toBeVisible();
	await tracker.click();
	// Lands on the play route with the shared steading's id — the delegated read
	// succeeded, so it's the campaign's steading, not a fresh blank draft.
	// (Wait for the navigation to land before capturing the URL — url() right
	// after click() can still be the steading page.)
	await player.waitForURL(/\/stonetop\/steading\/play\?id=[0-9a-f-]{36}/);
	const trackerUrl = player.url();
	await expect(player.getByText(/No steading to play/i)).toHaveCount(0);

	// --- GM: revoke it ---
	await playerRow.getByLabel('Can edit the steading').uncheck();
	await expect(playerRow.getByLabel('Can edit the steading')).not.toBeChecked();

	// --- Player: the read-only view drops the tracker link again... ---
	await player.goto(`${campaignUrl}/steading`);
	await expect(player.getByRole('link', { name: 'Open tracker' })).toHaveCount(0);

	// ...and the tracker itself, already open in this tab, says so on reload
	// instead of quietly handing back a blank draft (the server re-checks the
	// grant on every load and save regardless — this is the client honestly
	// reflecting that, not a new access check).
	await player.goto(trackerUrl);
	await expect(player.getByText(/no longer have access/i)).toBeVisible();
	await expect(player.getByText(/No steading to play/i)).toHaveCount(0);

	await gmContext.close();
	await playerContext.close();
});
