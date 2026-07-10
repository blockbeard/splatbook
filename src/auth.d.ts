// Augment the Auth.js session so `session.user.id` is typed everywhere. The
// value is populated by the token → session callback in `$lib/server/auth`.
// (@auth/sveltekit already augments App.Locals/App.PageData; we only add id.)
import type { DefaultSession } from '@auth/core/types';

declare module '@auth/core/types' {
	interface Session {
		user: { id: string } & DefaultSession['user'];
	}
}

export {};
