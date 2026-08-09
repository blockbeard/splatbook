/**
 * UI-free reference layout constants for His Majesty the Worm.
 *
 * Split out of `index.ts` for the same reason `pack-schemas.ts` is: the build
 * tooling that expands the pack's document trees into per-page artifacts
 * (`tools/build_pages.ts`) needs the page depth, and runs under plain tsx,
 * which cannot load the `.svelte` components a full game module imports.
 *
 * The page depth decides which sections get their own file, so build and app
 * must agree on it exactly — hence one constant, imported by both, rather
 * than a number repeated in a tools config where it could drift.
 */

/**
 * Pages stop at h3: the book's h4/h5 sections are talent entries, spell
 * components, and statblock fragments — they read inline, not as pages.
 */
export const referencePageDepth = 3;
