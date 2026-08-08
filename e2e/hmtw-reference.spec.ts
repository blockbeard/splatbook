import { test, expect, type Page } from '@playwright/test';

/**
 * Reader smoke for His Majesty the Worm (phase 22) — game #2, a rules
 * reference and nothing else. Covers the corpus-specific machinery Stage A
 * built: multi-H1 chapters with a real spine, nested-anchor links landing on
 * the right duplicate heading, curated pinned terms (including the one
 * external entry), the per-file GM gate with its pack-authored interstitial,
 * and the embed pass for the Zoom Whiteboard iframe.
 */

const GATED_CHAPTER = 'The Worm Turns';
const INTERSTITIAL = 'For the Gamemaster’s Eyes';
const TOGGLE = /Include the Gamemaster’s chapters/i;

/** The pinned-block entry label for a term, exactly (labels of *other* terms
 * and target links can contain the same word). */
function pinnedTerm(page: Page, term: string) {
	return page
		.getByTestId('pinned-terms')
		.locator('span.font-medium')
		.filter({ hasText: new RegExp(`^${term}$`) });
}

async function search(page: Page, query: string) {
	await page.goto(`/hmtw/reference/search?q=${encodeURIComponent(query)}`);
	await expect(page.getByText(/\d+\+? results?/)).toBeVisible();
}

test('the game landing speaks for the pack: logo, honest pitch, buy links, no builders', async ({
	page
}) => {
	await page.goto('/hmtw');
	await expect(page.getByAltText(/Adherent of His Majesty the Worm/)).toBeVisible();
	await expect(page.getByText(/Silver ENNIE/)).toBeVisible();
	// Reference-only: no create buttons, no campaigns offer.
	await expect(page.getByRole('link', { name: /Create a/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Campaigns' })).toHaveCount(0);
	// The two buy links, the DTRPG one carrying the affiliate id + disclosure.
	await expect(page.getByRole('link', { name: /hismajestytheworm\.games/ })).toHaveAttribute(
		'href',
		'https://www.hismajestytheworm.games/'
	);
	await expect(page.getByRole('link', { name: /PDF on DriveThruRPG/ })).toHaveAttribute(
		'href',
		/affiliate_id=1070389/
	);
	await expect(page.getByText(/costs you nothing extra/)).toBeVisible();
});

test('landing shows the book’s spine; a chapter opens and pages through', async ({ page }) => {
	await page.goto('/hmtw/reference');
	const toc = page.getByRole('navigation', { name: 'Rules contents' });
	await expect(toc.getByText('The Basics')).toBeVisible();

	// Chapter card → the chapter’s opening section.
	await page
		.getByRole('link', { name: /The Basics/ })
		.first()
		.click();
	await page.waitForURL(/01-chapter-1-the-basics/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	// The footer’s next link is a real <a> into the chapter’s spine.
	const nav = page.getByRole('navigation', { name: 'Section navigation' });
	await expect(nav.getByRole('link').last()).toHaveAttribute('href', /reference\//);
});

test('a nested-anchor cross-link lands on the third duplicate heading', async ({ page }) => {
	// Ch. 7’s player-side procedure links [[…#GMing the Challenge#1. Draw
	// Challenge cards]] — three sections share that title; the link must hit
	// the GM-scoped third one, not the first.
	await page.goto('/hmtw/reference/07-chapter-7-the-challenge-phase--1-draw-challenge-cards');
	const link = page
		.locator('.reference-body a')
		.filter({ hasText: 'Draw Challenge Cards' })
		.first();
	await expect(link).toHaveAttribute(
		'href',
		/07-chapter-7-the-challenge-phase--1-draw-challenge-cards-3$/
	);
});

test('search pins curated terms above the hits; the Tomb entry links out', async ({ page }) => {
	await search(page, 'meatgrinder');
	const pinned = page.getByTestId('pinned-terms');
	await expect(pinnedTerm(page, 'Meatgrinder')).toBeVisible();
	// Only the player-visible target: the term's Appendix E entries are GM
	// (the pack's split at work) and stay out until opt-in.
	await expect(pinned.getByRole('link', { name: 'Meatgrinder', exact: true })).toHaveAttribute(
		'href',
		/06-chapter-6-the-crawl-phase--meatgrinder/
	);
	await expect(pinned.getByRole('link', { name: 'Create the Meatgrinder' })).toHaveCount(0);

	await page.goto('/hmtw/reference/search?q=tomb');
	const tomb = page.getByTestId('pinned-terms').getByRole('link', { name: /Designing Dungeons/ });
	await expect(tomb).toHaveAttribute('href', 'https://dungeons.hismajestytheworm.games');
	await expect(tomb).toHaveAttribute('target', '_blank');
});

test('GM chapters stay dark until opted in, and the Index route lands on the interstitial', async ({
	page
}) => {
	await page.goto('/hmtw/reference');
	const toc = page.getByRole('navigation', { name: 'Rules contents' });

	// Absent from the sidebar and the landing’s chapter cards.
	await expect(toc.getByText(GATED_CHAPTER)).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Appendix C/ })).toHaveCount(0);

	// Absent from search — fuzzy hits and the GM-only pinned terms alike
	// (“Control Undead” is a player term and may pin; the bare GM term
	// “Undead” must not).
	await search(page, 'undead');
	const results = page.getByRole('list', { name: 'Search results' });
	await expect(results.getByText(/Dungeon Denizens/)).toHaveCount(0);
	await expect(pinnedTerm(page, 'Undead')).toHaveCount(0);

	// A link into chapter 10 from the book’s own Index lands on the
	// pack-authored interstitial, not a 404 — with the opt-in button doing
	// the deciding, on the same URL the reader asked for.
	await page.goto('/hmtw/reference/16-index--c');
	await page.locator('.reference-body a[href*="10-chapter-10"]').first().click();
	await expect(page.getByRole('heading', { name: INTERSTITIAL })).toBeVisible();
	await page.getByRole('button', { name: /Include this/i }).click();
	await expect(page.getByRole('heading', { name: INTERSTITIAL })).toHaveCount(0);

	// Opted in: the spine grows the GM chapters, search finds them, the GM
	// pinned term surfaces.
	await expect(toc.getByText(GATED_CHAPTER).first()).toBeVisible();
	await search(page, 'undead');
	await expect(pinnedTerm(page, 'Undead')).toBeVisible();

	// And back out again from the sidebar toggle.
	await page.getByLabel(TOGGLE).uncheck();
	await expect(toc.getByText(GATED_CHAPTER)).toHaveCount(0);
});

test('the embed pass: chrome-less reader, search submit keeps ?embed=1', async ({ page }) => {
	await page.goto('/hmtw/reference?embed=1');
	await expect(page.getByRole('banner')).toBeHidden();
	await expect(page.getByRole('contentinfo')).toBeHidden();
	const toc = page.getByRole('navigation', { name: 'Rules contents' });
	await expect(toc.getByText('The Basics')).toBeVisible();
	await expect(toc.getByText(GATED_CHAPTER)).toHaveCount(0);

	// The sidebar's box specifically — the reference bar below md has its own
	// (phase 25).
	const box = toc.getByLabel('Search the rules');
	await box.fill('meatgrinder');
	await box.press('Enter');
	await page.waitForURL(/\/hmtw\/reference\/search\?/);
	expect(page.url()).toContain('embed=1');
	await expect(page.getByRole('banner')).toBeHidden();
	await page.reload();
	await expect(page.getByRole('banner')).toBeHidden();
	await expect(pinnedTerm(page, 'Meatgrinder')).toBeVisible();
});
