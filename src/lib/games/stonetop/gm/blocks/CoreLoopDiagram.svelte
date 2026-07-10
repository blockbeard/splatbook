<!--
	The core loop as a cycle: numbered step circles on a ring with arrows running
	1→2→…→N and back to the top, the closing arc labelled "repeat". It shows the
	shape of the loop at a glance; the full step text lists beneath it (StepList in
	the Overview section). Layout is the pure `diagram` helper.
-->
<script lang="ts">
	import { circularPositions } from '../diagram';

	interface Step {
		n: number;
		name: string;
	}

	let { steps }: { steps: readonly Step[] } = $props();

	const W = 320;
	const H = 320;
	const R = 110;
	const rr = 24; // circle radius

	const pts = $derived(circularPositions(steps.length, W / 2, H / 2, R));

	/** Straight arrow between two circle boundaries (shortened by the radius each end). */
	function arrow(i: number) {
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const ux = dx / len;
		const uy = dy / len;
		const gap = rr + 4;
		const s = { x: a.x + ux * gap, y: a.y + uy * gap };
		const e = { x: b.x - ux * gap, y: b.y - uy * gap };
		return { s, e, mid: { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 } };
	}

	// The closing edge (last → first) is the "repeat" arc.
	const lastIndex = $derived(steps.length - 1);
</script>

<div class="mt-3">
	<svg
		viewBox="0 0 {W} {H}"
		class="mx-auto h-auto w-full max-w-[320px]"
		role="img"
		aria-label="The core loop, a cycle of numbered steps returning to the start"
	>
		<defs>
			<marker
				id="gm-loop-arrow"
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerWidth="7"
				markerHeight="7"
				orient="auto-start-reverse"
			>
				<path d="M 0 1 L 9 5 L 0 9 z" fill="var(--sb-muted, currentColor)" />
			</marker>
		</defs>

		{#each steps as _step, i (i)}
			{@const seg = arrow(i)}
			<line
				x1={seg.s.x}
				y1={seg.s.y}
				x2={seg.e.x}
				y2={seg.e.y}
				stroke="var(--sb-border, currentColor)"
				stroke-width="1.5"
				marker-end="url(#gm-loop-arrow)"
			/>
			{#if i === lastIndex}
				<text
					x={seg.mid.x}
					y={seg.mid.y}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="11"
					class="gm-loop-label"
				>
					repeat
				</text>
			{/if}
		{/each}

		{#each steps as step, i (step.n)}
			{@const p = pts[i]}
			<g>
				<circle
					cx={p.x}
					cy={p.y}
					r={rr}
					fill="var(--sb-surface, transparent)"
					stroke="var(--sb-accent, currentColor)"
					stroke-width="1.5"
				/>
				<text
					x={p.x}
					y={p.y}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="16"
					font-weight="700"
					fill="var(--sb-text, currentColor)"
				>
					{step.n}
				</text>
			</g>
		{/each}
	</svg>
</div>

<style>
	.gm-loop-label {
		fill: var(--sb-muted, currentColor);
		paint-order: stroke;
		stroke: var(--sb-bg, transparent);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
</style>
