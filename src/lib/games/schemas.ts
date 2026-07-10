/**
 * Pure pack-schema registration — the UI-free slice of game registration.
 *
 * Build tooling (`validate:packs`) runs under plain tsx, which cannot load
 * `.svelte` files, so it must not import `./index.ts` (game modules bundle
 * their sheet/wizard components). Importing this module instead registers
 * every game's pack schemas and nothing else.
 *
 * The app shell still goes through `./index.ts`; `registerGame` re-registers
 * the same resolvers, which the harness treats as a no-op replacement.
 *
 * When adding a game: register its schemas here AND its module in
 * `./index.ts`, with matching ids.
 */

import { registerPackSchemas } from '../packs/harness';
import { schemaFor as stonetopSchemas } from './stonetop/pack-schemas';

registerPackSchemas('stonetop', stonetopSchemas);
