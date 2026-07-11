// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { D1Database } from '@cloudflare/workers-types';
import type { Db } from '$lib/server/db/entities';

declare global {
	namespace App {
		interface Locals {
			/**
			 * This request's database, resolved in hooks.server.ts — D1 on Cloudflare,
			 * the SQLite file on node. Routes take it from here rather than importing a
			 * singleton, because on Workers there is no process to hold one.
			 */
			db: Db;
		}

		/**
		 * The Cloudflare Pages bindings, present only on that deployment. Declared
		 * optional because the node/atlas build has no platform at all.
		 */
		interface Platform {
			env?: {
				DB?: D1Database;
			};
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
