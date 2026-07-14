import { legacyRedirect } from '$lib/server/legacy-routes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = legacyRedirect('/:game/reference/:section');
