import type { LayoutServerLoad } from './$types';

// Expose the session to every page as `data.session` so the header (and later
// the dashboard/save flow) can react to who's signed in. `locals.auth()` is
// installed by the Auth.js handle in hooks.server.ts.
export const load: LayoutServerLoad = async ({ locals }) => {
	return { session: await locals.auth() };
};
