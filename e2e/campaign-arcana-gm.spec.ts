import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 105's cross-cutting half: the GM authors a mystery on a party
 * member's Arcana card through `/campaigns/[id]/arcana` (the same
 * GM-write path end-of-session already uses), and the campaign's
 * `showLockedArcana` setting (the first per-campaign setting) controls
 * whether that mystery's text is visible on the player's play sheet before
 * it's unlocked. One account plays both GM and player here — nothing about
 * the write path cares who owns the character being written to, and a
 * second account would only add signup noise to a test that's really about
 * the write-through and the settings gate.
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

test('GM authors an Arcana mystery; the campaign setting gates its visibility', async ({
	page
}) => {
	await signIn(page, 'E2E Arcana GM', 'e2e-arcana-gm@localhost');

	// Build a character to be the target of the GM's write.
	await page.goto('/stonetop/character/build');
	await page.locator('button[aria-pressed]').first().click();
	const next = page.getByRole('button', { name: 'Next', exact: true });
	for (let i = 0; i < 20 && (await next.count()) > 0; i++) {
		await next.click();
	}
	await page.getByRole('button', { name: 'Finish' }).click();
	await page.waitForURL(/\/stonetop\/character\/sheet\?id=/);
	const characterId = new URL(page.url()).searchParams.get('id');

	// Create a campaign and attach the character to it.
	await page.goto('/campaigns');
	await page.locator('input[name="name"]').fill('E2E Arcana Campaign');
	await page.getByRole('button', { name: 'Create campaign' }).click();
	await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
	const campaignUrl = page.url();

	const myCharacters = page.locator('section', { hasText: 'Your characters' });
	await myCharacters.getByRole('button', { name: /^Attach$/ }).click();
	await expect(myCharacters.getByText('Attached · remove')).toBeVisible();

	// Author a mystery through the GM Arcana tool.
	await page.getByRole('link', { name: 'Author Arcana' }).click();
	await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}\/arcana$/);
	await page.getByRole('button', { name: 'Attach Arcana' }).click();
	await page.getByRole('button', { name: '+ Card' }).click();
	await page.getByPlaceholder('Name').fill('Staff of the Lidless Orb');
	await page.getByRole('button', { name: '+ Mystery' }).click();
	await page.getByPlaceholder('Mystery name').fill('Power of the Lidless Orb');
	await page
		.getByPlaceholder('What the player reads once this unlocks…')
		.fill('You can cast your sight afar.');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();

	// On the player's own play sheet, the card shows but the mystery — not yet
	// unlocked (0 marks < unlockAt 1), and the campaign default is hidden — does not.
	await page.goto(`/stonetop/character/play?id=${characterId}`);
	await page.getByRole('button', { name: 'Arcana', exact: true }).click();
	// The card name is an editable <input> on the play sheet — its value is
	// invisible to getByText, so assert it the way the Seeker golden path does.
	await expect(page.getByPlaceholder('Name')).toHaveValue('Staff of the Lidless Orb');
	await expect(page.getByText('Power of the Lidless Orb')).toHaveCount(0);

	// The GM flips the campaign setting to preview locked mysteries.
	await page.goto(campaignUrl);
	await page.getByRole('checkbox', { name: /Show locked Arcana mysteries/ }).check();
	await page.getByRole('button', { name: 'Save settings' }).click();

	// Now the play sheet shows the still-locked mystery, marked as locked.
	await page.goto(`/stonetop/character/play?id=${characterId}`);
	await page.getByRole('button', { name: 'Arcana', exact: true }).click();
	await expect(page.getByText('Power of the Lidless Orb')).toBeVisible();
	await expect(page.getByText('Locked — 1 marks')).toBeVisible();
});
