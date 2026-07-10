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
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
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
