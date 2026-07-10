import { describe, it, expect } from 'vitest';
import { circularPositions, rectBoundaryPoint, edgePath, type Point } from './diagram';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('circularPositions', () => {
	it('returns one point per node', () => {
		expect(circularPositions(6, 0, 0, 10)).toHaveLength(6);
	});

	it('starts straight up and goes clockwise', () => {
		const [top, right] = circularPositions(4, 0, 0, 10);
		expect(near(top.x, 0)).toBe(true);
		expect(near(top.y, -10)).toBe(true); // up is -y in screen coords
		expect(near(right.x, 10)).toBe(true);
		expect(near(right.y, 0)).toBe(true);
	});
});

describe('rectBoundaryPoint', () => {
	const c: Point = { x: 0, y: 0 };

	it('lands on the right edge for a horizontal target', () => {
		expect(rectBoundaryPoint(c, 20, 10, { x: 100, y: 0 })).toEqual({ x: 20, y: 0 });
	});

	it('lands on the top edge for a vertical target', () => {
		expect(rectBoundaryPoint(c, 20, 10, { x: 0, y: -100 })).toEqual({ x: 0, y: -10 });
	});

	it('clamps a diagonal to whichever edge is hit first', () => {
		// Toward (100,100): tx=20/100, ty=10/100 → ty smaller, so y is clamped to hh.
		const p = rectBoundaryPoint(c, 20, 10, { x: 100, y: 100 });
		expect(p.y).toBe(10);
		expect(p.x).toBe(10);
	});

	it('returns the centre for a zero-length direction', () => {
		expect(rectBoundaryPoint(c, 20, 10, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
	});
});

describe('edgePath', () => {
	const a: Point = { x: 0, y: 0 };
	const b: Point = { x: 200, y: 0 };

	it('produces a quadratic path string and a label point', () => {
		const { d, label } = edgePath(a, b, 20, 10);
		expect(d.startsWith('M ')).toBe(true);
		expect(d).toContain(' Q ');
		expect(Number.isFinite(label.x)).toBe(true);
		expect(Number.isFinite(label.y)).toBe(true);
	});

	it('bows opposite directions apart (a→b vs b→a mirror in y)', () => {
		const ab = edgePath(a, b, 20, 10);
		const ba = edgePath(b, a, 20, 10);
		// With a horizontal chord the perpendicular is vertical, so the two labels
		// sit on opposite sides of the axis.
		expect(Math.sign(ab.label.y)).toBe(-Math.sign(ba.label.y));
		expect(ab.label.y).not.toBe(0);
	});
});
