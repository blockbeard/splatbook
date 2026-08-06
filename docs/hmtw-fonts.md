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
| Chapter titles, 85/45pt lombardic caps | Xiparos Lombard (Pia Frauss 2005) | ❌ "for private use only"; commercial use needs permission | **Uncial Antiqua** — rounded medieval capitals, the closest common OFL face to lombardic display |
| Chapter numbers, running footers | IM Fell Great Primer SC (Igino Marini) | ✅ **OFL** (`OFL.txt` ships in the folder) | use as-is |
| H1 40pt / H2 28pt caps / H3 18pt, folio | HamletOrNot (Manfred Klein & Petra Heidorn 2004, after Johnston's Hamlet type for the Cranach Presse) | ❌ free incl. commercial *use*, but "can not be included in any compilation … or products … unless prior permission granted" — self-hosting is exactly that | **IM Fell English SC** — keeps the headings inside the book's own Fell palette |
| H4 16pt bold, table headers | Caslon Antique Bold ("Typographer Mediengestaltung" = Dieter Steffmann 2000) | ❌ non-commercial only, and Fedora rejected the whole Steffmann corpus over provenance of the originals | **Libre Caslon Text Bold** — right family, already self-hosted for stonetop |
| Chapter-intro paragraphs, 13.5pt | BilboDisplay (WSI/IMSI 1993–96) | ❌ commercial data, "Redistribution strictly prohibited" in the name table | **IM Fell English Italic** — already in the palette |
| Body 10.5pt, boxout headers, table body, quote attributions | IM Fell English roman + italic | ✅ **OFL** (already a repo dependency) | use as-is |
| Sidebar body 9.5pt | Goudy Old Style (`GOUDOS.TTF`, URW data © Microsoft) | ❌ Windows system font, commercial | **Sorts Mill Goudy** — the OFL Goudy revival (the plan's own example) |
| Sidebar headers 14pt | KelmscottRoman (Nick Curtis 2000, after Morris's Golden Type) | ⚠️ file says All Rights Reserved; only aggregator-applied "free for commercial use" labels exist | **Goudy Bookletter 1911** — League/PD, Kennerley-based, the same private-press flavor |
| Pull quotes 36pt | Dark Roast (Brittney Murphy 2013) | ❌ free version is personal-use only; a real **webfont license is purchasable on Fontspring** if authenticity is wanted | **Almendra Display** — quirky medieval display, fits the book |

## Faces in the folder that need no decision

- **Rakkas** (OFL) — in `Document fonts/` but used nowhere in the template's
  text. Ignore.
- **Britannia** (woodcutter.es) and **Minion Pro** (Adobe, InDesign default) —
  likewise unused in any paragraph/character style.
- **`Parasite-K7Zrp.ttf`** — its name table carries *"HTF Gotham Copr. 2000
  The Hoefler Type Foundry"*: renamed commercial font data. Unused in the
  template text. Do not touch, do not ship, do not keep copies.

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
`@fontsource/im-fell-english-sc`, `@fontsource/uncial-antiqua`,
`@fontsource/sorts-mill-goudy`, `@fontsource/goudy-bookletter-1911`,
`@fontsource/almendra-display`** (all verified present at v5.3.0), reuse the
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
