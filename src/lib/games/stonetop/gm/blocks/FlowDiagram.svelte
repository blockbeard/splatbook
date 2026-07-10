<!--
	The flow of play as a node/edge diagram: campaign phases on a ring with curved,
	labelled, arrowed transitions between them. Layout and edge routing are the
	pure `diagram` helper; this component is the SVG shell. A labelled transition
	list still renders beneath (in the section) as the text-equivalent.
-->
<script lang="ts">
	import { circularPositions, edgePath, type Point } from '../diagram';

	interface Node {
		id: string;
		name: string;
	}
	interface Edge {
		from: string;
		to: string;
		label?: string;
	}

	let { nodes, edges }: { nodes: readonly Node[]; edges: readonly Edge[] } = $props();

	// Canvas + node box geometry.
	const W = 760;
	const H = 600;
	const cx = W / 2;
	const cy = H / 2;
	const R = 190;
	const hw = 64;
	const hh = 24;

	const pos = $derived.by(() => {
		const points = circularPositions(nodes.length, cx, cy, R);
		const map: Record<string, Point> = {};
		nodes.forEach((node, i) => (map[node.id] = points[i]));
		return map;
	});

	const routed = $derived(
		edges
			.map((edge) => {
				const a = pos[edge.from];
				const b = pos[edge.to];
				if (!a || !b) return null;
				const g = edgePath(a, b, hw, hh);
				return { d: g.d, at: g.label, label: edge.label };
			})
			.filter((e): e is NonNullable<typeof e> => e !== null)
	);
</script>

<div class="mt-2 overflow-x-auto">
	<svg
		viewBox="0 0 {W} {H}"
		class="h-auto w-full min-w-[520px]"
		role="img"
		aria-label="Diagram of the phases of play and the transitions between them"
	>
		<defs>
			<marker
				id="gm-flow-arrow"
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

		{#each routed as edge, i (i)}
			<path
				d={edge.d}
				fill="none"
				stroke="var(--sb-border, currentColor)"
				stroke-width="1.5"
				marker-end="url(#gm-flow-arrow)"
			/>
			{#if edge.label}
				<text
					x={edge.at.x}
					y={edge.at.y}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="10"
					class="gm-flow-label"
				>
					{edge.label}
				</text>
			{/if}
		{/each}

		{#each nodes as node (node.id)}
			{@const p = pos[node.id]}
			{#if p}
				<g>
					<rect
						x={p.x - hw}
						y={p.y - hh}
						width={hw * 2}
						height={hh * 2}
						rx="8"
						fill="var(--sb-surface, transparent)"
						stroke="var(--sb-accent, currentColor)"
						stroke-width="1.5"
					/>
					<text
						x={p.x}
						y={p.y}
						text-anchor="middle"
						dominant-baseline="middle"
						font-size="12.5"
						font-weight="600"
						fill="var(--sb-text, currentColor)"
					>
						{node.name}
					</text>
				</g>
			{/if}
		{/each}
	</svg>
</div>

<style>
	.gm-flow-label {
		fill: var(--sb-muted, currentColor);
		paint-order: stroke;
		stroke: var(--sb-bg, transparent);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
</style>
