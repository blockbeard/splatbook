# Fomoria — module plan (draft)

*Drafted 2026-11-11 in a Markdown Extractions session, from a look at the Splatbook
working copy (last commit `043598f`, 9 September) and the Fomoria extraction. Status:
**draft, not reviewed.** The commit-by-commit sequencing goes in a "Fomoria
Implementation Plan" (or into [[App Implementation Plan]]) once the review below is
done. Items marked **settled** were decided with Chris; items marked **open** are
called out rather than guessed at.*

## 1. Identity

**Fomoria** (Tania Herrero and Johan Nohr, Free League Publishing, 2026), a
MÖRK BORG-derived game of Folk living in the strata beneath the earth. Slug
**`fomoria`**: `content/fomoria/` (but see §3: the content lives in a private repo),
`src/lib/games/fomoria/`, commit scope `fomoria`, served at `/fomoria`.

The module's job, in priority order: **character builder**, **play sheet**, then a
members-only **rules reference**.

**Licence position (settled 2026-11-11):**

- Fomoria is published "under the MÖRK BORG Third Party License" (credits, p5). That
  licence runs from MÖRK BORG's owners to Fomoria's publisher; it grants Splatbook
  nothing in Fomoria's own text.
- Fomoria's own third-party licence **isn't published yet**. Tania has said it will
  be on the same terms as MÖRK BORG's.
- MÖRK BORG's licence lets third parties publish compatible material but **reserves
  the official books' text and graphics**. If Fomoria's copies it, a public builder
  could ship its own engine and original content under the licence, but shipping the
  book's tables (folk, clans, traditions, gear, feats) would still need permission.
  **Open:** re-read the licence when it lands; check whether it releases any open
  content.
- So: **build now, keep it private, go public on licence or permission.** The
  module's shape follows from that: engine public, content private, and a switch
  that flips without a rewrite.
- **Open:** whether to ask Tania even for the private stage. A members-only site still
  shares the tables with the group. Players who own the book are the cleanest case.
- No art from the book, at any stage (same rule as Stonetop and HMtW).

## 2. Findings — the framework as it stands (read from the working copy)

- **Everything about a game is public today.** `blockbeard/splatbook` is a public
  repo, and content packs live in `static/content-packs/<game>/` and are read by
  plain `fetch` from `/content-packs/<game>/…` (`src/routes/[game=game]/+page.ts`,
  `src/routes/credits/+page.ts`). The search indexes (`search-index*.json`) and
  `link-index.json` sit beside them. Anyone with the URL reads the pack.
- **The game registry is visible to the browser.** `src/params/game.ts` matches any
  id in `listGames()`, and the front page and `/credits` iterate the registry.
  Hiding a game therefore needs a server-side answer to "may this user see it",
  not just a flag in client code. **Verify** where the registry is first evaluated
  (universal vs server load) before designing phase 1.
- **Sign-in is ready.** Auth.js with Google and Discord in production
  (`enabledProviderIds`, `src/lib/server/auth.ts`); `locals.auth()` in
  `hooks.server.ts`.
- **Invite links exist** for campaigns (tokenised link → join as player), a natural
  route for granting access to a private game.
- **Deploys run from Chris's Mac** (`ADAPTER=cloudflare npm run build`, then `wrangler
  pages deploy`), not from a GitHub build, so private content can be added at build
  time without ever reaching GitHub. CI (GitHub Actions) won't have it.
- Atlas staging (`ssh atlas 'cd ~/splatbook && docker compose up -d --build'`) is
  Chris's to run; sessions outside Network Log/Kairos are blocked from the fleet.

## 3. Privacy architecture

### 3.1 Private games (shell, game-agnostic)

1. **`visibility: 'public' | 'private'`** on the `GameModule` registration.
2. **`game_access` table** (`gameId`, `userId`, `grantedBy`, `grantedAt`, `via`),
   one Drizzle migration. Two ways in:
   - **invite link**: a per-game token (or reuse campaign invites: joining a
     campaign of a private game grants access to that game);
   - **Discord server membership** (**open**, nice for a Discord group): request the
     `guilds` scope at Discord login and grant access when the user is in a
     configured guild. Re-checked at each sign-in; costs one extra consent line.
   - Admin (Chris) can always see every game; a small `/admin` list of grants is
     enough.
3. **Gate in `hooks.server.ts`:** a request under `/fomoria` or
   `/content-packs/fomoria` from someone without access gets a 404, the same answer
   as an unknown game, so the game's existence isn't leaked.
4. **Hide from listings:** the front page, `/credits`, the dashboard's "create" offers
   and any cross-game search filter private games to members, server-side.
5. **Serve private packs from the server, not `static/`:** a `+server.ts` route
   streams pack files from a build-time bundle (or R2 — **open**, size decides; the
   pack is text, a few hundred kB) after the access check. `fetch` callers
   change only the URL prefix, through one `packUrl(game, path)` helper.
6. Responses for private games send `Cache-Control: private, no-store` and
   `X-Robots-Tag: noindex`.

**Optional extra lock:** Cloudflare Access (free to 50 users) on `splatbook.app/fomoria*`
and `/content-packs/fomoria*`, *and* on the `*.pages.dev` hosts, which otherwise
bypass it. Belt and braces only: the app-level gate is what survives the move to
public and works on atlas staging too.

This phase is useful beyond Fomoria (Laughter's draft content could ride on it), so it
lands first, tested against a **synthetic private pack** (`e2e` fixture game) rather
than real Fomoria data.

### 3.2 Where the Fomoria content lives

- **Private repo `blockbeard/splatbook-fomoria`** holding `content/` (authoring
  sources) and the built pack. Checked out beside Splatbook (or as a git submodule
  that CI doesn't fetch, **open**).
- **Public repo** gets the engine (`src/lib/games/fomoria/`), the pack **schemas**,
  and a tiny made-up fixture pack for tests and CI. The house rule that no game text
  lives in code is what makes this split safe.
- The production build reads the private checkout through an env var
  (`SPLATBOOK_PRIVATE_PACKS=…`); without it, the game registers with its fixture pack
  in dev and doesn't register at all in a production build. A build that would ship
  the fixture to production fails loudly.
- `.gitignore` the private pack's mount point in the public repo, and add a pre-push
  check that no `content-packs/fomoria/` file is tracked.

## 4. Content pipeline

Source of truth: the **Markdown Extractions** vault,
`~/RPG Vaults/Markdown Extractions/Fomoria/Fomoria/` (the full 308-page book,
extracted 11 November 2026, book page = PDF page, `%% pNN %%` markers). It is a
read-only source here, like the HMtW vault: Splatbook-only fixes live in the
private repo's config, not in the vault.

What the builder needs, by note (all in `03 Carving Your Name/` unless noted):

| Data | Note | Shape |
|---|---|---|
| Folk (d8): Morvarg, Elkrin, Plattenkan, Corax, Valiskar, Myorryn, Raumm, Chiros | `01 Creating a Character` | HP die, SP die, folk feat(s), descriptions, tables |
| Clans | `02 The Clans` | roll table + clan features |
| Ability modifiers | `02 Behind the Veil/02 Playing by the Rules` (p54) | score → modifier table |
| Starting gear | `03 Gearing Up` | keyed roll tables (already tables in the notes) |
| Tamed beasts, artifacts, hirelings | `04`–`06` | lists / tables |
| Folk feats | `07 Folk Feats` | 25 named feats |
| Weapon expertise | `08 Weapon Expertise` | list |
| Optional rules (Threads of Fate…) | `09 Optional Rules` (p124) | toggles, as campaign settings |
| Traditions (Graceful Nightingale, Dauntless Pathfinder, Tragic Talewright, Forlorn Earthbound, False Star Gazer…) | `10 Traditions` (p131) | abilities, gear (d6), special, skills, Thread die |
| Eldritch boons (Elemental / Temperamental / Primal, d6) | `02 Behind the Veil/07 Eldritch Boons` (p66) | three tables |
| Conditions, maladies | `02 Behind the Veil/05`, `06` | for the play sheet |
| Pregenerated folk (8) | `06 Pregenerated Folk/` | **golden test fixtures** |

Tooling: a `tools/build_fomoria.py` (in the private repo, or public with no data
baked in) that reads the notes' headings and markdown tables into pack JSON, then
`validate:packs` against the public schemas. Hand-authored corrections go in a
config, so a re-extraction of the book re-runs cleanly. The extraction's
`baseline - Fomoria.json` (`pdf_diff.py`) tells us which notes changed when a
revised PDF lands.

## 5. Character creation (the engine)

From the Quick Guide (`01 Creating a Character`):

1. Roll or choose **Folk** (d8).
2. Roll or choose **Clan**.
3. **Abilities:** 4d6 drop lowest for two abilities and 3d6 for the rest, **or** 3d6
   for each if the character takes a **Tradition**. Write the modifier from the p54
   table. **Open:** confirm the exact reading of "for two abilities" against p54 and
   the pregens before coding it.
4. **HP** = Toughness ± the Folk's HP die. **SP** (Stability) = Occult ± the Folk's
   SP die. **Wyrd** = Occult (minimum 1).
5. **Threads of Fate** (optional rule): d2, or the Tradition's Thread die.
6. Roll **starting gear**.
7. One extra **Folk Feat** or one starting **Boon**; the boon's nature by d6
   (1–2 Elemental, 3–4 Temperamental, 5–6 Primal).

Engine rules: pure TS, seeded dice so a roll can be replayed, every step either
rolled or chosen (the book says "roll or choose" throughout). The optional rules are
campaign settings (`campaignSettingsFields`), the same mechanism Laughter's
optional-rules checklist uses. `migrateCharacter` and `SCHEMA_VERSION` from the
first saved draft (house rule).

**Tests:** each of the 8 pregens must be reachable by the engine (every value legal
for its folk, clan and tradition); the HP/SP/Wyrd derivations checked against them.

## 6. Builder and play sheet

- **Builder:** the shell wizard, one step per Quick Guide line, with the
  choices-so-far rail Stonetop has. Every table shows its die and offers Roll or
  Choose.
- **Play sheet:** abilities and modifiers, HP, SP, Wyrd, Threads, Renown
  (`02 Behind the Veil/04 Earning Renown`), conditions and maladies, inventory with
  carrying capacity, boons, feats. Rolls from the sheet through the shared dice
  panel and the campaign roll log.
- **PDF:** the product ships a fillable character sheet (library `extras/`). Filling
  *that* PDF from a character would be the ideal export, but it's Free League's
  file: export only to the user's own copy (upload, fill, download) or produce
  Splatbook's own sheet. **Open.**
- Look: MÖRK BORG-family games are graphic-design-led; Splatbook's own theme with a
  nod to the book's palette, no copied layout or fonts unless licensed.

## 7. Rules reference (later, optional)

The rules chapters through the existing reference engine, members only.
`04 What Dwells Below` and `05 Spawn of the Hungering One` behind the per-game GM
opt-in HMtW already has. Lower priority than the builder; it's the part that copies
the most text, so it waits on the licence answer more than anything else.

## 8. Phasing

| Phase | Work | Done when |
|---|---|---|
| 0 | Review this plan; the open questions in §1 and §3 | decisions recorded here |
| 1 | Private games in the shell (§3.1), against a synthetic fixture game | an e2e test proves a non-member gets 404s for pages, packs and listings, a member sees everything, invite and (if chosen) Discord grants work; staging soak on atlas |
| 2 | Private repo and pack pipeline (§3.2, §4) | `validate:packs` green on the real pack locally; CI green on the fixture |
| 3 | Engine (§5) | the 8 pregens pass; property tests over seeded rolls |
| 4 | Builder and play sheet (§6) | a character built, saved, played in a campaign with the roll log |
| 5 | Reference (§7), if wanted | members-only, GM opt-in |
| 6 | Going public | licence published or permission given: `visibility: 'public'`, licence notice in the pack's `LICENSE.md` and README, pack moved to (or copied into) the public pack path, Discord/invite gating left in place for other private games |

## 9. What will fight this (blunt list)

- **Leaks through the side doors:** search indexes, `link-index.json`, the credits
  page, OpenGraph previews, service-worker precache (if the PWA work lands), error
  pages that echo a path. Phase 1's e2e test should crawl as a non-member and grep
  for any Fomoria string.
- **Universal loads:** anything fetched in a `+page.ts` runs in the browser too, so
  gating has to happen on the server route the fetch hits, not in the load.
- **The licence may say less than hoped.** If Fomoria's licence keeps the book's
  tables reserved, phase 6 becomes "ask Tania" rather than "flip the switch". The
  private stage is useful either way.
- **Revised PDFs.** Free League and indie MÖRK BORG games revise often; the pipeline
  must re-run from the vault and the pregen tests catch rule changes.
- **Pages.dev hosts** bypass anything set only on `splatbook.app`.
