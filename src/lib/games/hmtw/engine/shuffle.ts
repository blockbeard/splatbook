/**
 * Deterministic shuffling for the card table.
 *
 * Pure: no `Math.random` anywhere in this module. The caller supplies a seed,
 * which makes every shuffle reproducible in a test and — more importantly —
 * makes the deck order a thing the *server* owns rather than something a client
 * could derive.
 *
 * **The seed is secret.** It must never appear in a command payload, a
 * projection, or anything else a client can read: possessing it is equivalent
 * to possessing the order of the undrawn deck. The command that shuffles
 * carries no payload at all — it bumps a version and nothing more.
 */

/** A source of randomness returning a float in `[0, 1)`, matching `$lib/dice`. */
export type Rng = () => number;

/**
 * Mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * Chosen over anything cryptographic because this randomises a card order for a
 * game of five people, not a key. What it must be is *deterministic for a given
 * seed*, so a test can assert an exact deal, and it is.
 */
export function seededRng(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Fisher–Yates, returning a new array — the input is never mutated, because
 * every operation in this engine returns a new value rather than editing one.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
