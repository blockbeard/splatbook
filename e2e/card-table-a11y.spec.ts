import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * WCAG 2.1 AA over the card table, in every state it has and in both rooms.
 *
 * This exists because the palette is monochrome and has nothing but *value* to
 * spend, so a colour here is one measurement away from failing 1.4.3 and the
 * failure is invisible to whoever made it — the first audit found thirty-four
 * violations from a single token being 55% ink instead of 75%, and one rule
 * that had never been looked at in the light room at all. A design like that
 * needs a guard rather than a memory.
 *
 * Automated scanning catches roughly a third of accessibility problems; the
 * rest are in `card-table.spec.ts` (the live region, keyboard operation) or
 * were checked by hand at the time. This is the third, kept honest.
 */

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

interface AxeIssue {
	id: string;
	impact: string | null;
	nodes: { target: string[]; any?: { message?: string }[] }[];
}
interface AxeResult {
	violations: AxeIssue[];
	/** Checks axe declined to judge. Not all of these are failures — see below. */
	incomplete: AxeIssue[];
}

/** Scan the page as it stands, in both rooms. Returns the failures, flattened. */
async function scan(page: Page, label: string): Promise<string[]> {
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
		)) as AxeResult;
		for (const v of result.violations) {
			for (const n of v.nodes) found.push(`${label} [${theme}] ${v.id} — ${n.target.join(' ')}`);
		}
		/*
		 * Contrast checks axe would not commit to — and the reason this is here.
		 *
		 * axe reports a **1:1 ratio as `incomplete`, not as a violation**: text
		 * the same colour as its background is usually decorative or covered by
		 * something, so it declines to judge. Which means a spec reading only
		 * `violations` is blind to the worst contrast failure there is, and this
		 * one was: a chosen action was lettered bone-on-bone in dark mode for
		 * seven commits with the sweep green throughout.
		 *
		 * Only `color-contrast` incompletes are treated as failures. The rest
		 * (background images, gradients) are genuinely undecidable from the DOM
		 * and would be noise.
		 */
		for (const v of result.incomplete) {
			if (v.id !== 'color-contrast') continue;
			for (const n of v.nodes) {
				const why = n.any?.[0]?.message ?? '';
				// Only the same-colour case. axe phrases that one as "Element has a
				// 1:1 contrast ratio with the background"; its other incompletes are
				// things like a glyph with no text characters or a background image,
				// which really are undecidable from the DOM and would be noise —
				// the shell's ◐ theme toggle raises one on every page.
				if (!/contrast ratio with the background/.test(why)) continue;
				found.push(`${label} [${theme}] invisible text — ${n.target.join(' ')} — ${why}`);
			}
		}
	}
	await page.evaluate(() => document.documentElement.classList.remove('dark'));
	return found;
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

test('the table meets WCAG 2.1 AA in every state, in both rooms', async ({ browser }) => {
	// Some eighteen states, each scanned in two rooms: well past the default budget.
	test.setTimeout(240_000);
	const run = Date.now().toString(36);
	const failures: string[] = [];

	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'A11y GM', `a11y-gm-${run}@localhost`);

	await gm.goto('/hmtw/cards');
	failures.push(...(await scan(gm, 'index')));

	await gm.locator('input[name="name"]').fill(`A11y ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();
	failures.push(...(await scan(gm, 'decks')));

	// The two overlays. They sit on the *recessed* ground rather than the table,
	// which is the surface that decides how dark the quiet token may be — and
	// the first audit never opened either of them.
	// A flip goes to the fate slot, not the discard — that is what a Test of
	// Fate is — so putting something in a discard takes both steps. "look
	// through" only exists on a discard, and only once there is one.
	await gm.getByRole('button', { name: 'Turn one over' }).first().click();
	await gm.getByRole('button', { name: 'Into the discard' }).click({ timeout: 15_000 });
	await gm.getByRole('button', { name: 'look through' }).first().click({ timeout: 15_000 });
	await expect(gm.locator('.pane')).toBeVisible();
	failures.push(...(await scan(gm, 'discard pane')));
	await gm.getByRole('button', { name: 'Look closer' }).first().click();
	failures.push(...(await scan(gm, 'zoomed card')));
	await gm.keyboard.press('Escape');
	await gm.keyboard.press('Escape');

	// A watcher, then somebody waiting on the GM.
	const pc = await browser.newContext();
	const player = await pc.newPage();
	await player.goto(roomUrl);
	failures.push(...(await scan(player, 'watching')));
	await player.getByLabel("Your character's name").fill(`Grimwold ${run}`);
	await player.getByRole('button', { name: 'Ask for a seat' }).click();
	failures.push(...(await scan(player, 'waiting')));

	await expect(gm.getByText(`Grimwold ${run}`)).toBeVisible({ timeout: 15_000 });
	await gm.getByRole('button', { name: 'Let in' }).first().click();

	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();

	// The deal panel, open. It auto-opens on a table that has never dealt and
	// closes once it has, so scanning only after the deal would have left the
	// checklist — six checkboxes, two number fields and a note — audited
	// nowhere at all. That coverage was lost the moment it went behind a
	// disclosure, which is exactly the kind of thing a redesign takes with it
	// quietly.
	await expect(gm.getByText('The GM draws')).toBeVisible({ timeout: 15_000 });
	failures.push(...(await scan(gm, 'deal panel, open')));

	await gm.getByRole('button', { name: 'Deal the round', exact: true }).click();
	await expect(gm.getByText('Lesser dooms', { exact: false })).toBeVisible({ timeout: 15_000 });
	failures.push(...(await scan(gm, 'challenge, dealt')));

	// A Challenge discard opened to look through. The first live test found it
	// could not be opened at all; a mulligan is the quickest way to fill one.
	await gm.getByRole('button', { name: 'Mulligan' }).click();
	await gm.locator('.ch__decks').getByRole('button', { name: 'look through' }).click({
		timeout: 15_000
	});
	await expect(gm.locator('.pane')).toBeVisible();
	failures.push(...(await scan(gm, 'challenge discard pane')));
	await gm.keyboard.press('Escape');
	await expect(gm.locator('.pane')).toHaveCount(0);

	await expect(player.locator('.hand button').first()).toBeVisible({ timeout: 15_000 });
	failures.push(...(await scan(player, 'challenge, player')));

	// A card in hand, at initiative: "Your move" offers Play as initiative.
	await player.locator('.hand button').first().click();
	failures.push(...(await scan(player, 'card picked up, initiative')));

	// Holding a card offers no inspiration slot to a player, not even their own:
	// inspiration is the GM's to hand out (Card Table Test 3, phase 33).
	await expect(player.getByRole('button', { name: /Give .* an inspiration card/ })).toHaveCount(0);

	// The only initiative down starts the count: the player's turn (phase 32).
	await player.getByRole('button', { name: 'Play as initiative' }).click();
	await expect(player.getByText(/— your turn: play a card or skip\./)).toBeVisible({
		timeout: 15_000
	});
	failures.push(...(await scan(player, 'your turn')));

	// An action *chosen*, which is a different state from a card being held and
	// was never on screen while axe was looking. It shipped for seven commits
	// with the chosen action lettered bone-on-bone in dark mode — a fill and a
	// label that are the same value there — because nothing in the sweep ever
	// pressed one.
	await player.locator('.hand button').first().click();
	// A talent typed in, with how the card is played (phase 33).
	await player.getByLabel('A talent, or something else').fill('Doom Eye');
	await expect(player.getByRole('radio', { name: 'Play it now (face up)' })).toBeChecked();
	failures.push(...(await scan(player, 'talent typed')));
	await player.getByLabel('A talent, or something else').fill('');
	await player.locator('.actions').getByRole('button', { name: 'Attack', exact: true }).click();
	failures.push(...(await scan(player, 'action chosen')));
	await player.getByRole('button', { name: 'Play it', exact: true }).click();

	// The card face up in the open, labelled, waiting on the GM (phase 32).
	await expect(gm.locator('.play')).toContainText('Attack', { timeout: 15_000 });
	failures.push(...(await scan(gm, 'in play, resolving')));
	await gm.locator('.guide').getByRole('button', { name: 'Next' }).click();
	await expect(gm.locator('.guide')).toContainText('surrender', { timeout: 15_000 });
	failures.push(...(await scan(gm, 'round over')));

	// Phase 31's states: the zone editor open, a scene with somebody placed, and
	// a group of creatures unfolded with its Health and Defense steppers — the
	// densest controls on the table, and the ones a player now touches mid-fight.
	await gm.getByText('Name the zones…').click();
	await gm.getByRole('textbox', { name: 'Zone 1', exact: true }).fill('Nave');
	await gm.getByRole('textbox', { name: 'Zone 2', exact: true }).fill('Altar');
	failures.push(...(await scan(gm, 'zone editor')));
	await gm.getByRole('button', { name: 'Save the zones' }).click();
	await expect(gm.locator('.scene').getByText('Altar', { exact: true })).toBeVisible();
	await player.getByLabel(`Where Grimwold ${run} is`).selectOption({ label: 'Nave' });
	// Wait for the GM's page to catch up first. A command sent from a version
	// behind is refused as a conflict and not sent again (phase 32 changes that
	// for the round's own steps), so "Add" would be lost.
	await expect(gm.locator('.scene__row', { hasText: 'Nave' })).toContainText(`Grimwold ${run}`, {
		timeout: 15_000
	});
	await gm.getByLabel('Enemy name').fill('Zombie');
	await gm.getByLabel('How many').fill('3');
	await gm.getByLabel('Health', { exact: true }).fill('4');
	await gm.getByLabel('Defense', { exact: true }).fill('2');
	await gm.locator('.add-enemy').getByRole('button', { name: 'Add' }).click();
	await gm.getByText('3 of 3 up').click();
	await gm
		.locator('.cr', { hasText: 'Zombie B' })
		.getByRole('button', { name: 'Down', exact: true })
		.click();
	await expect(gm.getByText('2 of 3 up')).toBeVisible({ timeout: 15_000 });
	failures.push(...(await scan(gm, 'scene and creatures, GM')));
	await expect(player.getByText('2 of 3 up')).toBeVisible({ timeout: 15_000 });
	await player.getByText('2 of 3 up').click();
	failures.push(...(await scan(player, 'scene and creatures, player')));

	expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);

	await gmContext.close();
	await pc.close();
});
