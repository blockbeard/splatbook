/**
 * Pure geometry for the GM guide's flow diagrams (flow of play, the core loop).
 * No SVG, no DOM — just the maths of laying nodes on a ring and routing curved,
 * arrowed edges between their box boundaries, so the components stay declarative
 * and the fiddly bits are unit-tested.
 */

export interface Point {
	x: number;
	y: number;
}

/**
 * `n` points evenly spaced on a circle of radius `r` about (`cx`,`cy`), starting
 * at `startAngle` (default straight up) and going clockwise. Returns them in
 * order, so a caller can zip them against an ordered node list.
 */
export function circularPositions(
	n: number,
	cx: number,
	cy: number,
	r: number,
	startAngle: number = -Math.PI / 2
): Point[] {
	const out: Point[] = [];
	for (let i = 0; i < n; i++) {
		const a = startAngle + (i * 2 * Math.PI) / n;
		out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
	}
	return out;
}

/**
 * The point on the boundary of an axis-aligned box (centre `c`, half-width `hw`,
 * half-height `hh`) along the ray from the centre toward `toward`. Used to start
 * and end edges at a node's edge rather than its centre. A zero-length direction
 * returns the centre unchanged.
 */
export function rectBoundaryPoint(c: Point, hw: number, hh: number, toward: Point): Point {
	const dx = toward.x - c.x;
	const dy = toward.y - c.y;
	if (dx === 0 && dy === 0) return { ...c };
	// Largest t with |dx*t| <= hw and |dy*t| <= hh puts us on the nearest edge.
	const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
	const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
	const t = Math.min(tx, ty);
	return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Unit vector perpendicular (rotated +90°) to a→b, or a zero vector if a==b. */
function perp(a: Point, b: Point): Point {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return { x: 0, y: 0 };
	return { x: -dy / len, y: dx / len };
}

export interface EdgePath {
	/** SVG path `d` for a quadratic curve from one node's boundary to the other's. */
	d: string;
	/** Point on the curve to hang a label off (the control-biased midpoint). */
	label: Point;
}

/**
 * A curved edge from box `a` to box `b` (both with the same half-extents). The
 * curve is bowed to one side by `bow` and its endpoints nudged `sep` along the
 * same perpendicular, so a pair of opposite-direction edges (a→b and b→a) bow
 * apart instead of overlapping. Endpoints sit on each box's boundary.
 */
export function edgePath(a: Point, b: Point, hw: number, hh: number, sep = 7, bow = 26): EdgePath {
	const p = perp(a, b);
	const start = rectBoundaryPoint(a, hw, hh, b);
	const end = rectBoundaryPoint(b, hw, hh, a);
	const s = { x: start.x + p.x * sep, y: start.y + p.y * sep };
	const e = { x: end.x + p.x * sep, y: end.y + p.y * sep };
	const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
	const ctrl = { x: mid.x + p.x * bow, y: mid.y + p.y * bow };
	// Quadratic midpoint (t=0.5): 0.25*s + 0.5*ctrl + 0.25*e.
	const label = {
		x: 0.25 * s.x + 0.5 * ctrl.x + 0.25 * e.x,
		y: 0.25 * s.y + 0.5 * ctrl.y + 0.25 * e.y
	};
	const d = `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
	return { d, label };
}
