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
 *
 * Commit 106 closes the loop this spec was written to catch: it extends the
 * five playbooks with a class insert (`insertTab`) to also visit the play
 * sheet and check the insert's tab actually attached at creation, rather
 * than waiting for a reload to trigger `migrateCharacter`'s old v2→v3 path.
 * Lightbearer and Marshal need no extra wizard interaction (their rule keys
 * off playbookId alone); Blessed needs the Initiate background explicitly
 * picked (only that background carries the Initiates of Danu insert);
 * Ranger needs the Animal Companion move explicitly picked in the Moves
 * step (an optional pick — not every Ranger takes it, so the rule keys off
 * the held move, not the playbook); Seeker needs a background with an
 * "arcanum" choice (all three of its backgrounds have one) and one arcanum
 * option picked, which seeds an Arcana card named after that pick.
 */

type Golden = {
	id: string;
	name: string;
	signature: string;
	/** Tab label expected to auto-attach on the play sheet (commit 106). */
	insertTab?: string;
};

const PLAYBOOKS: Golden[] = [
	{ id: 'the-blessed', name: 'The Blessed', signature: 'Call the Spirits', insertTab: 'Initiates' },
	{ id: 'the-fox', name: 'The Fox', signature: 'Ambush' },
	{ id: 'the-heavy', name: 'The Heavy', signature: 'Hard to Kill' },
	{ id: 'the-judge', name: 'The Judge', signature: 'Chronicler of Stonetop' },
	{
		id: 'the-lightbearer',
		name: 'The Lightbearer',
		signature: 'Invoke the Sun God',
		insertTab: 'Invocations'
	},
	{ id: 'the-marshal', name: 'The Marshal', signature: 'Crew', insertTab: 'Crew' },
	{
		id: 'the-ranger',
		name: 'The Ranger',
		signature: 'Home on the Range',
		insertTab: 'Companion'
	},
	{ id: 'the-seeker', name: 'The Seeker', signature: 'Well Versed', insertTab: 'Arcana' },
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

/** Click an OptionButton/playbook-card style button by its leading name span,
 *  never by its full accessible name (which also folds in flavor text and
 *  could collide with another card's blurb mentioning this one's name). */
function optionButton(page: Page, name: string) {
	return page
		.locator('button[aria-pressed]')
		.filter({ has: page.locator('span.text-lg.font-semibold', { hasText: name }) });
}

for (const playbook of PLAYBOOKS) {
	test(`golden path: ${playbook.name}`, async ({ page }) => {
		await signIn(page, `E2E ${playbook.name}`, `e2e-${playbook.id}@localhost`);

		await page.goto('/stonetop/character/build');

		await optionButton(page, playbook.name).click();

		const next = page.getByRole('button', { name: 'Next', exact: true });

		await next.click(); // playbook -> background

		// Background: blind, except Blessed (needs Initiate for its insert) and
		// Seeker (needs a background with an arcanum pick, for its seeded card).
		if (playbook.id === 'the-blessed') {
			await optionButton(page, 'Initiate').click();
		} else if (playbook.id === 'the-seeker') {
			await optionButton(page, 'Patriot').click();
			await page.getByRole('button', { name: /Staff of the Lidless Orb/ }).click();
		}

		await next.click(); // background -> instinct

		// Instinct, appearance, origin, stats, to the Moves step — no required
		// picks block Next (see navigation.ts), so these are blind like smoke.spec.
		for (let i = 0; i < 4; i++) await next.click();

		// Now viewing the Moves step. Only the Fox has no fixed starting moves
		// — its signature move has to be picked, not just granted. The Ranger's
		// Animal Companion is an optional free pick, not a guaranteed grant.
		if (playbook.id === 'the-fox') {
			await page
				.locator('section', { hasText: 'Choose one' })
				.first()
				.locator('button[aria-pressed]')
				.first()
				.click();
		} else if (playbook.id === 'the-ranger') {
			// Anchored: a second, disabled option ("Magnificent Specimen requires
			// Animal Companion") also matches an unanchored /Animal Companion/,
			// since its own description names this move as a prerequisite.
			await page.getByRole('button', { name: /^Animal Companion/ }).click();
		}
		await next.click(); // moves -> possessions

		// The Marshal's auto-attach (commit 106) fetches insert-crew.json from
		// the Extras step to seed the right number of write-in lines — wait for
		// it to land before racing ahead, or the attach can lose to Finish.
		// The listener has to be registered before the click that navigates to
		// Extras, not after: the fetch can complete before an after-the-fact
		// `waitForResponse` ever attaches, especially under load, and a response
		// that already happened is invisible to it (it only sees future ones).
		if (playbook.id === 'the-marshal') {
			await Promise.all([
				page.waitForResponse((res) => res.url().includes('insert-crew.json')),
				next.click() // possessions -> extras
			]);
		} else {
			await next.click(); // possessions -> extras
		}

		// Introductions, to review — blind again.
		for (let i = 0; i < 2; i++) await next.click();

		await page.getByRole('button', { name: 'Finish' }).click();

		await page.waitForURL(/\/stonetop\/character\/sheet\?id=/);
		const sheet = page.locator('article.character-sheet');
		await expect(sheet).toBeVisible();
		await expect(sheet.getByRole('heading', { name: playbook.signature, level: 3 })).toBeVisible();

		if (playbook.insertTab) {
			const id = new URL(page.url()).searchParams.get('id');
			await page.goto(`/stonetop/character/play?id=${id}`);
			const tab = page.getByRole('button', { name: playbook.insertTab, exact: true });
			await expect(tab).toBeVisible();

			if (playbook.id === 'the-seeker') {
				await tab.click();
				await expect(page.getByPlaceholder('Name')).toHaveValue(/Staff of the Lidless Orb/);
			}
		}
	});
}
