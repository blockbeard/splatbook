# Mobile reference navigation: top bar, TOC drawer, search panel

**Status: built, 2026-08-08** — commits `feat(reference): a mobile shell` and
`feat(reference): the bar searches as you type`. Kept as the design record; the
"as built" notes at the end record where it diverged from the plan.

Scope was the reference reader below the `md` breakpoint. Desktop layout, the
right rail, and the content pipeline were out of scope and are untouched.

## What's wrong today

`src/routes/[game=game]/reference/+layout.svelte:64` is
`flex flex-col gap-8 md:flex-row`, so on a phone the **entire TOC renders above
the content in document flow**. In a long book that's a chapter list you scroll
past to reach the prose. Two symptoms, one cause:

- The sidebar is fine as a sidebar and wrong as a preamble.
- The search box (`+layout.svelte:78–97`) is `sticky top-0 … md:static`, so it
  sticks *within the `<nav>` element*. Scroll past the nav and its containing
  block is gone, so it stops floating — it only ever floats over the TOC, which
  is the one place you don't need it.

## Decisions already taken

Don't re-litigate these; they're Chris's calls.

1. Below `md`, the sidebar is replaced by a **persistent top bar**: burger,
   search input, and the current section's title.
2. The burger opens the **TOC as an overlay drawer**.
3. The **GM/spoiler toggle appears with the search surface** — it is the index
   selector, so it belongs to the query. A labelled copy also stays in the
   drawer; see "Why both" below.
4. **Live-as-you-type results.** This already exists; the work is reuse, not
   new behaviour (see below).
5. **Embed mode gets the bar too.** The embedded window is already narrow, and
   `.app-chrome` is hidden there, so the bar is the only chrome present.
6. **One breakpoint.** `md` governs sidebar-vs-drawer. Don't introduce a second.

## Groundwork — verified facts, measured 2026-08-08

These were all checked against the code, not assumed. They change the design,
so read them before writing markup.

**The shell header is not sticky.** `src/routes/+layout.svelte:70` is
`class="app-chrome border-b border-border bg-surface"` with no positioning, and
`.app-chrome` in `src/app.css` only ever sets `display: none !important` — under
`html[data-embed='1']` (line 60) and in print (line 94). So it scrolls away, one
sticky bar is the whole story, and **in embed mode there is no app header at
all**.

**Anchor landing is native fragment scrolling.** A heading deeper than
`referencePageDepth` has no page of its own: `[section]/+page.ts:59` issues a
`redirect(302, …/<pageAncestor>#<sectionId>)` and the browser scrolls to the
fragment on load. There is **no `scrollIntoView` or `scrollTo` anywhere in the
reference code** — verified by grep across `src/lib/reference/` and the reference
routes. Consequence: a sticky bar will hide anchor targets under itself, and the
complete fix is CSS `scroll-margin-top` on the anchored headings. No JS, no
duplicated bar-height constant.

**Where the anchor targets are.** `[section]/+page.ts:112–117` appends
`<h${level} id="${inline.id}">…` per inline descendant into `bodyHtml`, which
the page injects at `[section]/+page.svelte:60` via `{@html data.bodyHtml}`.
So the scroll-margin rule targets `[id]` headings inside that prose container.

**Live search already exists**, in `reference/search/+page.svelte`:

- `let query = $state(...)`, `bind:value` on the input (line 127), a 120 ms
  debounce effect (74–81), `const results = $derived(...)` (84–86). The `<form>`
  is `onsubmit={preventDefault}` (124) — nothing is ever submitted.
- The GM index loads only when `data.showSetting` is on and is **actively
  dropped when it flips off** (57–71), so results re-derive live on toggle. The
  comment at 22–26 already documents this as intended.
- Curated pinned index-terms render above the fuzzy hits (136+).
- `?q=` is kept in the URL by `replaceState` (90–112). **Read that comment
  before touching it** — it records two hard-won failures (`%20` vs `+` making
  href comparison lie, and `replaceState` during hydration wedging the client).

**Index weight, measured on this machine:**

| Artifact | Raw | Gzipped |
|---|---|---|
| `search-index.json` | 1.19 MB | 339 KB |
| `search-index-gm.json` | 1013 KB | 264 KB |
| `pinned-terms.json` | 51.5 KB | — |

`MiniSearch.loadJSON` on the player index: **18 ms** desktop. One query: **0.5 ms**.
So the parse is cheap even with a 5–10× mobile CPU penalty; **the cost is the
network fetch, not the main thread.**

**`loadSearchIndex` is not memoised.** `src/lib/reference/search.ts:32` fetches
and calls `MiniSearch.loadJSON` on every call. Compare `loadLinkIndex`
(`load.ts:72`), which memoises per game in a `Map`. A panel that can open on
every reference page needs the same treatment.

**The GM toggle's persistence.** `reference/SpoilerToggle.svelte` uses a
writable-`$derived` (flip locally for feedback, then `savePreference` and
`invalidate('reference:showSetting')` reconciles). Label and badge come from
`data.spoilers`. **Reuse the component; only its placement changes.**

**Embed mode.** `src/lib/embed.svelte.ts` exports `embed.active`. The hidden
`embed=1` field at `+layout.svelte:90–96` exists because SvelteKit replaces the
whole query string on a GET form submit, and losing it resurrects the app chrome
on a mid-session reload. Any fallback form must keep it.

## Design

### The bar

Inside the reference layout, not the shell:

```
<div class="sticky top-0 z-30 md:hidden …">   ← burger · search input · section title
```

`padding-top: env(safe-area-inset-top)` for notched devices. Fixed height,
exported as a CSS custom property (say `--reference-bar-h`) so the
scroll-margin rule below can reference the same value.

Do **not** hide-on-scroll-down in v1. It's the classic source of jank and a
48 px bar is cheap; add it later if it earns its keep.

### Anchor offset

```css
.reference-body :is(h2, h3, h4, h5, h6)[id] { scroll-margin-top: calc(var(--reference-bar-h) + env(safe-area-inset-top) + 0.5rem); }
```

Only below `md`, where the bar exists.

### The drawer

Native `<dialog>` + `showModal()`. Gives focus containment, a `::backdrop`, and
an inert background with no hand-rolled focus management — and there is no
existing dialog/drawer/sheet anywhere in the codebase, so there's no prior
pattern to stay consistent with. Animate with `@starting-style` +
`transition-behavior: allow-discrete`; size with `100dvh`, never `100vh`.

Three things make it feel finished rather than merely functional:

- **`afterNavigate` closes it.** Every TOC tap is a navigation; without this it
  reads as broken.
- **It opens where the reader is.** The tree already uses `<details>`/`<summary>`
  per h2 group (`+layout.svelte:113–125`): open the current section's group, mark
  the active entry `aria-current="page"`, and scroll it into view on open. In a
  17-note book, a drawer that always opens at chapter 1 is barely an improvement.
- **Do not set `overflow: hidden` on `<body>`.** `showModal()` already blocks
  background scroll, and freezing the body while a modal is open is a known cause
  of the dialog's own scroll container jamming on iOS, plus a scroll-position
  jump to the top on dismiss — which destroys the reader's place in a long
  chapter. If scroll-through leaks, use `overscroll-behavior: contain` on the
  dialog. **Verify on a real iOS device; Playwright will not catch this.**

### The search panel

Extract the body of `reference/search/+page.svelte` into a
`ReferenceSearch.svelte` used by **both** the search page and the panel, so
there is one implementation of debounce, index loading, merging, and the pinned
strip. Then:

- **The bar input and the panel input must be the same DOM element.** If the
  panel mounts its own input and moves focus into it, iOS dismisses and re-raises
  the soft keyboard — a visible flicker on every search. The panel expands
  *around* the input in place.
- **Open on `pointerdown`/`click`, not `focus`.** Focus fires on keyboard
  tabbing and on browser focus restoration, popping the panel unbidden.
- **Fetch the index on first open, memoised** (see the `loadSearchIndex` note).
  Render the pinned-terms strip immediately — it's already loaded and 51 KB — so
  a two-character query is useful while the index is still in flight.
- **URL ownership stays with the page.** The panel must not `replaceState`; give
  it a "See all results" link to `/reference/search?q=…` instead.
- **Keep the `<form action=…>` wrapper** so `Enter` navigates to the search page
  and the no-JS path still works — including the `embed=1` hidden field.

### Why the GM toggle lives in both places

In the panel because it selects which index is searched, and the existing code
already re-derives results the moment it flips. In the drawer because
`+layout.svelte:99–101` records a deliberate staging finding: the toggle has to
be reachable from the TOC, or a reader browsing the contents has no path to
Book II without incidentally searching first. Same component, same persisted
preference, two placements.

In the bar itself it would be one accidental tap from spoilers, which is why it
is not there.

## Commits

1. **Bar + drawer.** Extract the TOC into a component rendered twice (static
   `<aside class="hidden md:block">` and inside the `<dialog>`); add the bar,
   the scroll-margin rule, and the safe-area padding. Reviewable alone.
2. **Search panel.** Extract `ReferenceSearch.svelte`, memoise
   `loadSearchIndex`, wire the panel and the GM toggle into it.

## Tests

There is **no mobile Playwright project today** — `playwright.config.ts:27` is
`projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`, and no
spec in `e2e/` sets a viewport. So this work has to introduce mobile coverage:
either a second project (`devices['iPhone 14']`, which also gives touch and the
right UA) or `test.use({ viewport: … })` in the new spec. Prefer the project, so
later mobile work inherits it. Cases:

- Burger opens the drawer; tapping an entry navigates **and** the drawer closes.
- The drawer opens with the current section's group expanded and the active
  entry marked.
- Typing in the bar produces results with no submit; the pinned strip appears
  before the index has loaded.
- Deep-linking to an inline heading (`/reference/<page>#<inline-id>`) lands with
  the heading **visible below the bar**, not under it — this is the regression
  the 302-plus-fragment path invites.
- Embed mode (`?embed=1`): the bar is present, and a search submit preserves
  `embed=1`.
- Desktop viewport: sidebar and rail unchanged.

## As built — where it diverged from this plan

- **No section title as a third element in the bar.** It became the *label of the
  contents button* instead. One control, orientation while scrolled, and it
  leaves the search box the width it needs at 375 px. The section page still
  renders its own breadcrumb above the prose.
- **The mobile Playwright project is Chromium (`Pixel 5`), not `iPhone 14`.** The
  iPhone descriptors run WebKit, which CI doesn't install (`--with-deps
  chromium`) and which isn't Safari-on-iOS anyway. The iOS `<dialog>` traps still
  need a real device.
- **Both the drawer's contents and the panel mount lazily.** Not a nicety: a
  second copy of the tree, the spoiler toggle, and the results list sitting in
  every page's DOM makes "the toggle" and "the results" ambiguous to selectors
  and to assistive tech, on top of being desktop dead weight.
- **Two search inputs in the DOM is unavoidable.** The bar's box must be a
  sibling of the content for `sticky` to work at all (a box inside the short
  `<nav>` is the original bug), and the sidebar's must live in the nav. Two
  existing specs asked for "Search the rules" and now name the sidebar's
  explicitly.
- **`Escape` in the panel closes it *and* empties the box** — native
  `<input type="search">` behaviour, not something to fight. Query persistence
  across a close is therefore only guaranteed on the tap-outside path, which is
  how the spec tests it.
- **`aria-expanded` doesn't belong on the search input.** `svelte-check` rejects
  it on the implicit `searchbox` role; the panel isn't a combobox popup, so the
  attribute is simply gone rather than faked with combobox semantics.

## Corrections to the earlier review

Two cautions raised before the code was checked turned out to be weaker than
stated, and are recorded so nobody designs around them:

- **Manual scroll-offset maths is not a risk.** There is no `scrollIntoView` /
  `scrollTo` in the reference code at all; landing is native fragment scrolling,
  so `scroll-margin-top` alone is sufficient and there's no second source of
  truth for bar height.
- **The index parse is not a hang.** Measured at 18 ms desktop for 1.19 MB, so
  an idle-callback parse is unnecessary complexity. Optimise the *fetch*, not
  the parse.
