/**
 * Pack-schema registration, and the only place the schemas are loaded.
 *
 * Build tooling (`validate:packs`) runs under plain tsx, which cannot load
 * `.svelte` files, so it must not import `./index.ts` (game modules bundle
 * their sheet/wizard components). Importing this module instead registers
 * every game's pack schemas and nothing else.
 *
 * The app shell goes through `./index.ts`, which never loads the schemas:
 * building them cost a cold Worker about 20 ms of its 10 ms CPU budget on
 * every route (phase 33), and nothing at run time reads them. Packs are
 * validated here, at build and in CI, and the runtime trusts what passed.
 *
 * When adding a game: register its schemas here AND its module in
 * `./index.ts`, with matching ids.
 */

import { registerPackSchemas } from '../packs/harness';
import { schemaFor as hmtwSchemas } from './hmtw/pack-schemas';
import { schemaFor as stonetopSchemas } from './stonetop/pack-schemas';

registerPackSchemas('stonetop', stonetopSchemas);
registerPackSchemas('hmtw', hmtwSchemas);
