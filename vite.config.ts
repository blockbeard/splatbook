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
		const mod = (await import(specifier)) as { default: () => Adapter };
		return mod.default();
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
