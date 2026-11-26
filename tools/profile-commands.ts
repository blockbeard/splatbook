/**
 * `npx tsx tools/profile-commands.ts` — where a card-table command's CPU goes, in workerd.
 *
 * Card Table Test 3 (phase 33) measured commands on Cloudflare at 11 ms of CPU
 * usual, half over Workers Free's 10 ms, while the same service code takes
 * under half a millisecond in node (`cpu-sim.test.ts`). Node can't say why. This
 * runs the built Worker in workerd itself, through Miniflare, with a real local
 * D1, so the runtime, the bindings and the bundle are Cloudflare's.
 *
 * It bundles `.svelte-kit/cloudflare/_worker.js` as Wrangler does (run
 * `ADAPTER=cloudflare npm run build` first), migrates a fresh local D1, seeds a
 * table with a GM and three players, and plays it with the same random players
 * as the simulation (`sim-players.ts`), every command and poll over HTTP. Each
 * request's wall time is reported, though in workerd that includes waiting on
 * the local D1, which runs as another service; the CPU figure comes from a
 * profile taken through the inspector over the whole run (idle excluded),
 * attributed to the source module each function came from.
 *
 *   npx tsx tools/profile-commands.ts [rounds]
 *
 * Writes the raw profile next to the bundle, for Chrome DevTools if wanted.
 */

import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { drizzle } from 'drizzle-orm/d1';
import { encode } from '@auth/core/jwt';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as schema from '../src/lib/server/db/schema.ts';
import type { Db } from '../src/lib/server/db/entities.ts';
import {
	createCardTable,
	getCardTableByToken,
	listSeats
} from '../src/lib/server/db/card-tables.ts';
import { admitSeat, claimGmSeat, requestSeat } from '../src/lib/server/db/card-table-seats.ts';
import { SEAT_COOKIE } from '../src/lib/seat-claims.ts';
import { hmtwCardTable } from '../src/lib/games/hmtw/card-table.ts';
import { seededRng, type CardTable } from '../src/lib/games/hmtw/engine/index.ts';
import { chooser, nextMove, type Command, type Seat } from './sim-players.ts';

const ROUNDS = Number(process.argv[2] ?? 12);
const WORKER = '.svelte-kit/cloudflare/_worker.js';
const ASSETS_ROOT = '.svelte-kit/cloudflare';
if (!existsSync(WORKER)) {
	console.error(`No ${WORKER}. Run \`ADAPTER=cloudflare npm run build\` first.`);
	process.exit(1);
}

// Inside the project (`.wrangler/` is ignored): workerd won't load a module from
// a path that climbs out of the directory it was started in.
mkdirSync('.wrangler', { recursive: true });
const dir = mkdtempSync(join('.wrangler', 'profile-'));
const bundle = join(dir, 'worker.mjs');
await build({
	entryPoints: [WORKER],
	bundle: true,
	format: 'esm',
	platform: 'neutral',
	mainFields: ['workerd', 'worker', 'browser', 'module', 'main'],
	conditions: ['workerd', 'worker', 'browser', 'import'],
	external: ['cloudflare:*', 'node:*'],
	logLevel: 'error',
	outfile: bundle
});

const SECRET = 'profile-secret-'.padEnd(48, 'x');
const INSPECTOR = 9239;
const mf = new Miniflare({
	// Listed by hand: the bundle keeps one non-literal `import()` (the node-only
	// SQLite driver in `db/index.ts`), which Miniflare's module finder refuses.
	modules: [{ type: 'ESModule', path: bundle }],
	compatibilityDate: '2025-07-01',
	compatibilityFlags: ['nodejs_compat'],
	d1Databases: { DB: 'profile-db' },
	bindings: { AUTH_SECRET: SECRET, ORIGIN: 'https://splatbook.app', AUTH_DEV_LOGIN: 'false' },
	serviceBindings: {
		// Pages serves static files from here; the table reads its pack this way.
		ASSETS: async (request) => {
			const path = join(ASSETS_ROOT, decodeURIComponent(new URL(request.url).pathname));
			if (!existsSync(path)) return new Response('not found', { status: 404 });
			return new Response(readFileSync(path), {
				headers: { 'content-type': path.endsWith('.json') ? 'application/json' : 'text/plain' }
			});
		}
	},
	inspectorPort: INSPECTOR
});

/* ---- A fresh database and a seeded table ------------------------------------- */

const d1 = await mf.getD1Database('DB');
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
	entries: { tag: string }[];
};
for (const { tag } of journal.entries) {
	const sql = readFileSync(`drizzle/${tag}.sql`, 'utf8');
	for (const statement of sql.split('--> statement-breakpoint')) {
		if (statement.trim()) await d1.prepare(statement).run();
	}
}
const db = drizzle(d1 as never, { schema }) as unknown as Db;

const pack = Object.fromEntries(
	await Promise.all(
		hmtwCardTable.packFiles.map(async (f) => [
			f,
			JSON.parse(await readFile(`static/content-packs/hmtw/${f}`, 'utf8'))
		])
	)
);

const [user] = await db.insert(schema.users).values({ email: 'gm@profile.test' }).returning();
const opening = hmtwCardTable.create(pack as never, seededRng(3));
const created = await createCardTable(db, {
	gameId: 'hmtw',
	name: 'Profile',
	ownerId: user.id,
	state: opening.state,
	stateVersion: opening.stateVersion
});
if (!created.ok) throw new Error(created.reason);
const table = created.table;
const token = table.roomToken;

interface Client extends Seat {
	cookie: string;
}
const clients: Client[] = [];
for (const name of ['The GM', 'Firefox', 'Safari', 'Claude']) {
	const asked = await requestSeat(db, table.id, name);
	if (!asked.ok) throw new Error(asked.reason);
	const seatId = asked.ticket.seat.id;
	const isGm = clients.length === 0;
	if (isGm) await claimGmSeat(db, table.id, seatId);
	else await admitSeat(db, table.id, seatId, clients[0].id);
	clients.push({
		id: seatId,
		claim: { seatId, secret: asked.ticket.secret },
		isGm,
		version: 0,
		cookie: `${SEAT_COOKIE}=${encodeURIComponent(`${token}.${seatId}.${asked.ticket.secret}`)}`
	});
}
// The GM is signed in, as Chris is: every one of their requests decodes a JWT.
const session = await encode({
	token: { sub: user.id, id: user.id, name: 'GM' },
	secret: SECRET,
	salt: '__Secure-authjs.session-token'
});
clients[0].cookie += `; __Secure-authjs.session-token=${session}`;

/* ---- Timing ---------------------------------------------------------------------- */

const samples: { kind: string; ms: number; at: number }[] = [];
async function timed(kind: string, path: string, init: RequestInit = {}) {
	const t0 = performance.now();
	const res = await mf.dispatchFetch(`https://splatbook.app${path}`, init as never);
	const body = res.status === 204 ? null : await res.text();
	samples.push({ kind, ms: performance.now() - t0, at: samples.length });
	return { status: res.status, body };
}

const command = (by: Client, body: Command, expectedVersion: number) =>
	timed(`command ${body.type}`, `/api/card-tables/${token}/commands`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', cookie: by.cookie },
		body: JSON.stringify({ command: body, expectedVersion, requestHash: crypto.randomUUID() })
	});

const poll = (by: Client) =>
	timed(
		'poll',
		`/api/card-tables/${token}/sync?since=${by.version}${by.stamp ? `&stamp=${by.stamp}` : ''}`,
		{ headers: { cookie: by.cookie } }
	).then((r) => {
		if (r.status === 200 && r.body) {
			const view = JSON.parse(r.body) as { version: number; stamp: string };
			by.version = view.version;
			by.stamp = view.stamp;
		}
		return r;
	});

/* ---- The inspector ---------------------------------------------------------------- */

const targets = (await (await fetch(`http://127.0.0.1:${INSPECTOR}/json`)).json()) as {
	webSocketDebuggerUrl: string;
	title?: string;
	url?: string;
}[];
const target = targets.find((t) => /core:user|worker/i.test(`${t.title} ${t.url}`)) ?? targets[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	ws.onopen = resolve;
	ws.onerror = reject;
});
let nextId = 1;
const pending = new Map<number, (v: unknown) => void>();
ws.onmessage = (m) => {
	const msg = JSON.parse(String(m.data)) as { id?: number; result?: unknown };
	if (msg.id && pending.has(msg.id)) {
		pending.get(msg.id)!(msg.result);
		pending.delete(msg.id);
	}
};
const cdp = (method: string, params: object = {}) =>
	new Promise<unknown>((resolve) => {
		const id = nextId++;
		pending.set(id, resolve);
		ws.send(JSON.stringify({ id, method, params }));
	});

/* ---- Play --------------------------------------------------------------------------- */

const choose = chooser(14);
const progress = { round: 0, fights: 0 };
// First contact: every client's opening poll, which also warms the isolate's
// framework the way a page load would.
for (const c of clients) await poll(c);

await cdp('Profiler.enable');
await cdp('Profiler.setSamplingInterval', { interval: 100 });
await cdp('Profiler.start');

let guard = 0;
let commands = 0;
while (progress.round < ROUNDS && guard++ < ROUNDS * 400) {
	// The players decide from the stored table, read here in node rather than
	// through the Worker, so deciding costs the Worker nothing.
	const row = await getCardTableByToken(db, token);
	if (!row) throw new Error('table gone');
	const seats = (await listSeats(db, row.id))
		.filter((s) => s.status === 'admitted')
		.map((s) => ({ id: s.id, isGm: s.isGm }));
	const state = hmtwCardTable.syncSeats(hmtwCardTable.migrate(row.state, pack).state, seats);
	const move = nextMove(state as CardTable, clients, choose, progress);
	if (!move) break;
	const by = move.by as Client;
	const reply = await command(by, move.command, row.version);
	commands++;
	if (reply.status === 200) {
		for (const c of clients) if (c !== by) await poll(c);
	}
}

const { profile } = (await cdp('Profiler.stop')) as { profile: CpuProfile };

// One request per profile window: the CPU of that request alone, idle excluded.
const commandProfiles: CpuProfile[] = [];
// Commands are drawn from the same players, so each is a real move.
const alone = { command: [] as number[], poll: [] as number[] };
const busyIn = (p: CpuProfile) => {
	const idleIds = new Set(
		p.nodes.filter((n) => n.callFrame.functionName === '(idle)').map((n) => n.id)
	);
	return p.samples.reduce((sum, id, i) => sum + (idleIds.has(id) ? 0 : (p.timeDeltas[i] ?? 0)), 0) / 1000;
};
for (let i = 0; i < 40 && progress.round < ROUNDS + 3; i++) {
	const row = await getCardTableByToken(db, token);
	if (!row) break;
	const seats = (await listSeats(db, row.id))
		.filter((s) => s.status === 'admitted')
		.map((s) => ({ id: s.id, isGm: s.isGm }));
	const state = hmtwCardTable.syncSeats(hmtwCardTable.migrate(row.state, pack).state, seats);
	const move = nextMove(state as CardTable, clients, choose, progress);
	if (!move) break;
	await cdp('Profiler.start');
	const reply = await command(move.by as Client, move.command, row.version);
	const one = (await cdp('Profiler.stop')) as { profile: CpuProfile };
	if (reply.status === 200) {
		alone.command.push(busyIn(one.profile));
		commandProfiles.push(one.profile);
	}
	const watcher = clients.find((c) => c !== move.by)!;
	await cdp('Profiler.start');
	await poll(watcher);
	const p2 = (await cdp('Profiler.stop')) as { profile: CpuProfile };
	alone.poll.push(busyIn(p2.profile));
	// And the poll that finds nothing, which is most of them.
	await cdp('Profiler.start');
	await poll(watcher);
	const p3 = (await cdp('Profiler.stop')) as { profile: CpuProfile };
	(alone as Record<string, number[]>)['poll, nothing new'] ??= [];
	(alone as Record<string, number[]>)['poll, nothing new'].push(busyIn(p3.profile));
	for (const c of clients) if (c !== watcher && c !== move.by) await poll(c);
}
ws.close();
await mf.dispose();
writeFileSync(join(dir, 'commands.cpuprofile'), JSON.stringify(profile));

/* ---- Report ------------------------------------------------------------------------- */

const byKind = new Map<string, number[]>();
for (const s of samples) {
	const kind = s.kind.startsWith('command') ? 'command (all)' : s.kind;
	byKind.set(kind, [...(byKind.get(kind) ?? []), s.ms]);
	if (s.kind.startsWith('command')) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.ms]);
}
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
console.log(`\n${progress.round} rounds, ${commands} commands, in workerd. Wall ms per request:`);
console.table(
	[...byKind.entries()]
		.sort((a, b) => b[1].length - a[1].length)
		.map(([kind, xs]) => ({
			kind,
			n: xs.length,
			p50: +q(xs, 0.5).toFixed(2),
			p90: +q(xs, 0.9).toFixed(2),
			max: +Math.max(...xs).toFixed(2)
		}))
);
console.log('\nCPU of one request, profiled alone (ms, idle excluded):');
console.table(
	Object.entries(alone).map(([kind, xs]) => ({
		kind,
		n: xs.length,
		p50: +q(xs, 0.5).toFixed(2),
		p90: +q(xs, 0.9).toFixed(2),
		max: +Math.max(...xs).toFixed(2)
	}))
);
const firstCommands = samples.filter((s) => s.kind.startsWith('command')).slice(0, 10);
console.log('The first ten commands, wall ms:', firstCommands.map((s) => +s.ms.toFixed(1)));

interface CpuProfile {
	nodes: {
		id: number;
		callFrame: { functionName: string; url: string; lineNumber: number };
		children?: number[];
	}[];
	samples: number[];
	timeDeltas: number[];
}

// Which source module each line of the bundle came from: esbuild marks each
// module with a `// path` comment.
const lines = readFileSync(bundle, 'utf8').split('\n');
const moduleAt: string[] = [];
let current = '(bundle prelude)';
for (const line of lines) {
	const m = /^\/\/ (\S+\.(?:js|ts|mjs|cjs|svelte))$/.exec(line);
	if (m) {
		const path = m[1];
		current = path.includes('node_modules/')
			? (path.split('node_modules/').pop()!.match(/^(@[^/]+\/[^/]+|[^/]+)/)?.[0] ?? path)
			: path.replace(/^.*output\/server\//, '');
	}
	moduleAt.push(current);
}
const self = new Map<number, number>();
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
const byModule = new Map<string, number>();
const byFunction = new Map<string, number>();
for (const node of profile.nodes) {
	const us = self.get(node.id) ?? 0;
	if (!us) continue;
	const { functionName, url, lineNumber } = node.callFrame;
	const where = url.endsWith('worker.mjs')
		? (moduleAt[lineNumber] ?? '?')
		: url
			? url
			: `(${functionName || 'runtime'})`;
	byModule.set(where, (byModule.get(where) ?? 0) + us);
	const fn = `${functionName || '(anonymous)'} — ${where}`;
	byFunction.set(fn, (byFunction.get(fn) ?? 0) + us);
}
const total = [...byModule.values()].reduce((a, b) => a + b, 0);
const top = (m: Map<string, number>, n: number) =>
	[...m.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([k, us]) => ({ where: k, ms: +(us / 1000).toFixed(1), '%': +((100 * us) / total).toFixed(1) }));
// Wall time in workerd includes waiting on the local D1 (another service), so
// it isn't CPU. The profile is: everything sampled except the idle thread.
const idle = byModule.get('((idle))') ?? 0;
const busy = total - idle;
const requests = samples.length;
console.log(
	`\nCPU (profile, idle excluded): ${(busy / 1000).toFixed(0)} ms over ${requests} requests, ` +
		`${(busy / 1000 / requests).toFixed(2)} ms a request on average ` +
		`(${commands} commands, ${requests - commands} polls).`
);
console.log(`By source module (${(total / 1000).toFixed(0)} ms sampled, idle included):`);
console.table(top(byModule, 25));
console.log('By function:');
console.table(top(byFunction, 30));
// Where a command's own CPU goes: the command windows pooled.
const pooled = new Map<string, number>();
const pooledByModule = new Map<string, number>();
for (const p of commandProfiles) {
	const own = new Map<number, number>();
	p.samples.forEach((id, i) => own.set(id, (own.get(id) ?? 0) + (p.timeDeltas[i] ?? 0)));
	for (const node of p.nodes) {
		const us = own.get(node.id) ?? 0;
		if (!us || node.callFrame.functionName === '(idle)') continue;
		const { functionName, url, lineNumber } = node.callFrame;
		const where = url.endsWith('worker.mjs') ? (moduleAt[lineNumber] ?? '?') : url || '(runtime)';
		pooledByModule.set(where, (pooledByModule.get(where) ?? 0) + us);
		const key = `${functionName || '(anonymous)'} — ${where}`;
		pooled.set(key, (pooled.get(key) ?? 0) + us);
	}
}
const perCommand = (m: Map<string, number>, n: number) =>
	[...m.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([k, us]) => ({
			where: k,
			'ms a command': +(us / 1000 / Math.max(1, commandProfiles.length)).toFixed(3)
		}));
console.log(`\nA command's own CPU, ${commandProfiles.length} commands pooled. By module:`);
console.table(perCommand(pooledByModule, 18));
console.log('By function:');
console.table(perCommand(pooled, 25));
writeFileSync(join(dir, 'command-windows.json'), JSON.stringify(commandProfiles));
console.log(`\nRaw profile: ${join(dir, 'commands.cpuprofile')}`);
