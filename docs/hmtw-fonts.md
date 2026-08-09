# HMtW web-font license audit (phase 22, Stage C)

Audited 2026-08-07 against the creator pack — `Downloads and AddOns/Adherent
of the Worm Template/` in the HMtW vault. Font roles read from the `.idml`'s
paragraph styles (which also settles the face the plan couldn't name: the big
lombardic chapter titles are **Xiparos Lombard**, with **IM Fell Great Primer
SC** for chapter numbers); license verdicts from each shipped font file's
embedded name table, the license files in the folder, and the sources listed
at the bottom.

The bar is **`@font-face` self-hosting on splatbook.app** — that is
*redistribution of the font file*, a stronger ask than the template's
InDesign use. "Free font" download sites' own labels (1001fonts "FFC" etc.)
are site-applied, not author grants, and don't clear that bar.

## Verdicts by role

| Role (from the `.idml`) | Book face | Verdict | Web substitute (all OFL/PD, on `@fontsource/*`) |
| --- | --- | --- | --- |
| Chapter titles, 85/45pt lombardic caps | Xiparos Lombard (Pia Frauss 2005) | ❌ "for private use only"; commercial use needs permission | **IM Fell Great Primer SC** — see "Chapter titles, revisited" below. Was Uncial Antiqua until 2026-08-09 |
| Chapter numbers, running footers | IM Fell Great Primer SC (Igino Marini) | ✅ **OFL** (`OFL.txt` ships in the folder) | use as-is |
| H1 40pt / H2 28pt caps / H3 18pt, folio | HamletOrNot (Manfred Klein & Petra Heidorn 2004, after Johnston's Hamlet type for the Cranach Presse) | ❌ free incl. commercial *use*, but "can not be included in any compilation … or products … unless prior permission granted" — self-hosting is exactly that | **IM Fell English SC** — keeps the headings inside the book's own Fell palette |
| H4 16pt bold, table headers | Caslon Antique Bold ("Typographer Mediengestaltung" = Dieter Steffmann 2000) | ❌ non-commercial only, and Fedora rejected the whole Steffmann corpus over provenance of the originals | **Libre Caslon Text Bold** — right family, already self-hosted for stonetop |
| Chapter-intro paragraphs, 13.5pt | BilboDisplay (WSI/IMSI 1993–96) | ❌ commercial data, "Redistribution strictly prohibited" in the name table | **IM Fell English Italic** — already in the palette |
| Body 10.5pt, boxout headers, table body, quote attributions | IM Fell English roman + italic | ✅ **OFL** (already a repo dependency) | use as-is |
| Sidebar body 9.5pt | Goudy Old Style (`GOUDOS.TTF`, URW data © Microsoft) | ❌ Windows system font, commercial | **Sorts Mill Goudy** — the OFL Goudy revival (the plan's own example) |
| Sidebar headers 14pt | KelmscottRoman (Nick Curtis 2000, after Morris's Golden Type) | ⚠️ file says All Rights Reserved; only aggregator-applied "free for commercial use" labels exist | **IM Fell English SC** — Chris's vault styles sidebars in HamletOrNot, so the app follows the vault, not the .idml, here |
| Pull quotes 36pt | Dark Roast (Brittney Murphy 2013) | ❌ free version is personal-use only; a real **webfont license is purchasable on Fontspring** if authenticity is wanted | **Almendra Display** — quirky medieval display, fits the book |

## Faces in the folder that need no decision

- **Rakkas** (OFL) — in `Document fonts/` but used nowhere in the template's
  text. Ignore.
- **Britannia** (woodcutter.es) and **Minion Pro** (Adobe, InDesign default) —
  likewise unused in any paragraph/character style.
- **`Parasite-K7Zrp.ttf`** — its name table carries *"HTF Gotham Copr. 2000
  The Hoefler Type Foundry"*: renamed commercial font data. Unused in the
  template text. Do not touch, do not ship, do not keep copies.

## Chapter titles, revisited (2026-08-09)

The h1 role no longer names a local face, and no longer uses Uncial Antiqua.
Both changes came out of the same finding.

A design review run headless **on Chris's own machine** reported the chapter
titles colliding with the breadcrumb above them and the rule below — and they
did, in `XiparosLombard`, whose swashes overshoot the em box in both
directions. But nobody else could see it: with the creator pack absent the
stack fell through to Uncial Antiqua, which sits cleanly between the two. The
local-first stack had produced a rendering with an audience of one — and,
since Safari blocks local font matching entirely, an audience of one on two of
three browsers. The defect was invisible to its only reviewer for the same
reason the "true book" was invisible to everyone else.

So the display roles now serve one face to all readers. Body prose keeps its
local-first path: Fell is Fell, the substitute is the same design, and no
review depends on seeing it.

The replacement is **IM Fell Great Primer SC**, not Uncial Antiqua:

- It is the same family as the body text at a larger optical size. Great
  Primer is Fell's display cut; going up an optical size is how a Fell book
  sets a chapter title, rather than switching families.
- Small caps scan faster than uncial mixed case, and Uncial's `R` and `T` are
  unfamiliar forms. An h1 in a lookup tool answers "am I in the right place"
  before the reader has finished looking.
- It already ships for table heads and callout labels, so
  `@fontsource/uncial-antiqua` came out of `package.json` for no payload cost.
- It stays distinct from the h2/h3 role (IM Fell English SC) because it is a
  different cut, not the same face enlarged.

The cost is the illuminated-chapter-opener character, which now comes from
scale, the ink rule and letterspacing instead of from the letterforms. The
optional authentic-faces path below is unaffected — but note that taking it
for the h1 would reintroduce exactly the review blindness described above.

## Local-first stacks

Every substituted rule in `theme.css` lists the *authentic* face first by
its installed family name (`'HamletOrNot', 'IM Fell English SC', …`). Naming
a family distributes nothing — it engages only fonts the visitor already
has installed — so a machine with the creator-pack fonts in its system
library renders the true book, and everyone else falls back to the shipped
OFL set. Note the fonts must be **installed** (Font Book), not just loaded
by an Obsidian snippet's file-path `@font-face`, for a browser to see them.

## The authentic-faces path (optional, later)

Substitution ships without asking anyone. If Chris wants the real faces on
the web later:

- **Xiparos Lombard**: Pia Frauss invites permission mail —
  `fonts@pia-frauss.de`.
- **Dark Roast**: buy the webfont license on Fontspring (Brittney Murphy
  Design).
- **HamletOrNot / Caslon Antique / Kelmscott Roman**: freeware-era files with
  no reachable grant for redistribution — not worth chasing; the substitutes
  are close.

Net for the theme commit: **install `@fontsource/im-fell-great-primer-sc`,
`@fontsource/im-fell-english-sc`, `@fontsource/sorts-mill-goudy`,
`@fontsource/goudy-bookletter-1911`** (all verified present at v5.3.0), reuse the
existing IM Fell English and Libre Caslon Text, and self-host nothing from
the template folder. Fontsource packages are self-hosted npm builds, so
nothing depends on a third-party CDN — same policy as stonetop.

Sources: the template's own font files and license texts;
[Fedora's Steffmann fonts audit](https://fedoraproject.org/wiki/Dieter_Steffmann_fonts);
[Luc Devroye on Manfred Klein's license](https://luc.devroye.org/fonts-103734.html);
[Dark Roast on Fontspring](https://www.fontspring.com/fonts/brittneymurphydesign/dark-roast) and
[Brittney Murphy Design](https://www.brittneymurphydesign.com/downloads/dark-roast-font/);
[Kelmscott Roman NF on 1001fonts](https://www.1001fonts.com/kelmscottroman-font.html);
[Caslon Antique (Wikipedia)](https://en.wikipedia.org/wiki/Caslon_Antique).

## Two paths, one set of sizes (2026-08-08)

Every stack names the creator-pack face first, so the theme renders one of two
ways depending on what the reader has installed — and only the substitute path
had ever been looked at, because the machine doing the design work has the
fonts. Measured in-browser at 100px:

| role | authentic | x-height | substitute | x-height |
| --- | --- | --- | --- | --- |
| h4 subhead | Caslon Antique | 35.9 | Libre Caslon Text 700 | 46.0 |
| epigraph | Dark Roast | 17.6 | Almendra Display | 44.9 |
| h2 / h3 | HamletOrNot | 52.8 | IM Fell English SC | 44.9 |
| h1 chapter | XiparosLombard | 38.3 (cap 116) | Uncial Antiqua | 44.9 (cap 66) |
| sidebar body | Goudy Old Style | 39.9 | Sorts Mill Goudy | 42.5 |

Sizes tuned against the right-hand column therefore came out wrong on the
left: subheads read *smaller* than the body they head, and epigraphs — Dark
Roast being barely a third of Almendra's x-height — became unreadable
hairlines. Fixed with `size-adjust` on local-only `@font-face` declarations
(`HMTW Subhead` 128%, `HMTW Epigraph` 175%), which scales the authentic
outlines to the substitute's proportions so one font-size serves both.

Two traps worth remembering:

- **`local()` matches a font's full/PostScript name, not its family name.**
  `local('Caslon Antique')` matches nothing on a machine that has it;
  `local('Caslon Antique Bold')` resolves. When it fails, the family resolves
  to nothing, the stack silently falls through to the substitute, and
  `getComputedStyle` still reports the declared family — so it reads as fixed
  while the authentic face has quietly been dropped. Verify by rendering, or
  by loading a `FontFace` with the candidate and measuring its x-height.
- **h2/h3 and h1 are left alone deliberately.** HamletOrNot runs *larger* than
  its substitute and Xiparos is a Lombardic capitals face where cap-height,
  not x-height, is the meaningful measure. Normalising those by x-height would
  make them worse.

### Seeing the substitute path

Only a machine without the creator pack renders what almost every reader gets,
so the theme carries a switch. In the console:

```js
document.documentElement.dataset.fonts = 'ofl'; // the substitutes
delete document.documentElement.dataset.fonts; // back to the real book
```

Check both before changing any size in `theme.css`.

### Which browsers actually take the local path

Measured 2026-08-08 on a machine with the creator pack installed:

| browser | sees the local faces? |
| --- | --- |
| Chromium | yes |
| Firefox (151, macOS) | yes — `size-adjust` applies correctly too |
| Safari (macOS) | **no** |

Safari restricts matching arbitrary locally-installed fonts as a fingerprinting
mitigation, so a Safari reader gets the OFL substitutes **even if they own the
book's fonts**. That makes the substitute path the majority experience by a
wider margin than the "who owns the creator pack" question suggests, and it is
another reason to check `data-fonts='ofl'` before trusting a size: on Safari it
is the only thing anyone sees.

### Caslon Antique is out (2026-08-08)

Text set in Caslon Antique **cannot be selected in Firefox** (153, macOS).
Confirmed by elimination on the same page: with `data-fonts='ofl'` selection
works, and the epigraph's identical `local()` + `size-adjust` wrapper is
unaffected — so it's the font file, not the mechanism. It's an old freeware
face, most likely with a broken `cmap`.

Scored honestly it was: invisible in Safari, unselectable in Firefox, correct
only in Chromium. So the h4/h5/h6 subhead role uses Libre Caslon Text
everywhere, its `size-adjust` wrapper is gone, and readers keep being able to
select a rule's label. Being unable to copy a heading is a worse bug than not
seeing the authentic face.
