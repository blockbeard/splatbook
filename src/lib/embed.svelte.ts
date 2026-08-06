/**
 * Embed mode (phase 22): `?embed=1` renders the app chrome-less for iframe
 * embedding — the Zoom Whiteboard reference reader is the first consumer.
 *
 * The server stamps `data-embed="1"` on `<html>` (hooks.server.ts) so the
 * first paint never flashes the header; that attribute survives SPA
 * navigations on its own (SvelteKit doesn't re-render `<html>`). This store
 * is for anything that needs to *know* the mode after those navigations,
 * whose URLs drop the param — today the reference search form's hidden
 * `embed` input: SvelteKit intercepts that GET form but replaces the whole
 * query string with the form fields, so without the input every search
 * submit would drop the param and a mid-session reload would resurrect the
 * chrome.
 */

import { browser } from '$app/environment';

const active =
	browser &&
	(document.documentElement.dataset.embed === '1' ||
		new URLSearchParams(location.search).get('embed') === '1');

export const embed = {
	get active(): boolean {
		return active;
	}
};
