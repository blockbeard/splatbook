import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 98 (opening Phase 14): one data-driven spec that builds a
 * golden-path character for every playbook in the pack and asserts the
 * sheet shows something unique to that playbook. The loop is the pack's own
 * playbook list — a tenth playbook lands in this coverage for free, and
 * every later commit in this phase (inserts, the tabbed sheet) is caught by
 * it if it breaks the base wizard-to-sheet path for any one playbook.
 *
 * The signature asserted per playbook is a *fixed starting move name* —
 * `CharacterSheet.svelte`'s Moves section renders `playbook.moves.starting.fixed`
 * unconditionally (no wizard interaction required), unlike fixed possessions,
 * which the sheet only renders once the player has picked at least one
 * optional item (`{#if possessions.length}`, keyed off chosen picks). Moves
 * are the interaction-free signal; the wizard flow otherwise just clicks
 * Next blindly, same as `smoke.spec.ts`.
 *
 * The Fox is the one playbook with no fixed starting moves — just two
 * `pickOne` groups — so its case clicks the first option of the first group
 * before continuing, and asserts that pick's name instead.
 */

type Golden = { id: string; name: string; signature: string };

const PLAYBOOKS: Golden[] = [
	{ id: 'the-blessed', name: 'The Blessed', signature: 'Call the Spirits' },
	{ id: 'the-fox', name: 'The Fox', signature: 'Ambush' },
	{ id: 'the-heavy', name: 'The Heavy', signature: 'Hard to Kill' },
	{ id: 'the-judge', name: 'The Judge', signature: 'Chronicler of Stonetop' },
	{ id: 'the-lightbearer', name: 'The Lightbearer', signature: 'Invoke the Sun God' },
	{ id: 'the-marshal', name: 'The Marshal', signature: 'Crew' },
	{ id: 'the-ranger', name: 'The Ranger', signature: 'Home on the Range' },
	{ id: 'the-seeker', name: 'The Seeker', signature: 'Well Versed' },
	{ id: 'the-would-be-hero', name: 'The Would-be Hero', signature: 'Potential for Greatness' }
];

/** Sign in through the dev-login provider as a named account. */
async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

for (const playbook of PLAYBOOKS) {
	test(`golden path: ${playbook.name}`, async ({ page }) => {
		await signIn(page, `E2E ${playbook.name}`, `e2e-${playbook.id}@localhost`);

		await page.goto('/stonetop/character/build');

		// The playbook grid: each card's name lives in its own leading span, so
		// filtering on that (rather than the whole button's accessible name,
		// which also includes flavor text) can't collide with another card's
		// flavor text happening to mention this playbook's name.
		await page
			.locator('button[aria-pressed]')
			.filter({ has: page.locator('span.text-lg.font-semibold', { hasText: playbook.name }) })
			.click();

		const next = page.getByRole('button', { name: 'Next', exact: true });

		// Background, instinct, appearance, origin, stats, to the Moves step —
		// no required picks block Next (see navigation.ts), so these are blind
		// like smoke.spec. 6 clicks: playbook (already selected) -> background
		// -> instinct -> appearance -> origin -> stats -> moves.
		for (let i = 0; i < 6; i++) await next.click();

		// Now viewing the Moves step. Only the Fox has no fixed starting moves
		// — its signature move has to be picked, not just granted.
		if (playbook.id === 'the-fox') {
			await page
				.locator('section', { hasText: 'Choose one' })
				.first()
				.locator('button[aria-pressed]')
				.first()
				.click();
		}
		await next.click(); // moves -> possessions

		// Possessions, extras, introductions, to review — blind again.
		for (let i = 0; i < 3; i++) await next.click();

		await page.getByRole('button', { name: 'Finish' }).click();

		await page.waitForURL(/\/stonetop\/character\/sheet\?id=/);
		const sheet = page.locator('article.character-sheet');
		await expect(sheet).toBeVisible();
		await expect(sheet.getByRole('heading', { name: playbook.signature, level: 3 })).toBeVisible();
	});
}
