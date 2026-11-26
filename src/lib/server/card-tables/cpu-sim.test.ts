/**
 * Simulated rounds, timed: what a card table costs the server per request.
 *
 * Workers Free allows 10 ms of CPU per request (phase 33), and Session 14 hit
 * it once. This plays many Challenge rounds at a Session 14-sized table — the
 * GM and four players against three enemy groups — through the same service
 * calls the routes make, and times every request a real table would send:
 *
 * - a command (`loadTable`, `runCommand`, `viewFor`), as the commands route;
 * - the poll each other client sends after it, which finds a change and is
 *   handed a full view (`syncTable`);
 * - a poll that finds nothing (`syncTable` answering `'unchanged'`).
 *
 * The players are random but legal: they play initiative, take turns (play,
 * ready, Guard, skip, now and then the Fool), answer minor actions, and the GM
 * steps on, ends rounds and turns over Tests of Fate. Now and then the GM
 * presses Next twice, as in Session 14.
 *
 * CPU is `process.cpuUsage()`, which counts SQLite's own work too. On a
 * Worker, D1 time is I/O and costs no CPU, so the time spent inside SQLite is
 * measured separately and taken off: "worker-like" is what is left. Node on a
 * laptop is faster than a Worker, so read the numbers against each other and
 * as a floor, not against 10 ms directly.
 *
 * Skipped unless asked for, because it is a measurement, not a test:
 *
 *   CPU_SIM=1 npx vitest run src/lib/server/card-tables/cpu-sim.test.ts
 *
 * `CPU_SIM_ROUNDS` sets how many rounds (default 300).
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as schema from '../db/schema.ts';
import type { Db } from '../db/entities.ts';
import { createCardTable } from '../db/card-tables.ts';
import { admitSeat, claimGmSeat, requestSeat } from '../db/card-table-seats.ts';
import { loadPack, loadTable, runCommand, syncTable, viewFor } from './service.ts';
import {
	facedownZoneOf,
	seededRng,
	upAt,
	waitingForInitiative,
	waitingForMinor,
	type CardTable
} from '$lib/games/hmtw/engine';
import { getGame } from '$lib/games';
import '$lib/games';

const ROUNDS = Number(process.env.CPU_SIM_ROUNDS ?? 300);

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

const packFetch = (async (url: string) => {
	const file = String(url).replace('/content-packs/hmtw/', '');
	return new Response(await readFile(join(packRoot, file), 'utf8'));
}) as unknown as typeof fetch;

/* ---- Timing ----------------------------------------------------------------- */

/** Microseconds spent inside SQLite statements, so they can be taken off. */
let sqliteMicros = 0;

function timeSqlite(sqlite: Database.Database) {
	const proto = Object.getPrototypeOf(sqlite.prepare('select 1')) as Record<
		string,
		(...args: unknown[]) => unknown
	>;
	for (const method of ['run', 'get', 'all', 'iterate']) {
		const original = proto[method];
		proto[method] = function (this: unknown, ...args: unknown[]) {
			const start = process.hrtime.bigint();
			try {
				return original.apply(this, args);
			} finally {
				sqliteMicros += Number(process.hrtime.bigint() - start) / 1000;
			}
		};
	}
}

interface Sample {
	kind: string;
	/** All CPU, SQLite included, in ms. */
	cpu: number;
	/** CPU with SQLite's time taken off, in ms: closer to a Worker. */
	worker: number;
	/** Bytes in the reply, roughly. */
	bytes: number;
	/** Which request this was, counting from the first. */
	at: number;
}

const samples: Sample[] = [];

async function timed<T>(kind: string, fn: () => Promise<T>): Promise<T> {
	const sqliteBefore = sqliteMicros;
	const before = process.cpuUsage();
	const out = await fn();
	// The reply is serialised on the way out, which a Worker pays for too.
	const body = out === undefined || typeof out === 'string' ? '' : JSON.stringify(out);
	const used = process.cpuUsage(before);
	const cpu = (used.user + used.system) / 1000;
	const sqlite = (sqliteMicros - sqliteBefore) / 1000;
	samples.push({
		kind,
		cpu,
		worker: Math.max(0, cpu - sqlite),
		bytes: body.length,
		at: samples.length
	});
	return out;
}

function summarise(kind: string) {
	const rows = samples.filter((s) => s.kind === kind);
	if (rows.length === 0) return null;
	const q = (xs: number[], p: number) => {
		const sorted = [...xs].sort((a, b) => a - b);
		return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
	};
	const worker = rows.map((r) => r.worker);
	const cpu = rows.map((r) => r.cpu);
	return {
		kind,
		n: rows.length,
		'worker p50': +q(worker, 0.5).toFixed(2),
		'worker p95': +q(worker, 0.95).toFixed(2),
		'worker p99': +q(worker, 0.99).toFixed(2),
		'worker max': +Math.max(...worker).toFixed(2),
		'cpu max': +Math.max(...cpu).toFixed(2),
		'kB max': +(Math.max(...rows.map((r) => r.bytes)) / 1024).toFixed(1)
	};
}

/* ---- The table -------------------------------------------------------------- */

interface Seat {
	id: string;
	claim: { seatId: string; secret: string };
	isGm: boolean;
	/** The client's cursor: what it last saw. */
	version: number;
	stamp?: string;
}

const GROUPS = [
	{ id: 'aspirants', name: 'Aspirant', count: 3 },
	{ id: 'lion', name: 'Lion', count: 1 },
	{ id: 'hounds', name: 'Hound', count: 2 }
];

async function setUp() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	timeSqlite(sqlite);
	const db = drizzle(sqlite, { schema }) as unknown as Db;
	migrate(drizzle(sqlite, { schema }), { migrationsFolder: './drizzle' });

	const [user] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	const module = getGame('hmtw')!.cardTable!;
	const opening = module.create(await loadPack(packFetch, 'hmtw', module.packFiles), seededRng(3));
	const created = await createCardTable(db, {
		gameId: 'hmtw',
		name: 'Session 14',
		ownerId: user.id,
		state: opening.state,
		stateVersion: opening.stateVersion
	});
	if (!created.ok) throw new Error('create refused');
	const table = created.table;

	const seats: Seat[] = [];
	for (const name of ['The GM', 'Bonnie', 'Tatyana', 'Eldritch', 'Dan']) {
		const asked = await requestSeat(db, table.id, name);
		if (!asked.ok) throw new Error('seat refused');
		const seat = {
			id: asked.ticket.seat.id,
			claim: { seatId: asked.ticket.seat.id, secret: asked.ticket.secret },
			isGm: seats.length === 0,
			version: 0
		};
		if (seat.isGm) await claimGmSeat(db, table.id, seat.id);
		else await admitSeat(db, table.id, seat.id, seats[0].id);
		seats.push(seat);
	}
	return { db, token: table.roomToken, seats };
}

/* ---- The players ------------------------------------------------------------ */

type Command = Record<string, unknown> & { type: string };

function chooser(seed: number) {
	const rng = seededRng(seed);
	return {
		chance: (p: number) => rng() < p,
		pick: <T>(xs: readonly T[]): T | undefined =>
			xs.length === 0 ? undefined : xs[Math.floor(rng() * xs.length)]
	};
}

/**
 * The next thing somebody at the table does, read off the engine's own state.
 * Returns the command and who sends it.
 */
function nextMove(
	t: CardTable,
	seats: Seat[],
	choose: ReturnType<typeof chooser>,
	state: { round: number; fights: number }
): { by: Seat; command: Command } | null {
	const gm = seats[0];
	const players = seats.slice(1);
	const handOf = (holder: string) =>
		players.some((p) => p.id === holder) ? `seat:${holder}:hand` : `seat:${gm.id}:hand`;
	const cardsIn = (zone: string) => t.zones[zone]?.cards ?? [];
	const seatFor = (holder: string) => players.find((p) => p.id === holder) ?? gm;
	const targets = [...players.map((p) => p.id), ...GROUPS.map((g) => g.id)];

	if (t.mode !== 'challenge') {
		return { by: gm, command: { type: 'set-mode', mode: 'challenge' } };
	}
	for (const group of GROUPS) {
		if (!t.opponents.some((o) => o.id === group.id)) {
			return {
				by: gm,
				command: {
					type: 'add-opponent',
					id: group.id,
					name: group.name,
					count: group.count,
					health: 6,
					defense: 2
				}
			};
		}
	}

	switch (t.round.step) {
		case 'deal':
			return { by: gm, command: { type: 'begin-round', playerHand: 4, gmHand: 5 } };

		case 'initiative': {
			const holder = waitingForInitiative(t)[0];
			const card = holder && choose.pick(cardsIn(handOf(holder)));
			if (!holder || !card) return { by: gm, command: { type: 'start-count' } };
			return {
				by: seatFor(holder),
				command: { type: 'play-initiative', holder, from: { zone: handOf(holder), card } }
			};
		}

		case 'turn': {
			// Now and then a Test of Fate, the way the session had them mid-fight.
			if (choose.chance(0.05)) {
				return {
					by: gm,
					command: { type: 'move', from: { zone: 'deck:player' }, to: 'fate' }
				};
			}
			// Now and then somebody uses a readied card on another's turn.
			const readied = players.find((p) => {
				const zone = facedownZoneOf(t, p.id);
				return zone && cardsIn(zone).length > 0;
			});
			if (readied && choose.chance(0.15)) {
				return { by: readied, command: { type: 'use-readied', holder: readied.id } };
			}
			// The Fool, with a partner, out of turn.
			const fooled = players.find((p) =>
				cardsIn(handOf(p.id)).some((c) => t.foolCards.includes(c))
			);
			if (fooled && choose.chance(0.5)) {
				const hand = cardsIn(handOf(fooled.id));
				const fool = hand.find((c) => t.foolCards.includes(c))!;
				const partner = hand.find((c) => c !== fool);
				if (partner) {
					return {
						by: fooled,
						command: {
							type: 'play-out-of-turn',
							holder: fooled.id,
							from: { zone: handOf(fooled.id), card: fool },
							extra: [{ zone: handOf(fooled.id), card: partner }],
							action: 'Attack',
							target: choose.pick(GROUPS)!.id
						}
					};
				}
			}

			const holder = upAt(t)[0];
			if (!holder) return { by: gm, command: { type: 'step-on' } };
			const card = choose.pick(cardsIn(handOf(holder)).filter((c) => !t.foolCards.includes(c)));
			if (!card || choose.chance(0.08)) {
				return { by: seatFor(holder), command: { type: 'skip-turn', holder } };
			}
			const mode = choose.chance(0.7) ? 'play' : choose.chance(0.66) ? 'ready' : 'guard';
			return {
				by: seatFor(holder),
				command: {
					type: 'play-turn',
					holder,
					from: { zone: handOf(holder), card },
					action: mode === 'ready' ? 'Dodge' : mode === 'guard' ? 'Guard' : 'Attack',
					target: choose.pick(targets.filter((x) => x !== holder)),
					mode
				}
			};
		}

		case 'minor': {
			const waiting = waitingForMinor(t);
			const groups = waiting.filter((h) => GROUPS.some((g) => g.id === h));
			const player = waiting.find((h) => players.some((p) => p.id === h));
			if (player) {
				const card = choose.pick(cardsIn(handOf(player)));
				if (card && choose.chance(0.3)) {
					return {
						by: seatFor(player),
						command: {
							type: 'declare-minor',
							holder: player,
							from: { zone: handOf(player), card },
							label: 'Attack',
							target: choose.pick(GROUPS)!.id
						}
					};
				}
				if (card && choose.chance(0.1)) {
					return {
						by: seatFor(player),
						command: {
							type: 'ready-minor',
							holder: player,
							from: { zone: handOf(player), card },
							label: 'Dodge'
						}
					};
				}
				return { by: seatFor(player), command: { type: 'pass-minor', holders: [player] } };
			}
			if (groups.length > 0) return { by: gm, command: { type: 'pass-minor', holders: groups } };
			return { by: gm, command: { type: 'step-on' } };
		}

		case 'resolve':
			return { by: gm, command: { type: 'step-on' } };

		case 'over':
			state.round++;
			if (choose.chance(0.3) && cardsIn('fate').length > 0) {
				return { by: gm, command: { type: 'clear-fate' } };
			}
			// Every eight rounds the fight ends and a new one starts: leaving the
			// Challenge sweeps the table, as between Bout I and Bout II.
			if (state.round % 8 === 0) {
				state.fights++;
				return { by: gm, command: { type: 'set-mode', mode: 'decks' } };
			}
			return { by: gm, command: { type: 'end-round' } };
	}
	return null;
}

/* ---- The run ---------------------------------------------------------------- */

describe.skipIf(!process.env.CPU_SIM)('simulated rounds, timed', () => {
	it(
		'plays a Session 14-sized table and reports what each request costs',
		async () => {
			const { db, token, seats } = await setUp();
			const choose = chooser(14);
			const progress = { round: 0, fights: 0 };
			const refusals: Record<string, number> = {};
			let commands = 0;
			let doubleNext = 0;

			const command = async (by: Seat, body: Command, kind = `command ${body.type}`) =>
				timed(kind, async () => {
					const ctx = await loadTable(db, packFetch, token, by.claim, undefined);
					if (!ctx) throw new Error('no table');
					const result = await runCommand(
						db,
						ctx,
						body,
						ctx.row.version,
						`r${commands++}`,
						seededRng(commands)
					);
					if (!result.ok) {
						const why = `${body.type}: ${result.reason}${'detail' in result && result.detail ? ` (${result.detail})` : ''}`;
						refusals[why] = (refusals[why] ?? 0) + 1;
						return { ok: false };
					}
					return {
						ok: true,
						...(await viewFor(
							db,
							{ ...ctx, row: result.table, state: result.state ?? ctx.state },
							ctx.row.version
						))
					};
				});

			const pollAll = async (except: Seat) => {
				for (const seat of seats) {
					if (seat === except) continue;
					const view = await timed('poll, changed', () =>
						syncTable(db, packFetch, token, seat.claim, undefined, {
							since: seat.version,
							stamp: seat.stamp
						})
					);
					if (view && view !== 'unchanged') {
						seat.version = view.version;
						seat.stamp = view.stamp;
					}
				}
			};

			const pollQuiet = async () => {
				for (const seat of seats) {
					await timed('poll, unchanged', () =>
						syncTable(db, packFetch, token, seat.claim, undefined, {
							since: seat.version,
							stamp: seat.stamp
						})
					);
				}
			};

			// Every client's first poll, which carries no stamp yet.
			await pollAll(seats[0]);
			seats[0].version = 0;

			let guard = 0;
			while (progress.round < ROUNDS && guard++ < ROUNDS * 400) {
				const ctx = await loadTable(db, packFetch, token, seats[0].claim, undefined);
				const move = nextMove(ctx!.state as CardTable, seats, choose, progress);
				if (!move) break;

				const reply = (await command(move.by, move.command)) as {
					ok: boolean;
					version?: number;
					stamp?: string;
				};
				if (reply.ok && reply.version !== undefined) {
					move.by.version = reply.version;
					move.by.stamp = reply.stamp;
					// Session 14: the GM presses Next again, on a round that has moved.
					if (move.command.type === 'step-on' && choose.chance(0.1)) {
						doubleNext++;
						await command(move.by, { type: 'step-on' }, 'command step-on (second press)');
					}
					await pollAll(move.by);
				}
				await pollQuiet();
			}

			const kinds = [...new Set(samples.map((s) => s.kind))].sort();
			const table = kinds.map(summarise).filter(Boolean);
			console.log(
				`\n${progress.round} rounds over ${progress.fights + 1} fights, ${commands} commands, ` +
					`${doubleNext} double Nexts, ${samples.length} requests timed.`
			);
			console.table(table);
			const worst = [...samples].sort((a, b) => b.worker - a.worker).slice(0, 10);
			console.log('\nThe ten most expensive requests (worker-like ms):');
			console.table(
				worst.map((s) => ({ ...s, cpu: +s.cpu.toFixed(2), worker: +s.worker.toFixed(2) }))
			);
			// A fresh Worker isolate runs cold, unoptimised code: compare the first
			// requests of the run with the rest.
			const early = samples.filter((s) => s.at < 200).map((s) => s.worker);
			const late = samples.filter((s) => s.at >= samples.length / 2).map((s) => s.worker);
			const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
			console.log(
				`\nFirst 200 requests: mean ${mean(early).toFixed(2)} ms, max ${Math.max(...early).toFixed(2)}. ` +
					`Second half: mean ${mean(late).toFixed(2)} ms, max ${Math.max(...late).toFixed(2)}.`
			);
			console.log(
				'Over 5 ms (worker-like):',
				samples.filter((s) => s.worker > 5).length,
				'of',
				samples.length
			);
			console.log('\nRefused:', refusals);
			expect(progress.round).toBeGreaterThan(0);
		},
		10 * 60_000
	);
});
