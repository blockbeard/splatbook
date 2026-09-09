import { readFileSync } from 'node:fs';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Phase-29 card table: two seats through a round of a Challenge, with hidden
 * information asserted hidden at every step.
 *
 * Two contexts, and deliberately *asymmetric* ones. The GM signs in, because
 * starting a table is the one thing this feature requires an account for. The
 * player never does: they arrive by link and hold their seat with a cookie,
 * which is the whole point of a guest seat and the part most likely to break
 * quietly.
 *
 * **How the leak checks work.** Every assertion about what a seat may not see
 * is made against the sync endpoint's own reply, fetched with that context's
 * cookies — the same bytes the browser gets. A projection is serialised and
 * searched for the card ids the viewer has no business holding, so a card that
 * leaked in a field nobody thought to render would still fail this. Checking
 * the rendered page alone would pass a projection that shipped the whole deck
 * and simply drew a card back over it.
 *
 * **Why not simply search the page HTML.** A card table's page ships the whole
 * content pack — every card in the deck, by id and by name — because that is
 * what turns an id into a picture. So the HTML contains "swords-ace" whatever
 * the projection said, and a string search over it can only ever fail. The
 * rendered half of the claim is therefore made against *accessible names*,
 * which exist only where a face is actually drawn.
 *
 * The database is not assumed to be empty (see the note in playwright.config.ts):
 * every locator is scoped to the table this test created, reached by its own
 * room token, and the seats are named per run.
 */

interface Projection {
	version: number;
	seatId: string | null;
	state: {
		mode: 'decks' | 'challenge';
		gmSeat: string | null;
		facedown: Record<string, { position: string; label: string }>;
		zones: Record<string, { count: number; cards?: string[] }>;
	};
}

/** The table as this context is entitled to see it — the browser's own bytes. */
async function projectionFor(context: BrowserContext, token: string): Promise<Projection> {
	const res = await context.request.get(`/api/card-tables/${token}/sync?since=0`);
	expect(res.ok()).toBeTruthy();
	return (await res.json()) as Projection;
}

/**
 * Assert that none of `cards` appears anywhere in what this seat was sent.
 *
 * The serialise-and-search form matters: a leak is rarely in the field you are
 * looking at.
 */
function assertUnseen(projection: Projection, cards: string[], who: string) {
	const wire = JSON.stringify(projection);
	for (const card of cards) {
		expect(wire, `${who} was sent ${card}, which they may not see`).not.toContain(card);
	}
}

/** Card id to the name a viewer would read, straight from the pack. */
const CARD_NAMES: Record<string, string> = (() => {
	const deck = JSON.parse(readFileSync('static/content-packs/hmtw/data/deck.json', 'utf8')) as {
		minors: { id: string; name: string }[];
		majors: { id: string; name: string }[];
	};
	return Object.fromEntries([...deck.minors, ...deck.majors].map((c) => [c.id, c.name]));
})();

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** Cross-context changes arrive on a poll, not instantly. */
const POLLED = { timeout: 15_000 };

test('two seats play a round, and neither can see the other’s hand', async ({ browser }) => {
	const run = Date.now().toString(36);
	const playerName = `Grimwold ${run}`;

	// --- The GM starts a table. Signing in is required exactly here. ---
	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Table GM', `e2e-table-gm-${run}@localhost`);

	await gm.goto('/hmtw/cards');
	await gm.locator('input[name="name"]').fill(`Thursday ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();

	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();
	const token = roomUrl.split('/').pop()!;

	// The creator is seated as GM without asking anyone: they are the GM.
	await expect(gm.getByRole('button', { name: 'Reset the table' })).toBeVisible();

	// --- A player arrives by link, with no account at all. ---
	const playerContext = await browser.newContext();
	const player = await playerContext.newPage();
	await player.goto(roomUrl);

	// Watching is allowed. Acting is not: there are no mode controls to press.
	await expect(player.getByText('You are watching.')).toBeVisible();
	await expect(player.getByRole('button', { name: 'Reset the table' })).toHaveCount(0);

	await player.getByLabel("Your character's name").fill(playerName);
	await player.getByRole('button', { name: 'Ask for a seat' }).click();
	await expect(player.getByText(/Waiting for the GM to let you in/)).toBeVisible();

	// --- The GM sees the request arrive without touching the page. ---
	// The roster rides on the poll precisely so this works; it used to need a
	// reload, which meant the one person who has to act never saw it.
	// Scoped to the row bearing this run's name rather than to the first one on
	// the page: the database is not reset between local runs.
	const request = gm.locator('.ch__waiter, li, span', { hasText: playerName });
	await expect(gm.getByText(playerName)).toBeVisible(POLLED);
	await request.getByRole('button', { name: 'Let in' }).first().click();

	// Being let in reaches the player the same way — no reload.
	await expect(player.getByText(/Waiting for the GM to let you in/)).toHaveCount(0, POLLED);

	// --- Into a Challenge, and deal. ---
	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();
	await expect(player.getByText('Challenge', { exact: true })).toBeVisible(POLLED);

	await gm.getByRole('button', { name: 'Deal the round' }).click();
	// The click only dispatches the command; the cards land a round trip later.
	// Reading the projection straight afterwards was a race that happened to
	// win, and would have failed as an empty hand rather than as a leak.
	await expect
		.poll(async () => {
			const view = await projectionFor(gmContext, token);
			return view.state.zones[`seat:${view.seatId}:hand`].count;
		}, POLLED)
		.toBeGreaterThan(0);

	// --- Hidden information, checked on the wire. ---
	const gmView = await projectionFor(gmContext, token);
	const playerView = await projectionFor(playerContext, token);

	const gmSeat = gmView.seatId!;
	const playerSeat = playerView.seatId!;
	expect(gmSeat).not.toBe(playerSeat);
	expect(gmView.state.gmSeat).toBe(gmSeat);

	const gmHand = gmView.state.zones[`seat:${gmSeat}:hand`].cards!;
	const playerHand = playerView.state.zones[`seat:${playerSeat}:hand`].cards!;
	expect(gmHand.length).toBeGreaterThan(0);
	expect(playerHand.length).toBeGreaterThan(0);

	// Each is told how many the other holds, and nothing more. The count is not
	// a secret — you can see how many cards someone has across a real table.
	const playerHandToGm = gmView.state.zones[`seat:${playerSeat}:hand`];
	expect(playerHandToGm.count).toBe(playerHand.length);
	expect(playerHandToGm.cards).toBeUndefined();
	const gmHandToPlayer = playerView.state.zones[`seat:${gmSeat}:hand`];
	expect(gmHandToPlayer.count).toBe(gmHand.length);
	expect(gmHandToPlayer.cards).toBeUndefined();

	assertUnseen(playerView, gmHand, 'the player');
	assertUnseen(gmView, playerHand, 'the GM');

	// The decks are face down to everyone, including the GM.
	expect(gmView.state.zones['deck:gm'].cards).toBeUndefined();
	expect(gmView.state.zones['deck:player'].cards).toBeUndefined();

	// Nor is any of it drawn on the player's page. An accessible name is the
	// right instrument here: a card only has one where a face was rendered.
	for (const card of gmHand) {
		await expect(
			player.getByRole('button', { name: CARD_NAMES[card], exact: true }),
			`${CARD_NAMES[card]} is drawn on the player's table`
		).toHaveCount(0);
	}
	// And the player's own hand is drawn, so the check above is not passing for
	// want of any cards at all.
	await expect(
		player.getByRole('button', { name: CARD_NAMES[playerHand[0]], exact: true })
	).toBeVisible();

	// --- The player plays a card face up. Everyone may see that one. ---
	// Picked by name, not by position: a hand is rendered sorted by value —
	// ch.7's own worked example has the GM do that — so "the first card in the
	// hand" and "the first card in the projection" are different cards.
	const played = playerHand[0];
	await player.getByRole('button', { name: CARD_NAMES[played], exact: true }).click();
	await player
		.locator('.combatant', { hasText: playerName })
		.getByRole('button', { name: 'Play here' })
		.click();

	await expect
		.poll(
			async () =>
				(await projectionFor(gmContext, token)).state.zones[`seat:${playerSeat}:played`].cards,
			{ timeout: 10_000 }
		)
		.toContain(played);

	// --- And one face down, with a declared action. ---
	// Ch.7 makes the intent public while the value stays private, which is the
	// hardest thing on this table to get right: three audiences, one card.
	const hidden = playerHand[1];
	await player.getByRole('button', { name: CARD_NAMES[hidden], exact: true }).click();
	// Not scoped to a combatant any more: the two "Play facedown" buttons only
	// ever appeared on your own seat, and they moved down to the hand so that
	// every *other* seat stopped reserving room for a block it could not show.
	await player.getByRole('button', { name: 'Play facedown — your turn' }).click();
	await player.getByLabel('What is it for?').fill('Riposte');
	await player.getByRole('button', { name: 'Lay it down' }).click();

	const afterDown = { gm: await projectionFor(gmContext, token) };
	await expect
		.poll(async () => {
			afterDown.gm = await projectionFor(gmContext, token);
			return afterDown.gm.state.zones[`seat:${playerSeat}:facedown`].count;
		}, POLLED)
		.toBe(1);

	// The GM is told a card is there and what it is for, and is not told what it
	// is. That combination is the whole point of the zone.
	expect(afterDown.gm.state.facedown[`seat:${playerSeat}:facedown`].label).toBe('Riposte');
	expect(afterDown.gm.state.zones[`seat:${playerSeat}:facedown`].cards).toBeUndefined();
	assertUnseen(afterDown.gm, [hidden], 'the GM');

	// Its owner sees both: what it is, and that it is still face down. A card
	// that looked face-up to its holder would leave them guessing about the one
	// thing they must never guess about — so the mark sits on an intact back
	// rather than turning it over, and the accessible name says both.
	const ownerView = await projectionFor(playerContext, token);
	expect(ownerView.state.zones[`seat:${playerSeat}:facedown`].cards).toEqual([hidden]);
	await expect(
		player.getByRole('button', { name: `${CARD_NAMES[hidden]}, face down, declared Riposte` })
	).toBeVisible(POLLED);

	// The three audiences, in one assertion each. The GM is shown a back that
	// says what it is for and not what it is.
	await expect(gm.getByRole('button', { name: 'Face-down card, declared Riposte' })).toBeVisible(
		POLLED
	);
	await expect(gm.getByRole('button', { name: new RegExp(`^${CARD_NAMES[hidden]}`) })).toHaveCount(
		0
	);

	// --- The table says what happened, for somebody who cannot see it. ---
	// Everything here moves because somebody else moved it. Without a live
	// region you are sitting at a table that silently rearranges itself, and the
	// count is the case that matters most: it is how the table says your turn
	// has come.
	const spoken = player.locator('.ct-announcer');
	// "On one" — the count buttons carry real names rather than a bare glyph,
	// which is the only reason this locator can exist.
	await gm.getByRole('button', { name: 'On one' }).click();
	await expect(spoken).toHaveText(/Initiative \d+\./, POLLED);

	// --- Sweep and end the round. Facedown cards stay; the round moves on. ---
	await gm.getByRole('button', { name: 'End the round' }).click();
	await expect
		.poll(async () => (await projectionFor(gmContext, token)).state.zones['discard:player'].count, {
			timeout: 10_000
		})
		.toBeGreaterThan(0);

	await gmContext.close();
	await playerContext.close();
});

test('somebody holding the link but no seat can watch and cannot act', async ({ browser }) => {
	const run = Date.now().toString(36);

	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Watcher GM', `e2e-watch-gm-${run}@localhost`);
	await gm.goto('/hmtw/cards');
	await gm.locator('input[name="name"]').fill(`Watched ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const token = gm.url().split('/').pop()!;

	const strangerContext = await browser.newContext();
	const stranger = await strangerContext.newPage();
	await stranger.goto(gm.url());
	await expect(stranger.getByText('You are watching.')).toBeVisible();

	// A watcher gets the table, so they can decide whether to join — and the
	// server refuses their commands rather than the page merely hiding them.
	const view = await projectionFor(strangerContext, token);
	expect(view.seatId).toBeNull();

	const refused = await strangerContext.request.post(`/api/card-tables/${token}/commands`, {
		data: {
			command: { type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' },
			expectedVersion: view.version,
			requestHash: crypto.randomUUID()
		}
	});
	expect(refused.status()).toBe(403);

	await gmContext.close();
	await strangerContext.close();
});
