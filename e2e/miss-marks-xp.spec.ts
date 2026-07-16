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

/**
 * Golden-path a character — but unlike the other specs' blind-Next walk, stop
 * at the stats step and spend the whole array. The play sheet renders a
 * "Roll +STAT" button only for an *assigned* stat (`{#if c.stats[stat]}`), and
 * a blind walk leaves `stats` empty — a character with no stat buttons at all,
 * which this spec needs.
 */
async function buildCharacter(page: Page): Promise<string> {
	await page.goto('/stonetop/character/build');
	await page.locator('button[aria-pressed]').first().click();
	const next = page.getByRole('button', { name: 'Next', exact: true });

	// playbook -> background -> instinct -> appearance -> origin -> stats.
	for (let i = 0; i < 5; i++) await next.click();
	await expect(page.getByRole('heading', { name: 'Assign your stats' })).toBeVisible();

	// One click per row: the first value button in that stat's row that is
	// neither taken (aria-pressed) nor spent (disabled). Row-scoped on
	// purpose — a page-wide "first available" keeps landing in the STR row,
	// because re-assigning a stat is allowed and frees its old value right
	// back up, so six blind clicks just ping-pong STR between +2 and +1.
	for (const stat of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
		await page
			.locator('div.flex.items-center.gap-3')
			.filter({ has: page.getByText(stat, { exact: true }) })
			.locator('button[aria-pressed="false"]:not([disabled])')
			.first()
			.click();
	}
	await expect(page.getByText('All stats assigned.')).toBeVisible();

	// Blind-Next the rest of the way, as the other specs do.
	for (let i = 0; i < 20 && (await next.count()) > 0; i++) {
		await next.click();
	}
	await page.getByRole('button', { name: 'Finish' }).click();
	await page.waitForURL(/\/stonetop\/character\/sheet\?id=/);
	return new URL(page.url()).searchParams.get('id')!;
}

test('a missed stat roll offers to mark XP, and marking it updates the sheet', async ({ page }) => {
	await signIn(page, 'E2E Miss', 'e2e-miss@localhost');

	const id = await buildCharacter(page);
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

	const id = await buildCharacter(page);
	await page.goto(`/stonetop/character/play?id=${id}`);

	const dice = page.locator('section[aria-label="Dice roller"]');
	await dice.getByLabel('Bonus').fill('-20');

	await page.getByRole('button', { name: /^Damage \(d\d+\)$/ }).click();
	await expect(page.getByText('Damage', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mark XP', exact: true })).toHaveCount(0);
});
