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
	// `:not(.heading-link)` since phase 27: headings are now links to their own
	// anchor, so a same-titled heading on this page would otherwise match first.
	const link = page
		.locator('.reference-body a:not(.heading-link)')
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

test('a stale deep link lands inside the book, with the contents and search intact', async ({
	page
}) => {
	// The pitch is "searchable, deep-linkable", and every heading is its own
	// page — so a link going stale when a heading is renamed is routine. Before
	// the reference grew its own +error.svelte this rendered as bare text on an
	// empty page: no contents, no search, no way back.
	const response = await page.goto('/hmtw/reference/01-chapter-1-the-basics--long-gone');
	expect(response?.status()).toBe(404);

	await expect(page.getByRole('heading', { name: /that section isn’t here/i })).toBeVisible();
	// The two recovery paths are already on screen, not described in prose.
	const toc = page.getByRole('navigation', { name: 'Rules contents' });
	await expect(toc.getByText('The Basics')).toBeVisible();
	await expect(toc.getByLabel('Search the rules')).toBeVisible();

	await page.getByRole('link', { name: 'Back to the contents' }).click();
	await page.waitForURL(/\/hmtw\/reference$/);
	await expect(page.getByRole('heading', { name: 'Rules reference' })).toBeVisible();
});

test('a chapter page with no rules on it reads as a contents page', async ({ page }) => {
	// "The Omphalic Market" is a lead-in and a list of what's inside — no rule
	// anywhere on it. It used to wear the same clothes as a page that answers a
	// question, so mid-session you couldn't tell whether you'd arrived or were
	// still navigating.
	await page.goto('/hmtw/reference/09-chapter-9-the-city-phase--the-omphalic-market');
	const children = page.locator('.section-children');
	await expect(children).toHaveClass(/reference-contents/);
	await expect(children.getByRole('link', { name: 'Buying new gear' })).toBeVisible();

	// A page that does carry rules keeps the footnote treatment.
	await page.goto('/hmtw/reference/01-chapter-1-the-basics--tests-of-fate');
	await expect(page.getByText('In this section')).toBeVisible();
	await expect(page.locator('.section-children')).not.toHaveClass(/reference-contents/);
});

test('front-matter sections that sit above the first h2 still reach the sidebar', async ({
	page
}) => {
	// Regression: the TOC nested h3s under the chapter's most recent h2 and
	// dropped any that came before the first one, so HMtW's Introduction
	// (h1 Introduction / h3 Credits / h3 Tarot / h3 Players / h3 The Game
	// Master / h2 Game Principles) lost four entries with nothing logged.
	await page.goto('/hmtw/reference/00-introduction');
	const toc = page.getByRole('navigation', { name: 'Rules contents' });
	for (const title of ['Credits', 'Tarot', 'Players', 'The Game Master']) {
		await expect(toc.getByRole('link', { name: title, exact: true })).toBeVisible();
	}
	// …as siblings of each other, not nested under the first of them, and the
	// real h2 keeps its own children.
	await expect(toc.getByRole('link', { name: 'Game Principles', exact: true })).toBeVisible();
	await expect(toc.getByRole('link', { name: 'Whimsy', exact: true })).toBeVisible();

	await toc.getByRole('link', { name: 'Tarot', exact: true }).click();
	await page.waitForURL(/00-introduction--tarot$/);
});

test('deep headings are links to their own anchor, quietly', async ({ page }) => {
	// Phase 27, the whole feature: h4+ headings render inline and their anchors
	// already worked, but there was no way to obtain one short of reading the
	// page source — and h4 is the granularity people quote.
	await page.goto(
		'/hmtw/reference/09-chapter-9-the-city-phase--an-incomplete-list-of-pretty-things'
	);
	const links = page.locator('.reference-body a.heading-link');
	await expect(links.first()).toBeVisible();
	expect(await links.count()).toBeGreaterThan(20);

	// The href is a fragment, so it resolves against the current page — which is
	// what makes right-click "Copy Link Address" yield the full deep link.
	const first = links.first();
	await expect(first).toHaveAttribute('href', /^#/);

	// Undecorated at rest: 52 permanently underlined headings would be worse
	// than the problem this solves.
	await expect(first).toHaveCSS('text-decoration-line', 'none');

	// Clicking puts the anchor in the address bar — the "get a good link" path.
	const href = await first.getAttribute('href');
	await first.click();
	await expect(page).toHaveURL(new RegExp(`${href!.replace('#', '#')}$`));
});
