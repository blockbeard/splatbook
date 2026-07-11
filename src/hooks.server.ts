import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { handle as auth } from '$lib/server/auth';

/** Game ids are kebab-case (registry.ts). Anything else never matches a theme,
 * and this value goes into an HTML attribute — so refuse to interpolate it. */
const GAME_ID = /^[a-z0-9-]+$/;

/**
 * Stamp `data-game` on <html> for a game's routes, server-side, so a module's
 * theme (scoped to `[data-game="<id>"]`, see app.css) is in force on the very
 * first paint rather than after hydration. `/g/[game]/+layout.svelte` keeps it
 * in step across client-side navigation.
 *
 * The id comes from the route param, not the registry: importing the registry
 * here would instantiate it in the hooks module graph as well as the page's,
 * and its registration side effect would run twice. An unknown game 404s and
 * matches no theme anyway.
 */
const gameTheme: Handle = async ({ event, resolve }) => {
	const game = event.params.game;
	if (!game || !GAME_ID.test(game)) return resolve(event);

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<html', `<html data-game="${game}"`)
	});
};

// Auth.js installs `event.locals.auth()` and mounts the `/auth/*` endpoints
// (sign-in page, provider callbacks, sign-out).
export const handle = sequence(auth, gameTheme);
