// Auth.js installs `event.locals.auth()` and mounts the `/auth/*` endpoints
// (sign-in page, provider callbacks, sign-out) through this handle. Re-exported
// from the auth module per the @auth/sveltekit setup; wrap with `sequence` if
// the shell grows more hooks later.
export { handle } from '$lib/server/auth';
