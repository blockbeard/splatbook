import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke config. The e2e specs live in `e2e/` (kept out of the vitest
 * `src/**` glob, so `npm test` stays unit-only and `npm run test:e2e` drives the
 * browser). The web server is the real production build against a throwaway,
 * freshly-migrated SQLite database (see `e2e/reset-db.ts`, run in the command
 * chain below — not globalSetup, which fires after the web server is already
 * up and holding the old database file open); serving over plain
 * http://localhost keeps Auth.js cookies non-secure so the dev-login flow
 * works headlessly.
 */

const PORT = 4173;

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			testIgnore: /mobile-.*\.spec\.ts/,
			use: { ...devices['Desktop Chrome'] }
		},
		// Phase 25: below the md breakpoint the reference reader is a different
		// shell — a sticky bar and a drawer instead of a sidebar. The device
		// descriptor brings touch and a mobile UA along with the viewport, so tap
		// paths behave as they do on a phone. Scoped by filename to the specs that
		// assert mobile behaviour; everything else stays desktop-only.
		//
		// Deliberately a Chromium device, not an iPhone one: the iPhone descriptors
		// run WebKit, which CI doesn't install (`--with-deps chromium`) and which
		// isn't Safari-on-iOS anyway — the iOS <dialog> scrolling traps this shell
		// has to avoid need a real device, not another engine. See
		// docs/mobile-reference-nav.md.
		{
			name: 'mobile',
			testMatch: /mobile-.*\.spec\.ts/,
			use: { ...devices['Pixel 5'] }
		}
	],
	webServer: {
		/**
		 * NOTE: `reuseExistingServer` means the whole chain — including the database
		 * reset — is skipped when a server is already listening on PORT. So CI always
		 * runs against a virgin database and a local re-run never does: rows pile up
		 * across runs until something trips over the second copy of its own fixture.
		 *
		 * A spec must therefore not assume an empty database. Scope locators to the
		 * entity the test just created (both campaign specs do this through the
		 * hidden `entityId` the attach form posts) rather than to "the first row" or
		 * "the button in that section". A test that only passes on the first run of
		 * the day is worse than a failing one — it reads as a product regression, and
		 * that is exactly how an hour went missing on 2026-08-11.
		 */
		command: 'npm run build && tsx e2e/reset-db.ts && node build/index.js',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			PORT: String(PORT),
			ORIGIN: `http://localhost:${PORT}`,
			AUTH_TRUST_HOST: 'true',
			AUTH_SECRET: 'e2e-secret-not-for-production',
			DATABASE_URL: 'e2e-test.db'
		}
	}
});
