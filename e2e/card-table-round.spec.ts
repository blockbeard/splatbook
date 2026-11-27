import { readFileSync } from 'node:fs';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Phase 32: a whole round in four browsers — the GM and three players, as the
 * first live test (25 November 2026) had it — played through "Your move", one
 * step at a time.
 *
 * The deck is shuffled, so who goes when is not known in advance. The test
 * reads the round's step from each seat's own projection (the browser's own
 * bytes) and acts on whichever page the round is waiting for, as a person at
 * the table would. What it asserts at every step is the part the live test
 * found missing: only the acting player is told it is their turn; minor
 * actions stay face down to everyone else until the last answer, then turn
 * over together; played cards land in the open with what they were for.
 */

interface Projection {
	version: number;
	seatId: string | null;
	state: {
		round: {
			step: 'deal' | 'initiative' | 'turn' | 'minor' | 'resolve' | 'over';
			count: number | null;
		};
		upNow: string[];
		waitingOn: string[];
		plays: Record<string, { by: string; action: string; kind: string }>;
		minorDeclared: Record<string, string>;
		zones: Record<string, { count: number; cards?: string[] }>;
	};
}

const POLLED = { timeout: 15_000 };
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

async function projectionFor(context: BrowserContext, token: string): Promise<Projection> {
	const res = await context.request.get(`/api/card-tables/${token}/sync?since=0`);
	expect(res.ok()).toBeTruthy();
	return (await res.json()) as Projection;
}

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** WCAG 2.1 AA in both rooms. */
async function violations(page: Page): Promise<string[]> {
	const found: string[] = [];
	for (const theme of ['light', 'dark'] as const) {
		await page.evaluate(
			(t) => document.documentElement.classList.toggle('dark', t === 'dark'),
			theme
		);
		await page.addScriptTag({ content: AXE });
		const result = (await page.evaluate(async () =>
			// @ts-expect-error injected above
			window.axe.run(document, {
				runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
			})
		)) as { violations: { id: string; nodes: { target: string[] }[] }[] };
		for (const v of result.violations) {
			for (const n of v.nodes) found.push(`[${theme}] ${v.id} — ${n.target.join(' ')}`);
		}
	}
	await page.evaluate(() => document.documentElement.classList.remove('dark'));
	return found;
}

const SHOTS = process.env.SCENE_SCREENSHOTS;
async function shot(page: Page, name: string) {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test('a whole round, a GM and three players, one step at a time', async ({ browser }) => {
	test.setTimeout(240_000);
	const run = Date.now().toString(36);
	const failures: string[] = [];

	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Round GM', `e2e-round-gm-${run}@localhost`);
	await gm.goto('/hmtw/cards');
	await gm.locator('input[name="name"]').fill(`Arena ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();
	const token = roomUrl.split('/').pop()!;

	// --- Three players arrive by link and are let in. ---
	const names = ['Ash', 'Bel', 'Cai'].map((n) => `${n} ${run}`);
	const players: { name: string; context: BrowserContext; page: Page; seat: string }[] = [];
	for (const [i, name] of names.entries()) {
		// Cai plays on a phone: the check the first live test deferred.
		const context = await browser.newContext(
			i === 2 ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : {}
		);
		const page = await context.newPage();
		await page.goto(roomUrl);
		await page.getByLabel("Your character's name").fill(name);
		await page.getByRole('button', { name: 'Ask for a seat' }).click();
		await expect(gm.getByText(name)).toBeVisible(POLLED);
		await gm
			.locator('.ch__waiter, li, span', { hasText: name })
			.getByRole('button', { name: 'Let in' })
			.first()
			.click();
		await expect(page.getByText(/Waiting for the GM to let you in/)).toHaveCount(0, POLLED);
		players.push({ name, context, page, seat: '' });
	}
	for (const p of players) p.seat = (await projectionFor(p.context, token)).seatId!;
	const gmSeat = (await projectionFor(gmContext, token)).seatId!;

	// --- A Challenge: two zombies, and the deal. ---
	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();
	await gm.getByLabel('Enemy name').fill('Zombie');
	await gm.getByLabel('How many').fill('2');
	await gm.locator('.add-enemy').getByRole('button', { name: 'Add' }).click();
	await expect(gm.getByText('2 of 2 up')).toBeVisible(POLLED);
	// Two enemies against three adventurers, one type: 3 + 1, less one for three
	// adventurers (the house rule ticks itself) — the draw fills itself in.
	await expect(gm.getByLabel('Cards')).toHaveValue('3');
	await gm.getByRole('button', { name: 'Deal the round', exact: true }).click();

	// --- Initiative: everyone at once, which is what the retry is for. ---
	for (const p of players) {
		await expect(p.page.locator('.hand button').first()).toBeVisible(POLLED);
		await p.page.locator('.hand button').first().click();
	}
	failures.push(...(await violations(players[0].page)));
	// With a card picked, the button that sends it is in a bar pinned to the
	// bottom of the screen (phase 33), and on the phone the bar stays clear of
	// the hand.
	{
		const phone = players[2].page;
		const bar = phone.locator('.move__bar');
		await expect(bar).toBeInViewport();
		await expect(bar.getByRole('button', { name: 'Play as initiative' })).toBeVisible();
		const barTop = (await bar.boundingBox())!.y;
		const handBottom = await phone.evaluate(
			() => document.getElementById('my-hand')!.getBoundingClientRect().bottom
		);
		expect(handBottom).toBeLessThanOrEqual(barTop);
		// One button, not two: Your move doesn't also show it.
		await expect(phone.getByRole('button', { name: 'Play as initiative' })).toHaveCount(1);
		await shot(phone, 'phone-bar');
	}
	await Promise.all(
		players.map((p) => p.page.getByRole('button', { name: 'Play as initiative' }).click())
	);
	// Nobody is told a conflict happened: every initiative lands.
	await expect
		.poll(async () => (await projectionFor(gmContext, token)).state.waitingOn, POLLED)
		.toEqual([expect.stringMatching(/./)]);
	for (const p of players) {
		await expect(
			p.page.locator('.ct-notice, [role="status"]').filter({ hasText: 'got there first' })
		).toHaveCount(0);
	}
	// The GM's for the zombies; the last one down starts the count.
	await gm.locator('.hand button').first().click();
	await gm.getByRole('button', { name: /^Initiative for Zombie/ }).click();
	await expect
		.poll(async () => (await projectionFor(gmContext, token)).state.round.step, POLLED)
		.toBe('turn');

	// --- The GM turns the zombies' initiative over (phase 33), and a player
	// then sees the card. Unless the count is on the zombies already, which
	// turns it over by itself.
	{
		const before = (await projectionFor(players[0].context, token)).state as Projection['state'] & {
			opponents: { id: string }[];
			round: { shown: string[] };
		};
		const zombies = before.opponents[0].id;
		const slot = `opponent:${zombies}:initiative`;
		if (!before.round.shown.includes(zombies)) {
			expect(before.zones[slot].cards).toBeUndefined();
			await gm.getByRole('button', { name: /^Turn over Zombie/ }).click();
			await expect
				.poll(
					async () => (await projectionFor(players[0].context, token)).state.zones[slot].cards,
					POLLED
				)
				.toHaveLength(1);
		}
		await expect(gm.getByRole('button', { name: /^Turn over Zombie/ })).toHaveCount(0, POLLED);
		await expect(players[0].page.getByRole('button', { name: /^Turn over/ })).toHaveCount(0);
	}

	// --- The round, step by step, acting for whoever it waits on. ---
	const pageFor = (holder: string) =>
		holder === gmSeat || !players.some((p) => p.seat === holder)
			? { page: gm, context: gmContext }
			: players.find((p) => p.seat === holder)!;
	const phone = players[2].page;
	/** At phone width: nothing scrolls sideways, and every control is a real target. */
	async function phoneCheck(label: string) {
		const overflow = await phone.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, `${label}: the phone page scrolls sideways`).toBeLessThanOrEqual(0);
		const small = await phone.evaluate(() =>
			[...document.querySelectorAll('.move button, .move select, .actions button, .guide button')]
				.filter((el) => (el as HTMLElement).offsetParent !== null)
				.map((el) => ({ el, r: el.getBoundingClientRect() }))
				.filter(({ r }) => r.height < 43.5 || r.width < 43.5)
				.map(({ el }) => (el.textContent ?? '').trim().slice(0, 30))
		);
		expect(small, `${label}: controls under 44px on the phone`).toEqual([]);
	}
	const phoneShots = new Set<string>();
	let readied = false;
	let declared = false;
	let sawMinor = false;
	let sawResolve = false;
	let outChecked = false;
	let counselled = false;
	let multiAimed = false;

	for (let guard = 0; guard < 30; guard++) {
		const view = (await projectionFor(gmContext, token)).state;
		const step = view.round.step;
		if (step === 'over') break;
		await phoneCheck(step);
		const mineNow =
			(step === 'turn' && view.upNow.includes(players[2].seat)) ||
			(step === 'minor' && view.waitingOn.includes(players[2].seat));
		if (mineNow && !phoneShots.has(step)) {
			phoneShots.add(step);
			await expect(phone.locator('.move')).toBeVisible(POLLED);
			await shot(phone, `phone-${step}`);
		}

		if (step === 'turn') {
			const holder = view.upNow[0];
			const { page } = pageFor(holder);
			// Only the acting pages are told it is their turn. On a tie, more than
			// one is, and each is told who else acts on the number.
			await expect(page.locator('.guide')).toContainText('your turn', POLLED);
			for (const p of players) {
				if (!view.upNow.includes(p.seat)) {
					await expect(p.page.locator('.guide')).not.toContainText('your turn');
				}
			}
			if (!outChecked && view.upNow.every((h) => pageFor(h).page !== gm)) {
				// On a player's turn the GM has neither a turn nor a minor action,
				// and Out of turn still offers a whole play for the groups (Card
				// Table Test 3, note 9): its own action picker and the button.
				outChecked = true;
				const out = gm.locator('.move__out');
				await out.locator('summary').click();
				await expect(
					out.locator('.actions').getByRole('button', { name: 'Attack', exact: true })
				).toBeVisible();
				await expect(
					out.getByRole('button', { name: /^Play out of turn for Zombie/ })
				).toBeVisible();
				// The GM discards a card for the zombies' ability, as a talent's
				// miscellaneous action (Card Table Test 3, note 7): it lands face up
				// on the GM discard and the turn carries on.
				const discards = (await projectionFor(gmContext, token)).state.zones['discard:gm'].count;
				await gm.locator('.hand button').first().click();
				await out.getByLabel('A talent, or something else').fill('Greater doom ability');
				await out.getByRole('radio', { name: 'Discard it (a miscellaneous action)' }).check();
				await out.getByRole('button', { name: /^Discard it for Zombie/ }).click();
				await expect
					.poll(
						async () => (await projectionFor(gmContext, token)).state.zones['discard:gm'].count,
						POLLED
					)
					.toBe(discards + 1);
				expect((await projectionFor(gmContext, token)).state.round.step).toBe('turn');
				await out.locator('summary').click();
			}
			const bystanders = players.filter((p) => !view.upNow.includes(p.seat));
			if (!counselled && bystanders.length >= 2) {
				// Counsel (phase 33): a player who isn't acting hands another a card,
				// with advice, and only the receiver is told which card it was.
				counselled = true;
				const [giver, receiver] = bystanders;
				const out = giver.page.locator('.move__out');
				await out.locator('summary').click();
				await giver.page.locator('.hand button').first().click();
				await out.getByLabel('A talent, or something else').fill('Counsel');
				await out.getByRole('radio', { name: 'Hand it to someone (Counsel)' }).check();
				await out
					.getByRole('combobox', { name: 'To', exact: true })
					.selectOption({ label: receiver.name });
				await out.getByLabel('Advice', { exact: true }).fill('Recover');
				await out.getByRole('button', { name: 'Hand it over' }).click();
				await expect(receiver.page.locator('.ch__hand')).toContainText(
					`From ${giver.name}: Recover`,
					POLLED
				);
				await expect(giver.page.locator('.ch__hand')).not.toContainText('From ');
				expect(Object.keys((await projectionFor(giver.context, token)).state as object)).toContain(
					'counsel'
				);
				await out.locator('summary').click();
			}
			await page.locator('.hand button').first().click();
			if (!readied && page !== gm) {
				// One player readies a Dodge: sideways, kept, labelled.
				await page.locator('.actions').getByRole('button', { name: 'Dodge', exact: true }).click();
				await page.getByRole('button', { name: 'Ready it', exact: true }).click();
				readied = true;
			} else {
				await page.locator('.actions').getByRole('button', { name: 'Attack', exact: true }).click();
				if (!multiAimed) {
					// More than one target (Card Table Test 3, phase 33): both zombies.
					multiAimed = true;
					await page.locator('.aim').getByRole('checkbox', { name: 'Zombie A' }).check();
					await page.locator('.aim').getByRole('checkbox', { name: 'Zombie B' }).check();
					await page.getByRole('button', { name: 'Play it', exact: true }).click();
					await expect
						.poll(async () => {
							const v = (await projectionFor(gmContext, token)).state as Projection['state'] & {
								plays: Record<string, { targets?: string[] }>;
								round: { shown: string[] };
							};
							return Object.values(v.plays).some((p) => p.targets?.length === 2);
						}, POLLED)
						.toBe(true);
					await expect(gm.locator('.play')).toContainText('→ Zombie A, Zombie B', POLLED);
				} else {
					await page.getByRole('button', { name: 'Play it', exact: true }).click();
				}
			}
		} else if (step === 'minor') {
			const waiting = view.waitingOn;
			const holder = waiting[0];
			const { page, context } = pageFor(holder);
			await expect(page.locator('.guide')).toContainText('Any minor actions?', POLLED);
			if (!sawMinor) {
				sawMinor = true;
				failures.push(...(await violations(page)));
				await shot(page, 'round-minor');
			}
			if (!declared && page !== gm && (await page.locator('.hand button').count()) > 0) {
				// One puts a minor action down; it stays face down to everyone else.
				await page.locator('.hand button').first().click();
				await page
					.locator('.actions')
					.getByRole('button', { name: 'Roughhouse', exact: true })
					.click();
				await page.getByRole('button', { name: 'Put it down', exact: true }).click();
				declared = true;
				const mine = players.find((p) => p.page === page)!;
				// Down in their own minor zone — or, when they were the last one the
				// table was waiting on, already turned over into the open with the
				// rest. Waiting on the zone alone timed out whenever the shuffle made
				// this player the last to answer.
				await expect
					.poll(async () => {
						const now = (await projectionFor(context, token)).state;
						const down = now.zones[`seat:${mine.seat}:minor`]?.cards?.length ?? 0;
						const turnedOver = Object.values(now.plays).filter(
							(play) => play.by === mine.seat && play.kind === 'minor'
						).length;
						return down + turnedOver;
					}, POLLED)
					.toBeGreaterThan(0);
				const after = await projectionFor(gmContext, token);
				if (after.state.round.step === 'minor') {
					// Declared to all; the card to nobody else.
					expect(after.state.minorDeclared[`seat:${mine.seat}:minor`]).toBe('Roughhouse');
					expect(after.state.zones[`seat:${mine.seat}:minor`].cards).toBeUndefined();
					for (const other of players) {
						if (other === mine) continue;
						const theirs = await projectionFor(other.context, token);
						expect(theirs.state.zones[`seat:${mine.seat}:minor`].cards).toBeUndefined();
					}
				}
			} else if (
				page === gm &&
				waiting.filter((h) => !players.some((p) => p.seat === h)).length > 1
			) {
				await gm.getByRole('button', { name: 'Pass for all of them' }).click();
			} else {
				await page.getByRole('button', { name: 'Pass', exact: true }).click();
			}
		} else if (step === 'resolve') {
			// Everything face up, labelled with who and what for.
			await expect(gm.locator('.play')).toBeVisible(POLLED);
			if (!sawResolve) {
				sawResolve = true;
				await expect(players[0].page.locator('.play')).toBeVisible(POLLED);
				failures.push(...(await violations(gm)));
				await shot(gm, 'round-resolve');
				await shot(players[0].page, 'round-resolve-player');
			}
			const labels = Object.values(view.plays).map((p) => p.action);
			expect(labels.length).toBeGreaterThan(0);
			// Next sits under the cards, where the GM is already looking (second live test).
			await gm.locator('.play').getByRole('button', { name: /^Next/ }).click();
		}
		// Wait for the round to move on before looking again.
		await expect
			.poll(async () => {
				const now = (await projectionFor(gmContext, token)).state;
				return `${now.round.step}:${now.round.count}:${now.waitingOn.join(',')}:${now.upNow.join(',')}`;
			}, POLLED)
			.not.toBe(
				`${view.round.step}:${view.round.count}:${view.waitingOn.join(',')}:${view.upNow.join(',')}`
			);
	}

	// --- Over: the end-of-round check, said to everyone. ---
	for (const p of [gm, ...players.map((x) => x.page)]) {
		await expect(p.locator('.guide')).toContainText('surrender', POLLED);
	}
	expect(readied).toBe(true);
	expect(outChecked).toBe(true);
	expect(counselled).toBe(true);
	expect(multiAimed).toBe(true);
	// A readied card is kept through the round.
	const end = await projectionFor(gmContext, token);
	expect(players.some((p) => end.state.zones[`seat:${p.seat}:facedown`].count === 1)).toBe(true);
	// On the phone the guide stays on screen when scrolled, and jumps to "Your move".
	await phone.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
	await expect(phone.locator('.guide')).toBeInViewport();
	await phone.locator('.guide').getByRole('link', { name: 'Your move' }).click();
	await expect(phone.locator('#your-hand')).toBeInViewport();
	await shot(gm, 'round-over');
	await phoneCheck('over');
	await shot(phone, 'phone-over');
	failures.push(...(await violations(gm)));

	await gm.locator('.guide').getByRole('button', { name: 'End the round' }).click();
	await expect
		.poll(async () => (await projectionFor(gmContext, token)).state.round.step, POLLED)
		.toBe('deal');

	expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);

	await gmContext.close();
	for (const p of players) await p.context.close();
});
