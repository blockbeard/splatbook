/**
 * `npx tsx tools/cold-start.ts` — what a fresh Worker isolate's first requests cost.
 *
 * Exists because of Session 14's 1102 (phase 33). Workers Free allows 10 ms of
 * CPU per request, and the steady state is far under it (`cpu-sim.test.ts`),
 * but a new isolate is not the steady state. Wrangler bundles `_worker.js`
 * with esbuild, which wraps the app's modules in lazy initialisers, so a
 * route's modules are first evaluated inside the first request that imports
 * them. Measured on 2026-11-26, the first card-table request cost 64 ms and
 * the same request warm cost 1 ms.
 *
 * This builds the same bundle from `.svelte-kit/cloudflare` (so run
 * `ADAPTER=cloudflare npm run build` first), stubs what Cloudflare provides
 * (`cloudflare:workers`, D1, `ASSETS`, `caches`), and runs each scenario in a
 * fresh node process, so every one starts cold:
 *
 * - startup: importing the bundle (its top level);
 * - the first, second and third request to a route;
 * - the same, with startup allowed to run to the end of its pending work, so
 *   `server.init` (and the hooks' `init`) has finished before the first
 *   request. That is the case where Cloudflare drains startup's microtasks
 *   before serving, and it is what moving work into `init` buys (commit 3).
 *   Which case Cloudflare is in, this can't tell: compare the first requests'
 *   CPU time in `wrangler pages deployment tail --format json` after a deploy.
 *
 * The stub D1 answers every query with no rows, so a table route finds no
 * table and stops at its first query. That is enough to load every module the
 * route needs and to run the framework, the hooks, Auth.js and the handler up
 * to there, which is the part a cold isolate pays for.
 *
 * Numbers are from node on whatever machine runs this; a Worker is slower.
 * Compare scenarios with each other, not with 10 ms. Node's own fetch
 * internals are warmed before anything is timed, because a Worker's are
 * native and they would otherwise add about 10 ms to every first request.
 */

import { build } from 'esbuild';
import { encode } from '@auth/core/jwt';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKER = '.svelte-kit/cloudflare/_worker.js';
if (!existsSync(WORKER)) {
	console.error(`No ${WORKER}. Run \`ADAPTER=cloudflare npm run build\` first.`);
	process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'splatbook-cold-'));
const SECRET = 'cold-start-secret-'.padEnd(48, 'x');
const COOKIE = '__Secure-authjs.session-token';

writeFileSync(join(dir, 'cf-stub.mjs'), 'export const env = globalThis.__cfEnv;\n');
await build({
	entryPoints: [WORKER],
	bundle: true,
	format: 'esm',
	platform: 'neutral',
	mainFields: ['workerd', 'worker', 'browser', 'module', 'main'],
	conditions: ['workerd', 'worker', 'browser', 'import'],
	external: ['node:*'],
	logLevel: 'error',
	outfile: join(dir, 'worker.mjs'),
	plugins: [
		{
			name: 'cloudflare-stub',
			setup(b) {
				b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: join(dir, 'cf-stub.mjs') }));
			}
		}
	]
});

// A signed-in GM's session, as Auth.js would set it: the jwt callback copies
// the user id onto the token, and every request decodes it.
const session = await encode({
	token: { sub: 'cold-start-user', id: 'cold-start-user', name: 'GM' },
	secret: SECRET,
	salt: COOKIE
});

writeFileSync(
	join(dir, 'drive.mjs'),
	`
const rows = { results: [], success: true, meta: {} };
const stmt = { bind() { return stmt; }, all: async () => rows, raw: async () => [], first: async () => null, run: async () => rows };
globalThis.__cfEnv = {
	DB: { prepare: () => stmt, batch: async (s) => s.map(() => rows), exec: async () => ({}) },
	ASSETS: { fetch: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) },
	AUTH_SECRET: ${JSON.stringify(SECRET)},
	AUTH_DEV_LOGIN: 'false'
};
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
// Node's own fetch machinery (undici) loads lazily on first use and costs about
// 10 ms; a Worker's is native. Warm it here so it isn't counted as the app's.
await new Response('{}').json();
new Request('https://warm.test/', { method: 'POST', body: '{}' });
new Headers({ a: 'b' });
const ctx = { waitUntil() {}, passThroughOnException() {} };
const [route, signedIn, warmFirst] = process.argv.slice(2);
const cookie = signedIn === 'yes' ? { cookie: ${JSON.stringify(`${COOKIE}=${session}`)} } : {};
const paths = {
	sync: ['/api/card-tables/none/sync?since=0'],
	commands: ['/api/card-tables/none/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command: { type: 'step-on' }, expectedVersion: 1, requestHash: 'abcdefgh' }) }],
	page: ['/hmtw/cards/none'],
	health: ['/api/health']
};
const cpu = async (fn) => {
	const before = process.cpuUsage();
	await fn();
	const used = process.cpuUsage(before);
	return +((used.user + used.system) / 1000).toFixed(1);
};
let worker;
const startup = await cpu(async () => {
	worker = (await import('./worker.mjs')).default;
	// Let startup's pending promises settle, server.init included.
	if (warmFirst === 'yes') for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
});
const send = ([path, init = {}]) =>
	worker.fetch(new Request('https://splatbook.app' + path, { ...init, headers: { ...(init.headers ?? {}), ...cookie } }), globalThis.__cfEnv, ctx);
const out = { startup };
out.first = await cpu(() => send(paths[route]));
out.second = await cpu(() => send(paths[route]));
out.third = await cpu(() => send(paths[route]));
console.log(JSON.stringify(out));
`
);

const scenarios: [string, string, string][] = [];
for (const route of ['sync', 'commands', 'page']) {
	for (const signedIn of ['no', 'yes']) {
		for (const warmFirst of ['no', 'yes']) scenarios.push([route, signedIn, warmFirst]);
	}
}

const rows = scenarios.map(([route, signedIn, warmFirst]) => {
	const out = JSON.parse(
		execFileSync(process.execPath, [join(dir, 'drive.mjs'), route, signedIn, warmFirst], {
			cwd: dir,
			encoding: 'utf8'
		}).trim()
	) as Record<string, number>;
	return {
		route,
		'signed in': signedIn,
		'init at startup': warmFirst,
		'startup ms': out.startup,
		'first ms': out.first,
		'second ms': out.second,
		'third ms': out.third
	};
});
console.log(`\nCold Worker, CPU per request in node (bundle in ${dir}):`);
console.table(rows);
