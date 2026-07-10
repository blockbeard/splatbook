/**
 * Site-operator support links for this deployment (Ringwall / splatbook.app).
 *
 * These are neither game content (they belong in no pack) nor framework identity
 * — they're the specific operator's tip jar and affiliate link. Kept in one place
 * so another deployment of the framework can swap or empty them without touching
 * the credits page. The credits page renders whatever is set here; an empty
 * `href` hides that option.
 */

/** "Buy me a coffee" tip jar. */
export const KOFI_URL = 'https://ko-fi.com/miniblin';

/**
 * DriveThruRPG affiliate storefront. Any DriveThruRPG URL carrying this
 * `affiliate_id` credits the operator up to 5% of purchases a visitor makes
 * within 15 days — at no extra cost to the buyer, and creators are paid in full.
 * Stonetop itself isn't sold on DriveThruRPG, so this is a general "shop
 * DriveThruRPG" link rather than a Stonetop product link.
 */
export const DRIVETHRU_AFFILIATE_URL =
	'https://www.drivethrurpg.com/browse.php?affiliate_id=1070389';
