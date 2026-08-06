import { test, expect } from '@playwright/test';

/**
 * Embed mode (phase 22): `?embed=1` renders chrome-less for iframe embedding
 * (the Zoom Whiteboard reference reader). The attribute is stamped
 * server-side so the first paint never flashes the header, and the reference
 * search form carries a hidden `embed` input so a GET submit — which
 * SvelteKit intercepts and whose query string replaces the URL's — keeps the
 * param, letting a mid-session reload stay embedded.
 */

test('?embed=1 hides the app chrome, plain loads keep it', async ({ page }) => {
	await page.goto('/stonetop/reference');
	await expect(page.getByRole('banner')).toBeVisible();

	await page.goto('/stonetop/reference?embed=1');
	await expect(page.locator('html')).toHaveAttribute('data-embed', '1');
	await expect(page.getByRole('banner')).toBeHidden();
	await expect(page.getByRole('contentinfo')).toBeHidden();
	// The content itself still renders.
	await expect(page.getByRole('navigation', { name: 'Rules contents' })).toBeVisible();
});

test('a search submit in embed mode keeps ?embed=1 in the URL', async ({ page }) => {
	await page.goto('/stonetop/reference?embed=1');
	const box = page.getByLabel('Search the rules');
	await box.fill('clash');
	await box.press('Enter');

	await page.waitForURL(/\/stonetop\/reference\/search\?/);
	expect(page.url()).toContain('embed=1');
	expect(page.url()).toContain('q=clash');
	// Still chrome-less after the navigation, and — the real point of the
	// hidden input — after a full reload of the submitted URL.
	await expect(page.getByRole('banner')).toBeHidden();
	await page.reload();
	await expect(page.getByRole('banner')).toBeHidden();
});
