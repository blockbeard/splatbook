/**
 * Site-operator support links for this deployment (splatbook.app).
 *
 * These are neither game content (they belong in no pack) nor framework identity
 * — they're the specific operator's tip jar and affiliate link. Kept in one place
 * so another deployment of the framework can swap or empty them without touching
 * the credits page. The credits page renders whatever is set here; an empty
 * `href` hides that option.
 */

/**
 * Where users reach the operator — the contact required by the privacy policy
 * and by Google's OAuth consent screen. A domain alias rather than a personal
 * mailbox, so it can be redirected (or burned) without editing the site.
 */
export const CONTACT_EMAIL = 'hello@splatbook.app';

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
