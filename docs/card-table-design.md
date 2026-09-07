# The card table — design

*Phase 29, commit 12. Written before any of the table's UI, which is the whole
point of it having its own commit.*

## The one decision everything else follows from

`/hmtw/reference` is a book: black ink on white paper, IM Fell, no colour at
all. That is right for reading and wrong for playing.

A table is not a page. It is a surface you put things on, and the things are the
point — so the relationship inverts. **The ground goes dark and the cards become
the brightest objects on screen**, because the cards are the content and
everything else is furniture. Nothing else in this document is a free choice;
it all falls out of that.

## Palette

| token | value | what it is |
|---|---|---|
| `--ct-table` | `#191e1c` | the surface — cold graphite with green in it |
| `--ct-table-low` | `#121615` | its far edge, so the table has a horizon |
| `--ct-card` | `#ece7db` | paper. Warm, against a cold ground |
| `--ct-card-ink` | `#14100c` | the book's ink |
| `--ct-back` | `#241d19` | a card back |
| `--ct-light` | `#c99a4e` | a lantern's edge. **The only colour** |
| `--ct-doom` | `#8c2f22` | greater dooms, borrowed from the book's one red |

Three things worth defending.

**The ground is not black.** Black is the reference's dark mode, and a void
behind a card reads as nothing at all. This is wet stone — the material the game
is played over — and it sits back far enough that paper lifts off it without a
shadow having to announce that it has.

**There is no bright accent.** Near-black with one acid highlight is what this
would look like if nobody had thought about it. The single colour here is a dim,
low-chroma amber taken from the game's own light mechanic, where a light source
burns down in flickers, and it means exactly one thing: *this is yours*. The
design's contrast comes from the content — paper against stone — rather than
from a colour chosen to supply some.

**Warm paper on a cold ground** is most of why a card reads as an object rather
than a rectangle. It is doing more work than the shadow is.

## Type

The reference's own faces, unchanged: IM Fell English for text, IM Fell Great
Primer SC for labels and ranks, Goudy for prose. They are already loaded,
already licensed, and already carry the identity.

A second type system here would be boldness spent in the wrong place. There is
one place to spend it, and it is this:

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
*mark on the back* — rank and suit in lantern amber, small, in the corner,
unmistakably an annotation rather than a face. You read your own card without it
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

Selection is quiet: an outline on what is held, a hairline on where it could go.
A table that lights up like a pinball machine because somebody picked up a card
is a table you cannot read.

## The floor

Touch targets are the cards themselves, comfortably over 44px at every size used.
Focus is visible in the same amber. Motion is a 120ms lift on hover and nothing
else, inside `prefers-reduced-motion: no-preference`. Colour never carries
meaning alone — the greater-doom red is reinforced by the numeral's band, and
"yours" by the mark's presence rather than its hue.

A WCAG 2.1 AA audit runs at commit 19, against the finished thing.
