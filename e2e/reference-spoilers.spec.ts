import { test, expect, type Page } from '@playwright/test';

/**
 * Commit 97: the reference GM gate became a reader opt-in preference
 * (`showSetting`). This covers the actual mechanic end to end — search finds
 * nothing gated by default, ticking the sidebar toggle reveals a Book II hit
 * live, and the preference persists across a reload (signed in, via the
 * server; signed out, via localStorage — see `preferences/client.ts`).
 *
 * The signed-in test exists because its absence hid a real bug: the server
 * layout load lacked `depends('reference:showSetting')`, so a signed-in
 * toggle saved fine but the invalidate re-derived from stale server data and
 * the checkbox snapped back (staging finding, 2026-07-17). Signed-out never
 * hits that path — localStorage is read in the universal load.
 *
 * "Should the players read this?" is a Book II (`visibility: 'gm'`) section
 * title with no match anywhere in Book I, so it's an unambiguous signal for
 * "the gated index is/isn't included."
 */

const GATED_QUERY = 'should the players read';
const GATED_TITLE = 'Should the players read this?';

async function search(page: Page, query: string) {
	await page.goto(`/stonetop/reference/search?q=${encodeURIComponent(query)}`);
}

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('signed-out reader opts into Book II spoilers on the search page', async ({ page }) => {
	await search(page, GATED_QUERY);

	// Wait for the search to actually run before asserting absence: the server
	// renders no result list at all (the index loads client-side), so the
	// count-0 check would pass vacuously against the SSR shell — and a click
	// on the checkbox that races hydration is silently undone when Svelte
	// claims the DOM. The results line only renders once the player index has
	// loaded and run, so its presence proves the page is live. This query hits
	// plenty of ungated Book I sections, so results are guaranteed.
	await expect(page.getByText(/\d+\+? results?/)).toBeVisible();

	// Scoped to the result list throughout: once the gate opens, the same
	// title also renders in the sidebar TOC (Book II joins the contents) and
	// in the hit's own breadcrumb — a page-wide getByText resolves to three.
	const results = page.getByRole('list', { name: 'Search results' });
	await expect(results.getByText(GATED_TITLE, { exact: true })).toHaveCount(0);

	await page.getByLabel(/Include Book II/i).check();
	await expect(results.getByText(GATED_TITLE, { exact: true })).toBeVisible();
	// The badge, on the gated hit itself — other Book II hits land in the
	// top-40 too, each with its own "Setting" badge, so scope to the one
	// list item this test is about.
	const gatedHit = results.getByRole('listitem').filter({ hasText: GATED_TITLE });
	await expect(gatedHit.getByText('Setting', { exact: true })).toBeVisible();

	// Persists across a reload — signed out, this round-trips through
	// localStorage rather than the server preferences table.
	await page.reload();
	await expect(page.getByLabel(/Include Book II/i)).toBeChecked();
	await expect(results.getByText(GATED_TITLE, { exact: true })).toBeVisible();

	// Opting back out drops the gated hit without a page reload.
	await page.getByLabel(/Include Book II/i).uncheck();
	await expect(results.getByText(GATED_TITLE, { exact: true })).toHaveCount(0);
});

test('a signed-in reader opts in from the TOC sidebar, and the choice sticks', async ({ page }) => {
	await signIn(page, 'E2E Spoilers', 'e2e-spoilers@localhost');

	// The toggle lives in the sidebar now — reachable from the contents page,
	// no search required (that was the staging discoverability finding).
	await page.goto('/stonetop/reference');
	const toc = page.getByRole('navigation', { name: 'Rules contents' });
	await expect(toc.getByText('Include Book II', { exact: false })).toBeVisible();
	await expect(toc.getByText(/Wider World/)).toHaveCount(0);

	// Tick it: Book II joins the contents live, and — the regression this test
	// exists for — the box STAYS ticked once the server round-trip completes.
	// Before the depends() fix the save landed but the invalidate re-derived
	// from stale data and unchecked the box a beat later.
	await page.getByLabel(/Include Book II/i).check();
	await expect(toc.getByText(/Wider World/).first()).toBeVisible();
	await expect(page.getByLabel(/Include Book II/i)).toBeChecked();

	// Signed in, the preference is a server row: a full reload agrees.
	await page.reload();
	await expect(page.getByLabel(/Include Book II/i)).toBeChecked();
	await expect(toc.getByText(/Wider World/).first()).toBeVisible();

	// And it unchecks — the symmetric half of the staging finding ("now won't
	// uncheck"): the same stale-derivation bug in the opposite direction.
	await page.getByLabel(/Include Book II/i).uncheck();
	await expect(toc.getByText(/Wider World/)).toHaveCount(0);
	await page.reload();
	await expect(page.getByLabel(/Include Book II/i)).not.toBeChecked();
});

test('toggling mid-search reruns the results live', async ({ page }) => {
	await search(page, GATED_QUERY);
	await expect(page.getByText(/\d+\+? results?/)).toBeVisible();
	const results = page.getByRole('list', { name: 'Search results' });
	await expect(results.getByText(GATED_TITLE, { exact: true })).toHaveCount(0);

	// The sidebar toggle is on the search page too (it's layout furniture);
	// ticking it re-derives the result list without touching the query.
	await page.getByLabel(/Include Book II/i).check();
	await expect(results.getByText(GATED_TITLE, { exact: true })).toBeVisible();
	await page.getByLabel(/Include Book II/i).uncheck();
	await expect(results.getByText(GATED_TITLE, { exact: true })).toHaveCount(0);
});

test('a gated section page shows the interstitial until opted in, then itself', async ({
	page
}) => {
	await page.goto('/stonetop/reference/02-the-village-of-stonetop--resources');

	// Gated and not yet opted in: the book's own "should the players read
	// this" passage stands in, with a button to opt in — not a flat 404.
	await expect(page.getByRole('heading', { name: GATED_TITLE })).toBeVisible();
	await page.getByRole('button', { name: /Include this/i }).click();

	// Same URL, now rendering the section the reader actually asked for.
	await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();
});
