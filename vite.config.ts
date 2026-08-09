/// <reference types="vitest/config" />
import nodeAdapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import type { Adapter } from '@sveltejs/kit';
import { defineConfig } from 'vite';

/**
 * Deployment target, chosen by the `ADAPTER` env var:
 *   ADAPTER=node        (default) → adapter-node, for the atlas/Docker deployment
 *   ADAPTER=cloudflare            → adapter-cloudflare, for Cloudflare Pages + D1
 *
 * The Cloudflare adapter is imported lazily (via a non-literal specifier, so
 * TypeScript doesn't require it to be installed) — local and CI builds run on the
 * node adapter and never touch it. Add it with
 * `npm i -D @sveltejs/adapter-cloudflare` before a Cloudflare build. The rest of
 * the go-live path (D1 database, the `DB` binding, migrations) is in
 * `docs/deployment.md`.
 */
async function chooseAdapter(): Promise<Adapter> {
	if (process.env.ADAPTER === 'cloudflare') {
		const specifier = '@sveltejs/adapter-cloudflare';
		const mod = (await import(specifier)) as { default: (opts?: unknown) => Adapter };
		return mod.default({
			/**
			 * `_routes.json` decides which paths reach the Worker at all; anything
			 * excluded is served straight from Pages' static store. Left to itself
			 * the adapter lists every static file individually, and Cloudflare caps
			 * the file at **100 rules** — so once phase 26 emitted ~4,500 page
			 * artifacts the adapter hit the cap and dropped 4,456 rules, which
			 * would have routed almost every static asset (every reference page
			 * among them) through the Worker as a function invocation. That is the
			 * per-request CPU cost phase 26 exists to remove, reintroduced by the
			 * deployment layer rather than the code.
			 *
			 * Directory wildcards instead: six rules that cannot grow with the
			 * content. `<build>` is the adapter's own placeholder for `/_app/*`.
			 * Keep this list in step with the top level of `static/`.
			 */
			routes: {
				include: ['/*'],
				exclude: [
					'<build>',
					'/content-packs/*',
					'/fonts/*',
					'/icons/*',
					'/robots.txt',
					'/favicon.*'
				]
			}
		});
	}
	return nodeAdapter();
}

export default defineConfig(async () => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: await chooseAdapter()
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
}));
