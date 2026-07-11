/**
 * The reference GM gate (phase 9, commit 62). Computes — server-side, from real
 * campaign-GM membership — whether the current viewer may see this game's GM-only
 * rules (Book II). The value is exposed to the universal reference loads through
 * `data`, replacing the phase-2 hardcoded flag with a permission.
 *
 * The gate is a display permission on top of the existing client-side reference
 * model (document trees are served statically and filtered in the browser); it
 * keys "can I see Book II" to "do I run a table for this game," which is the
 * useful, low-friction rule for a self-hosted tool. Hardening it to withhold
 * GM text at the network layer would mean server-rendered reference pages — a
 * later step, noted in docs/architecture.md.
 */

import { db } from '$lib/server/db';
import { isGmOfAnyCampaign } from '$lib/server/db/campaigns';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	const gmContentVisible = session?.user?.id
		? await isGmOfAnyCampaign(db, session.user.id, params.game)
		: false;
	return { gmContentVisible };
};
