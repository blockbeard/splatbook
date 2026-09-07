# The card table — design

*Phase 29, commit 12. Written before any of the table's UI, which is the whole
point of it having its own commit.*

## The first version, and why it was wrong

The first pass had a desaturated dark-green ground, grey furniture, a gold
accent and brown card backs. Chris named it on sight as machine-made, and he was
right. The diagnosis is worth keeping, because it is a failure mode rather than
a mistake.

Every choice in it was defensible sentence by sentence — stone for the
underworld, amber from the game's light mechanic — and the whole was still one
of the looks that appear regardless of subject. The fault was that it **invented
a palette when the book already had one**. A design that has to argue its way to
a colour scheme has usually walked past a better answer.

## The one decision everything else follows from

The book is black ink on white paper with no colour at all, and its dark mode is
a straight inversion — the same thing its own figures do, as light and dark pairs
of one drawing. The table does that too:

| | the room | the cards | the ink |
|---|---|---|---|
| light | grey `#b8b6b1` | white | black |
| dark | near-black `#1c1c1c` | bone `#e9e7e2` | black |

**What inverts is the room, not the objects on it.** Paper is paper: a card
keeps its ink in both modes, which is what makes it read as a thing lying on a
table rather than a shape that changes with the lights.

**There is no accent colour.** The reference's own note settles it — *"the
interior is monochrome, so the accent IS the ink"* — so emphasis here is weight,
rule and contrast. The single exception is the book's one red, for greater
dooms, which is the sort of thing the book reserves it for.

**Card backs are the Adherent of the Worm**, the mark whose own terms call it
"allowed and encouraged" for third-party work. It was already in the pack and
already cleared, so no Creative Commons hunt was needed. It is printed *on the
card stock* rather than on some other material, which is what a card back
actually is — the same paper, with something on it — and it means a facedown
card still reads as a card rather than a dark hole where one used to be.

## Type

The reference's own faces, unchanged: IM Fell English for text, IM Fell Great
Primer SC for labels and ranks. They already carry the identity, and a second
type system would be boldness spent in the wrong place.

## The signature: a facedown card

A facedown card has to say three different things to three different people at
once, and ch.7 is precise about which:

- **everyone** — that a card is there, and *what it is for* ("Riposte"), because
  the player declares the action aloud
- **its owner** — additionally, its value, because they are holding it
- **nobody** — the value, if it is not theirs. "No peeking!"

The obvious answer is to show the owner the face. It is wrong, and the reason is
worth stating plainly: **then the owner cannot tell at a glance whether the table
can see it too**, and that is the one thing they must never be unsure about.

So the back stays a back for everybody, always. Its owner gets the value as a
*mark on the back* — rank and suit in a small ruled box in the corner, printed
over the worm, unmistakably an annotation rather than a face. You read your own card without it
ever appearing to turn over, which is precisely the state it is in.

The declared action hangs **outside** the card, on a tag beneath it. Public
information belongs in a public place, not printed on an object whose entire
meaning is that it is hidden.

One consequence: on a sideways card the mark stays upright. The card turns
because the book says to lay it sideways; the mark is not printing on the card,
it is the interface talking to its owner, and rotating it would both make the
one person entitled to read it tilt their head and blur the distinction the
treatment rests on.

## Structure carries meaning

The book says to set a facedown card **sideways**, *above* the initiative card
for a turn action and *below* it for a minor action — and the position is what
decides whether the card gains an attribute when it turns over. So the interface
does exactly that, because the rule is already positional. This is the one place
the layout encodes something rather than arranging it.

## The input model

Every action is reachable two ways, and neither is a fallback:

- **click to select, click to place** — the primary one. It is the only
  interaction that works on a phone without fighting the scroll, and it carries
  most of the keyboard and screen-reader story for free: select is a button
  press, place is a button press, both announce themselves.
- **drag** — the enhancement, for people with a pointer who reasonably expect a
  card table to behave like one.

Both carry the same payload, through `$lib/card-table/selection`.

**Nothing is reachable only by right-click.** Any context menu duplicates a
visible control, and `ctrl`-click on macOS opens it — checked explicitly rather
than left to the browser, because on a surface where every card is clickable it
is easy to swallow the gesture by accident, and a player who has never found
right-click in a VTT should not lose half the table.

Selection is quiet: an ink outline on what is held, a hairline on where it could
go.
A table that lights up like a pinball machine because somebody picked up a card
is a table you cannot read.

## Two things only rendering could tell me

Both were invisible in the CSS and obvious on screen, which is the argument for
this commit existing at all rather than the design being decided while building
the first component.

**The card backs were too faint** to read as printed cards — they looked like
holes in the table rather than objects on it. They now carry a lighter hatch and
an inner hairline.

**The suit glyphs are `fill="currentColor"`**, which does exactly what you want
inside the document and nothing at all through an `<img>`: the colour resolves
against the SVG's own root and comes out black. On a paper card that is right by
luck; on the amber mark over a dark back it is an invisible glyph. They are drawn
as CSS masks instead, so the element is the ink and takes whatever colour it is
standing in.

And one that reading the CSS *should* have caught: a rotated element keeps its
upright layout box, so a sideways card left a tall gap where it was not and
overflowed sideways where it was. The margin correcting it had the sign the
wrong way round and added the space instead of taking it.

## The floor

Touch targets are the cards themselves, comfortably over 44px at every size used.
Focus is visible in the ink. Motion is a 120ms lift on hover and nothing
else, inside `prefers-reduced-motion: no-preference`. Colour never carries
meaning alone — the greater-doom red is reinforced by the numeral's band, and
"yours" by the mark's presence rather than its hue.

A WCAG 2.1 AA audit runs at commit 19, against the finished thing.
