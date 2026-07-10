// Database schema. Deliberately empty for now:
// - phase 4 adds `users` and `entities` (the generic one-JSON-blob-per-row model
//   with gameId / entityType / schemaVersion),
// - phase 9 adds `campaigns` and membership.
//
// Tables are defined with drizzle-orm/sqlite-core and pushed with `npm run db:push`
// (dev) or migrated with `npm run db:generate` (prod).

export {};
