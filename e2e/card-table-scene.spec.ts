import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 31: the scene and its creatures, played across two browsers.
 *
 * A GM and a guest player, as in card-table.spec.ts. The GM names the zones
 * and brings on lettered zombies with HD; the *player* places themselves and
 * marks the damage, because "anyone can move anyone" is the claim most likely
 * to break quietly — the controls could render for the GM alone and every
 * single-browser test would still pass.
 *
 * Every cross-browser assertion waits on the poll. The database is not reset
 * between local runs, so locators are scoped to this run's names.
 */

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const POLLED = { timeout: 15_000 };
const SHOTS = process.env.SCENE_SCREENSHOTS;

async function signIn(page: Page, name: string, email: string) {
	await page.goto('/');
	await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/auth\/signin/);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="email"]').fill(email);
	await page.getByRole('button', { name: /Dev Login/i }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** WCAG 2.1 AA in both rooms, the same bar card-table-a11y.spec.ts holds. */
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

async function shot(page: Page, name: string) {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test('the scene, lettered creatures and their HD, shared between two browsers', async ({
	browser
}) => {
	const run = Date.now().toString(36);
	const hero = `Tatyana ${run}`;

	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Scene GM', `e2e-scene-gm-${run}@localhost`);
	await gm.goto('/hmtw/cards');
	await gm.locator('input[name="name"]').fill(`Arena ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();

	const playerContext = await browser.newContext();
	const player = await playerContext.newPage();
	await player.goto(roomUrl);
	await player.getByLabel("Your character's name").fill(hero);
	await player.getByRole('button', { name: 'Ask for a seat' }).click();
	await expect(gm.getByText(hero)).toBeVisible(POLLED);
	await gm
		.locator('.ch__waiter, li, span', { hasText: hero })
		.getByRole('button', { name: 'Let in' })
		.first()
		.click();
	await expect(player.getByText(/Waiting for the GM to let you in/)).toHaveCount(0, POLLED);

	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();
	await expect(gm.getByRole('heading', { name: 'Where everyone is' })).toBeVisible();
	await expect(player.getByText('The GM has not named the zones yet.')).toBeVisible(POLLED);

	// --- The GM names the zones. ---
	await gm.getByText('Name the zones…').click();
	await gm.getByRole('textbox', { name: 'Zone 1', exact: true }).fill('Arena');
	await gm.getByRole('textbox', { name: 'Zone 2', exact: true }).fill("King's Pillar");
	await gm.getByRole('button', { name: 'Save the zones' }).click();
	const gmScene = gm.locator('.scene');
	await expect(gmScene.getByText('Arena', { exact: true })).toBeVisible();

	// --- The player places themselves, and the GM sees it. ---
	const playerScene = player.locator('.scene');
	await expect(playerScene.getByText("King's Pillar", { exact: true })).toBeVisible(POLLED);
	await player.getByLabel(`Where ${hero} is`).selectOption({ label: 'Arena' });
	await expect(gmScene.locator('.scene__row', { hasText: 'Arena' })).toContainText(hero, POLLED);

	// --- Three zombies at 1/0, and the King at 4/10. ---
	await gm.getByLabel('Enemy name').fill('Zombie');
	await gm.getByLabel('How many').fill('3');
	await gm.getByLabel('Health', { exact: true }).fill('1');
	await gm.getByLabel('Defense', { exact: true }).fill('0');
	await gm.locator('.add-enemy').getByRole('button', { name: 'Add' }).click();
	await gm.getByLabel('Enemy name').fill('King of Swords');
	await gm.getByLabel('Health', { exact: true }).fill('4');
	await gm.getByLabel('Defense', { exact: true }).fill('10');
	await gm.locator('.add-enemy').getByRole('button', { name: 'Add' }).click();

	// A lone enemy goes by its name; its HD is open, not folded away.
	await expect(gm.getByRole('button', { name: 'King of Swords: Defense down one' })).toBeVisible();
	await expect(gm.getByText('3 of 3 up')).toBeVisible();

	// The GM puts Zombie A on the Pillar.
	await gm.getByText('3 of 3 up').click();
	await gm.getByLabel('Where Zombie A is').selectOption({ label: "King's Pillar" });
	await expect(gmScene.locator('.scene__row', { hasText: "King's Pillar" })).toContainText(
		'Zombie A'
	);

	// --- The player marks the damage and a kill: anyone's, not only the GM's. ---
	await expect(player.getByText('3 of 3 up')).toBeVisible(POLLED);
	await player.getByText('3 of 3 up').click();
	await player.getByRole('button', { name: 'Zombie B: Health down one' }).click();
	await expect(player.getByRole('button', { name: 'Zombie B: Health down one' })).toBeDisabled(
		POLLED
	);
	await player
		.locator('.cr', { hasText: 'Zombie B' })
		.getByRole('button', { name: 'Down', exact: true })
		.click();
	await expect(gm.getByText('2 of 3 up')).toBeVisible(POLLED);
	// Down is crossed out and kept, never removed.
	await expect(gmScene.locator('.scene__who--down', { hasText: 'Zombie B' })).toBeVisible();

	// The player has no "Add an enemy", and cannot move a creature.
	await expect(player.getByLabel('Enemy name')).toHaveCount(0);
	await expect(player.getByLabel('Where Zombie A is')).toBeDisabled();
	// There is no splitting a group, for anyone (phase 32).
	await expect(gm.getByRole('button', { name: /Split off/ })).toHaveCount(0);

	await shot(gm, 'gm-desktop');
	await shot(player, 'player-desktop');

	// --- Health in "Where everyone is", and the GM's switch to hide it. ---
	await expect(playerScene.locator('.scene__who', { hasText: 'Zombie A' })).toContainText('1/1');
	await gm.getByLabel('Players see enemy Health').uncheck();
	await expect(playerScene.locator('.scene__hp')).toHaveCount(0, POLLED);
	await expect(player.getByRole('button', { name: /Health down one/ })).toHaveCount(0);
	await expect(gmScene.locator('.scene__who', { hasText: 'Zombie A' })).toContainText('1/1');
	await gm.getByLabel('Players see enemy Health').check();
	await expect(playerScene.locator('.scene__hp').first()).toBeVisible(POLLED);

	// --- Accessibility, with every new panel open and populated. ---
	expect(await violations(gm)).toEqual([]);
	expect(await violations(player)).toEqual([]);

	// --- And at phone width, where the combatant columns are narrowest. ---
	await player.setViewportSize({ width: 390, height: 844 });
	await shot(player, 'player-phone');
	const overflow = await player.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow, 'the page scrolls sideways at 390px').toBeLessThanOrEqual(0);

	await gmContext.close();
	await playerContext.close();
});

test('an action says what it does, and links to the rule', async ({ page }) => {
	const run = Date.now().toString(36);
	await signIn(page, 'Rules GM', `e2e-rules-gm-${run}@localhost`);
	await page.goto('/hmtw/cards');
	await page.locator('input[name="name"]').fill(`Rules ${run}`);
	await page.getByRole('button', { name: 'Start' }).click();
	await page.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	await page.getByRole('button', { name: 'Challenge', exact: true }).click();

	const line = page.locator('.actions__rule');
	await expect(line).toContainText('Point at an action');

	// Pointing explains, and nothing is chosen.
	await page.getByRole('button', { name: 'Riposte', exact: true }).hover();
	await expect(line).toContainText('Play it facedown. When you are next Attacked or Roughhoused');
	await expect(page.getByRole('link', { name: /Read the rule/ })).toHaveCount(0);

	// A screen reader hears the same words as the button's description.
	await expect(
		page.getByRole('button', { name: 'Riposte', exact: true })
	).toHaveAccessibleDescription(/beat its value to deal them 1 Wound/);

	// Choosing is how a touch screen reads a rule, and it brings the link.
	await page.getByRole('button', { name: 'Vigilance', exact: true }).click();
	await page.mouse.move(0, 0);
	await expect(line).toContainText("A greater doom can't pay for it.");
	const link = page.getByRole('link', { name: /Read the rule: Vigilance/ });
	await expect(link).toHaveAttribute('href', /07-chapter-7-the-challenge-phase--vigilance$/);
	await expect(link).toHaveAttribute('target', '_blank');

	// The link goes somewhere real.
	const href = await link.getAttribute('href');
	const res = await page.request.get(new URL(href!, page.url()).toString());
	expect(res.ok()).toBeTruthy();

	if (SHOTS) {
		await page.locator('.actions').screenshot({ path: `${SHOTS}/actions-chosen.png` });
	}
	expect(await violations(page)).toEqual([]);
});

/**
 * A real 640×400 PNG, made here so the test carries no art: bands of grey, so
 * the browser has something to decode, scale and re-encode, and a screenshot
 * shows how a picture sits on the table.
 */
const TINY_PNG = (() => {
	const w = 640;
	const h = 400;
	const crcTable = Array.from({ length: 256 }, (_, n) => {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		return c >>> 0;
	});
	const crc = (buf: Buffer) => {
		let c = 0xffffffff;
		for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (type: string, data: Buffer) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type), data]);
		const sum = Buffer.alloc(4);
		sum.writeUInt32BE(crc(body));
		return Buffer.concat([len, body, sum]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(w, 0);
	header.writeUInt32BE(h, 4);
	header.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
	const rows = Buffer.alloc((w + 1) * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) rows[y * (w + 1) + 1 + x] = ((x >> 5) + (y >> 5)) % 2 ? 90 : 200;
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0))
	]);
})();

test('a picture of the scene goes up, is seen, and is deleted with the scene', async ({
	browser
}) => {
	const run = Date.now().toString(36);
	const hero = `Regan ${run}`;
	const gmContext = await browser.newContext();
	const gm = await gmContext.newPage();
	await signIn(gm, 'Picture GM', `e2e-picture-gm-${run}@localhost`);
	await gm.goto('/hmtw/cards');
	await gm.locator('input[name="name"]').fill(`Picture ${run}`);
	await gm.getByRole('button', { name: 'Start' }).click();
	await gm.waitForURL(/\/hmtw\/cards\/[0-9a-f-]{36}$/);
	const roomUrl = gm.url();
	const token = roomUrl.split('/').pop()!;

	const playerContext = await browser.newContext();
	const player = await playerContext.newPage();
	await player.goto(roomUrl);
	await player.getByLabel("Your character's name").fill(hero);
	await player.getByRole('button', { name: 'Ask for a seat' }).click();
	await expect(gm.getByText(hero)).toBeVisible(POLLED);
	await gm
		.locator('.ch__waiter, li, span', { hasText: hero })
		.getByRole('button', { name: 'Let in' })
		.first()
		.click();
	await gm.getByRole('button', { name: 'Challenge', exact: true }).click();

	// --- The GM puts a picture up. ---
	gm.on('dialog', (d) => d.accept());
	const chooser = gm.waitForEvent('filechooser');
	await gm.getByRole('button', { name: 'Put up a picture…' }).click();
	await (await chooser).setFiles({ name: 'arena.png', mimeType: 'image/png', buffer: TINY_PNG });
	await expect(gm.getByRole('status')).toHaveText('The picture is up.');
	await expect(gm.getByRole('img', { name: /picture of the scene/ })).toBeVisible();
	await shot(gm, 'gm-picture');

	const pictureId = async () => {
		const res = await gm.request.get(`/api/card-tables/${token}/sync?since=0`);
		return ((await res.json()) as { state: { scene: { picture: { id: string } | null } } }).state
			.scene.picture?.id;
	};
	const firstId = await pictureId();
	expect(firstId).toBeTruthy();

	// What was stored is a re-encoded image, not the file as uploaded.
	const stored = await gm.request.get(`/api/card-tables/${token}/picture?id=${firstId}`);
	expect(stored.ok()).toBeTruthy();
	expect(await stored.text()).toMatch(/^data:image\/(webp|jpeg);base64,/);

	// --- The player sees it, by poll, without the GM's controls. ---
	await expect(player.getByRole('img', { name: "The GM's picture of the scene" })).toBeVisible(
		POLLED
	);
	await expect(player.getByRole('button', { name: /Put up a picture|Take it down/ })).toHaveCount(
		0
	);
	await player.getByRole('button', { name: 'Look closer' }).click();
	await expect(player.getByRole('dialog')).toBeVisible();
	// Look closer means bigger: the first live test found it opened barely
	// wider than its Close button. The picture should use most of the screen.
	const viewport = player.viewportSize();
	const shown = await player.getByRole('dialog').locator('img').boundingBox();
	expect(viewport && shown).toBeTruthy();
	if (viewport && shown) {
		expect(Math.max(shown.width / viewport.width, shown.height / viewport.height)).toBeGreaterThan(
			0.8
		);
	}
	await player.getByRole('button', { name: 'Close', exact: true }).click();

	// A picture cannot be put up by somebody who is not the GM.
	const refused = await player.request.put(`/api/card-tables/${token}/picture`, {
		data: { dataUrl: 'data:image/png;base64,' + TINY_PNG.toString('base64') }
	});
	expect(refused.status()).toBe(403);

	// --- A new scene deletes it: the bytes, not only the pointer. ---
	await gm.getByRole('button', { name: 'New scene' }).click();
	await expect(gm.getByRole('img', { name: /picture of the scene/ })).toHaveCount(0);
	const gone = await gm.request.get(`/api/card-tables/${token}/picture?id=${firstId}`);
	expect(gone.status()).toBe(404);

	// --- So does taking one down. ---
	const again = gm.waitForEvent('filechooser');
	await gm.getByRole('button', { name: 'Put up a picture…' }).click();
	await (await again).setFiles({ name: 'pillar.png', mimeType: 'image/png', buffer: TINY_PNG });
	await expect(gm.getByRole('status')).toHaveText('The picture is up.');
	const secondId = await pictureId();
	expect(secondId).not.toBe(firstId);
	await gm.getByRole('button', { name: 'Take it down' }).click();
	await expect(gm.getByRole('img', { name: /picture of the scene/ })).toHaveCount(0);
	const down = await gm.request.get(`/api/card-tables/${token}/picture?id=${secondId}`);
	expect(down.status()).toBe(404);

	expect(await violations(gm)).toEqual([]);
	await gmContext.close();
	await playerContext.close();
});
