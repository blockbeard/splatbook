import { test, expect, type Page } from '@playwright/test';

/**
 * The end-of-session loop (phase 11): a GM with a character at the table runs
 * the move, answers the questions, and the XP lands on the character's sheet.
 *
 * The interesting part is the write-through: the XP is marked on an entity by
 * the *campaign's GM*, through a path that has to hold up server-side. So this
 * asserts the number that ends up on the sheet, not just that the button was
 * clickable.
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

test('the GM ends a session and the XP lands on the sheet', async ({ page }) => {
	await signIn(page, 'E2E Session GM', 'e2e-session@localhost');

	// A saved character with 1 XP already marked, so we can see the award added
	// to what was there rather than replacing it.
	const created = await page.evaluate(async () => {
		const character = {
			schemaVersion: 3,
			name: 'Ryn',
			playbookId: 'the-blessed',
			level: 1,
			xp: 1,
			hp: { current: 18, max: 18 },
			backgroundId: '',
			instinctId: '',
			stats: {
				STR: { value: 0, debilitated: false },
				DEX: { value: 2, debilitated: false },
				CON: { value: 1, debilitated: false },
				INT: { value: -1, debilitated: false },
				WIS: { value: 1, debilitated: false },
				CHA: { value: 0, debilitated: false }
			},
			moves: [],
			possessions: [],
			possessionChoices: {},
			trackers: {},
			appearance: [],
			origin: {},
			advancement: [],
			inventory: { gear: [], smallItems: [], undefinedGear: 0, undefinedSmall: 0 },
			introductions: {}
		};
		const res = await fetch('/api/entities', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				gameId: 'stonetop',
				entityType: 'character',
				name: 'Ryn',
				schemaVersion: 3,
				status: 'ready',
				data: character
			})
		});
		return (await res.json()) as { id: string };
	});
	expect(created.id).toBeTruthy();

	// A campaign, with that character seated at it.
	await page.goto('/campaigns');
	await page.locator('input[name="name"]').fill('E2E Session');
	await page.getByRole('button', { name: 'Create campaign' }).click();
	await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);

	await page
		.getByRole('button', { name: /Attach/ })
		.first()
		.click();
	await expect(page.getByText('Ryn').first()).toBeVisible();

	// Run the move: two group "yes"es, and one personal prompt for Ryn.
	await page.getByRole('link', { name: 'End session' }).click();
	await expect(page.getByRole('heading', { name: 'End of Session' })).toBeVisible();

	await page
		.locator('label')
		.filter({ hasText: /Did we learn more/ })
		.locator('input')
		.check();
	await page
		.locator('label')
		.filter({ hasText: /Did we defeat a threat/ })
		.locator('input')
		.check();
	await page
		.locator('label')
		.filter({ hasText: /instinct/ })
		.first()
		.locator('input')
		.check();

	// 2 group + 1 personal.
	await expect(page.getByText('+3 XP')).toBeVisible();

	// Jot the session notes — the record should carry them (phase 17). Shared
	// notes for the table, private ones for the GM alone.
	await page.getByPlaceholder(/The bridge burned/).fill('E2E: the mill flooded.');
	await page.getByLabel('Private notes').fill('E2E: the miller is a doppelgänger.');

	await page.getByRole('button', { name: /Mark XP on every sheet/ }).click();
	await expect(page.getByText(/Marked\./)).toBeVisible();

	// The number that matters: 1 already marked + 3 from the session.
	const after = await page.evaluate(async (id) => {
		const res = await fetch(`/api/entities/${id}`);
		return (await res.json()) as { data: { xp: number } };
	}, created.id);
	expect(after.data.xp).toBe(4);

	// The run went into the ledger (phase 17): back on the campaign dashboard,
	// the session log shows the numbered record, the award, and the notes.
	await page.getByRole('link', { name: /E2E Session/ }).click();
	await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
	const log = page.locator('section', { has: page.getByRole('heading', { name: 'Session log' }) });
	await expect(log.getByText('Session 1')).toBeVisible();
	await expect(log.getByText('3 XP across the party')).toBeVisible();
	await expect(log.getByText('Ryn +3 XP')).toBeVisible();
	await expect(log.getByText('E2E: the mill flooded.')).toBeVisible();

	// The GM's private notes rode along, plainly marked as theirs alone. (The
	// player-side absence is enforced server-side — the load strips the field —
	// and covered by the service tests; this asserts the GM half renders.)
	await expect(log.getByText('Private notes (GM only)')).toBeVisible();
	await expect(log.getByText('E2E: the miller is a doppelgänger.')).toBeVisible();

	// And the GM can fix the notes after the fact (commit 112).
	await log.getByRole('button', { name: 'Edit notes' }).click();
	await log.locator('textarea[name="notes"]').fill('E2E: the mill flooded. Vera saved the grain.');
	await log.getByRole('button', { name: 'Save notes' }).click();
	await expect(log.getByText('Vera saved the grain.')).toBeVisible();
});
