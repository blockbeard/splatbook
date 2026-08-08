import { test, expect } from '@playwright/test';

/**
 * The reference reader below the md breakpoint (phase 25): the sidebar is a
 * sticky bar plus a <dialog> drawer. Runs under the `mobile` project only — see
 * playwright.config.ts, which matches this file by name and gives it a phone
 * device descriptor (touch + mobile UA, not just a narrow viewport).
 *
 * The anchor-offset case is the one that earns its keep. A heading deeper than
 * the game's referencePageDepth has no page of its own: the route 302s to
 * `…/<page-ancestor>#<id>` and the browser scrolls to the fragment. With a
 * sticky bar and no scroll-margin, it lands *underneath* the bar — invisible,
 * with no error anywhere.
 */

const BAR = 'reference-bar';
const INLINE_SECTION = '04-chapter-4-kith-and-kin--underfolk-names';
const HOST_PAGE = '04-chapter-4-kith-and-kin--underfolk';

test('the sidebar is replaced by the bar, and the drawer carries the contents', async ({
	page
}) => {
	await page.goto('/hmtw/reference');

	await expect(page.getByTestId(BAR)).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Rules contents' })).toBeHidden();

	// Closed until asked for — and not merely hidden: its contents mount on first
	// open, so a second copy of the tree isn't sitting in every page's DOM.
	const drawer = page.getByRole('dialog', { name: 'Rules contents' });
	await expect(drawer).toBeHidden();

	await page
		.getByTestId(BAR)
		.getByRole('button', { name: /Contents/ })
		.click();
	await expect(drawer).toBeVisible();
	await expect(drawer.getByText('The Basics')).toBeVisible();
});

test('tapping an entry navigates and closes the drawer behind it', async ({ page }) => {
	await page.goto('/hmtw/reference');
	const drawer = page.getByRole('dialog', { name: 'Rules contents' });

	await page.getByTestId(BAR).getByRole('button').first().click();
	await expect(drawer).toBeVisible();

	await drawer.getByRole('link', { name: 'The Basics', exact: true }).first().click();
	await page.waitForURL(/01-chapter-1-the-basics/);
	// Without the afterNavigate close, the drawer sits over the page it just left.
	await expect(drawer).toBeHidden();

	// The bar's button now names where the reader is, so it orients while scrolled
	// (the section's own breadcrumb has scrolled away by then).
	await expect(page.getByTestId(BAR).getByRole('button', { name: /The Basics/ })).toBeVisible();
});

test('the drawer opens at the reader’s position, not at chapter one', async ({ page }) => {
	await page.goto(`/hmtw/reference/${HOST_PAGE}`);
	const drawer = page.getByRole('dialog', { name: 'Rules contents' });
	await page.getByTestId(BAR).getByRole('button').first().click();
	await expect(drawer).toBeVisible();

	// The active entry is marked, and its chapter's disclosure is open — in a
	// 17-note book a drawer that always opens collapsed at the top is barely an
	// improvement on scrolling the page.
	const current = drawer.locator('[aria-current="page"]');
	await expect(current).toHaveCount(1);
	await expect(current).toBeVisible();
});

test('a deep link to an inline heading lands below the bar, not under it', async ({ page }) => {
	// The 302-plus-fragment path, which is how every cross-reference to a
	// past-page-depth heading arrives.
	await page.goto(`/hmtw/reference/${INLINE_SECTION}`);
	await expect(page).toHaveURL(new RegExp(`${HOST_PAGE}#${INLINE_SECTION}$`));

	// Attribute selector, not `#id` — these ids start with a digit, which is not
	// a valid CSS identifier.
	const heading = page.locator(`[id="${INLINE_SECTION}"]`);
	await expect(heading).toBeVisible();

	const bar = await page.getByTestId(BAR).boundingBox();
	const target = await heading.boundingBox();
	expect(bar).not.toBeNull();
	expect(target).not.toBeNull();
	// Fully clear of the bar's lower edge: scroll-margin-top's whole job.
	expect(target!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
});

test('the bar searches as you type, without leaving the page', async ({ page }) => {
	await page.goto('/hmtw/reference');
	const panel = page.getByTestId('reference-search-panel');
	const box = page.getByTestId(BAR).getByLabel('Search the rules');

	// Closed until the reader taps the box — and opened on tap, not focus, so
	// tabbing or restored focus can't spring it.
	await expect(panel).toBeHidden();
	await box.click();
	await expect(panel).toBeVisible();

	await box.fill('meatgrinder');
	// No submit, no navigation: results arrive under the bar.
	await expect(panel.getByRole('list', { name: 'Search results' })).toBeVisible();
	await expect(panel.getByTestId('pinned-terms')).toBeVisible();
	expect(page.url()).not.toContain('q=');
	await expect(page).toHaveURL(/\/hmtw\/reference$/);

	// A hit is a real link out of the panel.
	await panel.getByRole('list', { name: 'Search results' }).getByRole('link').first().click();
	await page.waitForURL(/\/hmtw\/reference\/\S+/);
	await expect(panel).toBeHidden();
});

test('the panel carries the spoiler opt-in, and it re-derives the results', async ({ page }) => {
	await page.goto('/hmtw/reference');
	const panel = page.getByTestId('reference-search-panel');
	const box = page.getByTestId(BAR).getByLabel('Search the rules');
	await box.click();
	await box.fill('undead');

	const results = panel.getByRole('list', { name: 'Search results' });
	await expect(results).toBeVisible();
	// Gated chapters stay out until asked for.
	await expect(results.getByText(/Dungeon Denizens/)).toHaveCount(0);

	// The toggle lives with the query because it *is* the index selector.
	await panel.getByLabel(/Include the Gamemaster’s chapters/i).check();
	await expect(results.getByText(/Dungeon Denizens/).first()).toBeVisible();
});

test('escape and a tap outside both close the panel, without navigating', async ({ page }) => {
	await page.goto('/hmtw/reference');
	const panel = page.getByTestId('reference-search-panel');
	const box = page.getByTestId(BAR).getByLabel('Search the rules');

	await box.click();
	await box.fill('camp');
	await expect(panel).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(panel).toBeHidden();
	// Dismissing a dropdown is not a navigation.
	await expect(page).toHaveURL(/\/hmtw\/reference$/);

	// A tap on the page behind it closes it too — and unlike Escape (which a
	// `type="search"` field natively empties) it leaves the query alone, so
	// reopening resumes it. The state lives in the bar, not in the panel.
	await box.click();
	await box.fill('camp');
	await expect(panel).toBeVisible();
	await page.locator('main').click({ position: { x: 5, y: 400 } });
	await expect(panel).toBeHidden();

	await box.click();
	await expect(panel).toBeVisible();
	await expect(box).toHaveValue('camp');
});

test('embed mode keeps the bar, and its search submit keeps ?embed=1', async ({ page }) => {
	await page.goto('/hmtw/reference?embed=1');
	// `.app-chrome` is display:none in embed, so without the bar an embedded
	// reader has no navigation at all.
	await expect(page.getByRole('banner')).toBeHidden();
	await expect(page.getByTestId(BAR)).toBeVisible();

	const box = page.getByTestId(BAR).getByLabel('Search the rules');
	await box.fill('meatgrinder');
	await box.press('Enter');
	await page.waitForURL(/\/hmtw\/reference\/search\?/);
	expect(page.url()).toContain('embed=1');
});
