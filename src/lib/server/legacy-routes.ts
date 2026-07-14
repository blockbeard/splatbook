/**
 * `/g/[game]/…` is the pre-commit-95 game route prefix, retired in favour of
 * games at the app's root (`/[game=game]/…`). The old tree's leaf routes
 * can't just disappear — shared links, bookmarks, and search results point at
 * them — so each keeps a `+page.server.ts` that does nothing but redirect
 * here, permanently, to its new address. One helper so that redirect is
 * written once: give it the new path with `:param` placeholders, and it fills
 * them from the route's own params and forwards the query string untouched.
 */

import { redirect } from '@sveltejs/kit';

/**
 * Build a `PageServerLoad` that 301s to `template`, a new-tree path with
 * `:param` placeholders for each of this route's own dynamic segments (e.g.
 * `:game`, `:section`) — filled from `event.params`, in `redirect(301, …)`
 * so browsers and search engines update their own links rather than
 * bookmarking the redirect forever.
 */
export function legacyRedirect(template: string) {
	return ({ params, url }: { params: Record<string, string>; url: URL }) => {
		const path = template.replace(/:(\w+)/g, (_, name: string) => params[name]);
		redirect(301, `${path}${url.search}`);
	};
}
