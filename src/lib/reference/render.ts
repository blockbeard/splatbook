/**
 * Render a section's body markdown to HTML, resolving Obsidian-style wikilinks
 * to in-app reference deep-links where their target can be identified, and
 * rendering Obsidian callouts (`> [!move] …`) as styled asides instead of
 * plain blockquotes with literal `[!move]` text.
 *
 * A wikilink `[[Note#Heading|Label]]` is matched to a section by heading title
 * (preferring one whose id came from the linked note); `[[Note#^blockId|Label]]`
 * matches by the note's own named block id instead (the vault's cleanup moved
 * cross-references onto these — stable across a heading rename, unlike the
 * old page-anchor or heading-text links). Resolved links become
 * `…/reference/<id>`, unresolved ones fall back to their label as plain text so
 * the prose never shows raw `[[…]]` syntax. Pack content is first-party, so the
 * marked output is trusted (rendered with `{@html}`).
 */

import { Marked } from 'marked';
import type { RendererThis, Token, Tokens, TokenizerThis } from 'marked';
import { base } from '$app/paths';
import { resolveWikilinks, type LinkIndex } from './inline';

// The wikilink machinery (index building, target resolution, the `[[…]]` →
// markdown-link rewrite) lives in `./inline` since phase 21, tree-free, so
// move cards and steading lines can share it. Re-exported here so existing
// importers keep one import site.
export { buildLinkIndex, type LinkIndex } from './inline';
/**
 * A line that is *only* a named block id, Obsidian's own link anchor —
 * `^clash` bare, or `> ^clash` inside a callout's blockquote. Never prose;
 * the pipeline (`build_srd.py`) deliberately leaves it in the body raw (see
 * `document-tree.ts`'s `kind` doc), so the renderer strips it before display.
 * Still indexed for linking (`buildLinkIndex`) before it's stripped here.
 *
 * `[ \t]`, never `\s`, around the marker: `\s` matches a newline too, and a
 * greedy `\s*`/`\s?` anchored at start-of-line with the `m` flag will happily
 * eat the line break into the *next* line looking for more "whitespace" —
 * silently merging it into a blank separator line and losing a paragraph
 * break. Every pattern below that means "space, not a line break" says so.
 */
const BLOCK_ID_LINE = /^>?[ \t]*\^[\w-]+[ \t]*$/gm;
/**
 * The opening line of a callout: `> [!type]`, type letters/digits/spaces/
 * hyphens (the vault isn't consistent about single-word types, e.g.
 * `[!minor arcanum]`, `[!arcanum-secret]`), optionally folded (`+`/`-`).
 * Shared by `CALLOUT_BLOCK` (to stop a callout's continuation from
 * swallowing a *sibling* callout right after it — see there) and
 * `leadingQuotedRun` (same reason, for a kind-tagged section's own body).
 */
const CALLOUT_OPEN = /^>[ \t]*\[![\w][\w -]*?\][+-]?/;
/**
 * Consumes a whole callout block from the start of `src`: the opener line
 * (type + optional inline title) plus every contiguous `>`-prefixed line
 * after it, *stopping short of a line that opens another callout* — a
 * consecutive run of callouts (e.g. `09 - Threats`' one per threat type)
 * isn't always separated by a blank line in the source, and without the
 * negative lookahead the first callout's continuation would swallow every
 * sibling after it whole, de-quoting their own `[!type]` openers into
 * literal, unstyled text along the way. Group 1: type. Group 2: inline
 * title text, if any. Group 3: the continuation lines, still `>`-prefixed.
 */
const CALLOUT_BLOCK =
	/^>[ \t]*\[!([\w][\w -]*?)\][+-]?[ \t]*([^\n]*)\n?((?:>(?![ \t]*\[!)[^\n]*(?:\n|$))*)/;

/** A callout type as its CSS class suffix: lowercase, spaces/underscores to
 * hyphens (`minor arcanum` -> `minor-arcanum`). Hyphens already in the type
 * (`arcanum-secret`) pass through untouched. */
const normalizeType = (s: string): string =>
	s
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-');
/** `minor-arcanum` -> `Minor Arcanum`; `move` -> `Move`. */
const titleCase = (s: string): string =>
	s.replace(
		/(^|-)([a-z0-9])/g,
		(_, sep: string, ch: string) => (sep ? ' ' : '') + ch.toUpperCase()
	);

/** A callout token: its type (`kind` — "move", "monster", "box", …) plus the
 * block tokens of its de-quoted inner markdown. */
interface CalloutToken extends Tokens.Generic {
	type: 'sb-callout';
	calloutType: string;
	tokens: Token[];
}

/**
 * Marked extension recognizing `> [!type] …` as a block, distinct from an
 * ordinary blockquote: the type becomes a CSS hook (`sb-callout-<type>`) and
 * a small label, and its `>`-continuation lines are de-quoted and re-parsed
 * as their own markdown (so a callout can hold a list, bold text, etc.).
 * Scoped to a dedicated `Marked` instance (not the shared default export)
 * so it doesn't change how the rest of the app's markdown renders.
 */
const calloutExtension = {
	name: 'sb-callout',
	level: 'block' as const,
	start(src: string): number | undefined {
		return new RegExp(CALLOUT_OPEN.source, 'm').exec(src)?.index;
	},
	tokenizer(this: TokenizerThis, src: string): CalloutToken | undefined {
		const match = CALLOUT_BLOCK.exec(src);
		if (!match) return undefined;
		const [raw, type, inlineTitle, continuation] = match;
		const inner = [inlineTitle.trim(), continuation.replace(/^>[ \t]?/gm, '')]
			.filter(Boolean)
			.join('\n')
			.trim();
		if (!inner) return undefined; // nothing to show; fall through to default handling
		return {
			type: 'sb-callout',
			raw,
			calloutType: normalizeType(type),
			tokens: this.lexer.blockTokens(inner)
		};
	},
	childTokens: ['tokens'],
	renderer(this: RendererThis, token: Tokens.Generic): string {
		const { calloutType, tokens } = token as CalloutToken;
		return (
			`<aside class="sb-callout sb-callout-${calloutType}">\n` +
			`<p class="sb-callout-label">${titleCase(calloutType)}</p>\n` +
			`${this.parser.parse(tokens)}</aside>\n`
		);
	}
};

const referenceMarked = new Marked({ extensions: [calloutExtension] });

/**
 * The leading run of a text's blank/`>`-prefixed lines, up to (not
 * including) the first line that's neither *or* that opens a new callout —
 * a section's own leading run can be followed by an embedded sibling
 * callout (e.g. a `[!box]` guidance blurb followed by a `[!Love Letter]`
 * example) with only a blank line between them, and a blank line alone
 * doesn't end the run (a callout's own paragraphs are blank-line-separated
 * too), so the opener check is what tells them apart.
 */
function leadingQuotedRun(text: string): { run: string; rest: string } {
	const lines = text.split('\n');
	let i = 0;
	while (
		i < lines.length &&
		(lines[i] === '' || lines[i].startsWith('>')) &&
		!CALLOUT_OPEN.test(lines[i])
	) {
		i++;
	}
	return { run: lines.slice(0, i).join('\n'), rest: lines.slice(i).join('\n') };
}

/**
 * Box a kind-tagged section's own leading quoted run as a styled aside,
 * de-quoted and re-parsed as markdown — the same look an embedded `[!type]`
 * callout gets from `calloutExtension`, for a section whose *heading* opened
 * the callout (its body carries the continuation only, no `[!type]` marker
 * of its own; that line became the heading — see `document-tree.ts`'s `kind`
 * doc). Returns `null` if the run turns out to hold nothing real once
 * de-quoted (rare, but the vault cleanup didn't uniformly re-quote every
 * line of every converted callout — some sections' bodies drop the `>` mid-
 * paragraph and pick it back up later; boxing just the meaningful lead-in
 * whenever there is one beats a mis-boxed section or a leaked `[!type]`).
 */
function renderCalloutBox(kind: string, quotedRun: string): string | null {
	const inner = quotedRun.replace(/^>[ \t]?/gm, '').trim();
	if (!inner) return null;
	return (
		`<aside class="sb-callout sb-callout-${kind}">\n` +
		`<p class="sb-callout-label">${titleCase(kind)}</p>\n` +
		`${referenceMarked.parse(inner, { async: false })}</aside>\n`
	);
}

/**
 * Convert body markdown (with wikilinks and, possibly, Obsidian callouts) to
 * trusted HTML for a game's reference. `kind` is the section's own callout
 * type (`documentSectionSchema`'s field), if its heading opened one.
 */
export function renderMarkdown(
	body: string,
	gameId: string,
	index: LinkIndex,
	kind?: string
): string {
	const withLinks = resolveWikilinks(
		body
			// Drop the block id itself, but keep a quoted line quoted (`>` alone,
			// not ``): stripping it down to nothing breaks the unbroken run of
			// `>`-prefixed lines that both CALLOUT_BLOCK's continuation and
			// marked's own blockquote tokenizer depend on to find a callout's
			// extent, leaving a dangling bare `>` that marked's default
			// blockquote handling grabs first — and it doesn't know about
			// CALLOUT_OPEN, so it swallows the *next* callout as if it were
			// plain quoted text. A bare (unquoted) block-id line has no such
			// structure to preserve, so it's still dropped outright.
			.replace(BLOCK_ID_LINE, (m) => (m.startsWith('>') ? '>' : '')),
		index,
		(id) => `${base}/${gameId}/reference/${id}`
	);

	if (kind && withLinks.trimStart().startsWith('>')) {
		const { run, rest } = leadingQuotedRun(withLinks);
		const boxed = renderCalloutBox(kind, run);
		if (boxed) return boxed + (referenceMarked.parse(rest, { async: false }) as string);
	}
	return referenceMarked.parse(withLinks, { async: false }) as string;
}
