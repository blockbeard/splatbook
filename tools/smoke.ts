/**
 * `npm run smoke -- <base-url>` — post-deploy check that actually exercises SSR.
 *
 * Exists because of what it would have caught. Phase 26's incident (production
 * section pages returning intermittent 503s, then serving 1.43 MB of inlined
 * book) survived every post-deploy check we had, because those checks hit
 * `/api/health` and static pack JSON — neither of which renders a page. A
 * reference route can be completely broken while both answer `ok`.
 *
 * So: fetch a real section page from every game, and assert three things.
 *
 *  - **200.** The obvious one, and the one `/api/health` cannot tell you.
 *  - **The section's own title is in the HTML.** A 200 that rendered an error
 *    body, or an empty shell, is not a working page.
 *  - **The page is under `MAX_PAGE_BYTES`.** This is the regression guard. The
 *    reference's loads are universal, so anything a load fetches is inlined
 *    into the HTML for hydration to replay — which is exactly how one section
 *    page came to weigh 1.43 MB without anything erroring. Page weight is the
 *    symptom that was visible all along and that nothing was watching.
 *
 * Each page is fetched `SAMPLES` times, because the failure was intermittent:
 * roughly 1 request in 12 landed on a cold Worker isolate, and only the cold
 * path inlined the corpus. A single sample would have passed all through the
 * incident.
 *
 * Targets are discovered from the deployed pack's own nav artifact rather than
 * hardcoded, so this keeps testing real URLs across content reimports — and it
 * checks that the nav artifact itself deployed.
 */

const DEFAULT_GAMES = ['stonetop', 'hmtw'];
const SAMPLES = 15;
/**
 * Comfortably above a healthy page and far below a whole book. A cold isolate
 * legitimately inlines the nav spine and the link index alongside the page
 * (~300 KB at Stonetop's size), while the regression this guards against —
 * a load reaching for whole-book trees again — starts at 1.4 MB.
 */
const MAX_PAGE_BYTES = 500_000;

interface NavDoc {
	sections: { id: string; title: string; level: number }[];
}

const baseUrl = (process.argv[2] ?? 'https://splatbook.app').replace(/\/$/, '');
const games = process.argv.slice(3).length ? process.argv.slice(3) : DEFAULT_GAMES;

let failed = false;
const fail = (msg: string) => {
	failed = true;
	console.error(`  ✗ ${msg}`);
};

for (const game of games) {
	console.log(`${game} @ ${baseUrl}`);

	const navUrl = `${baseUrl}/content-packs/${game}/rules/nav.json`;
	const navRes = await fetch(navUrl);
	if (!navRes.ok) {
		fail(`nav artifact ${navUrl} -> ${navRes.status}`);
		continue;
	}
	const nav = (await navRes.json()) as NavDoc[];
	// A section deep enough to have real prose under it, not just a chapter
	// opener — the pages a reader actually lands on mid-session.
	const target =
		nav.flatMap((d) => d.sections).find((s) => s.level >= 3) ??
		nav.flatMap((d) => d.sections)[0];
	if (!target) {
		fail(`nav artifact for ${game} lists no sections`);
		continue;
	}

	const url = `${baseUrl}/${game}/reference/${target.id}`;
	let worst = 0;
	let ok = 0;
	for (let i = 0; i < SAMPLES; i++) {
		const res = await fetch(url);
		const body = await res.text();
		worst = Math.max(worst, body.length);
		if (res.status !== 200) {
			fail(`${url} -> ${res.status} (sample ${i + 1})`);
			break;
		}
		if (!body.includes(target.title)) {
			fail(`${url} rendered 200 without its own title "${target.title}" (sample ${i + 1})`);
			break;
		}
		ok++;
	}

	if (ok === SAMPLES) {
		const verdict = worst > MAX_PAGE_BYTES ? 'FAIL' : 'ok';
		const line =
			`  ${verdict === 'ok' ? '✓' : '✗'} ${target.id} — ${ok}/${SAMPLES} × 200, ` +
			`worst ${(worst / 1024).toFixed(0)} KB`;
		if (verdict === 'ok') console.log(line);
		else
			fail(
				`${line.trim()} — over ${(MAX_PAGE_BYTES / 1024).toFixed(0)} KB, so a load is ` +
					`pulling far more than one section (see tools/build_pages.ts)`
			);
	}
}

process.exit(failed ? 1 : 0);
