<!--
	A numbered procedure — site/monster/follower creation, the core loop. Each step
	has a name and any of: prose, a plain sub-list, "pick from these" option groups
	(monster/follower stat tables), a single prompt+options group, tag lists, and a
	special-cases map. Renders whatever the step carries.
-->
<script lang="ts">
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from './StringList.svelte';
	import LabelledTable from './LabelledTable.svelte';
	import type { GmStep } from '../../pack-schemas';

	let { steps }: { steps: readonly GmStep[] } = $props();
</script>

<ol class="mt-2 space-y-4">
	{#each steps as step (step.n)}
		<li class="rounded-md border border-border p-3">
			<h3 class="font-semibold">
				<span class="text-muted">{step.n}.</span>
				{step.name}
			</h3>
			{#if step.text}
				<div class="mt-1 text-sm text-muted"><Markdown text={step.text} /></div>
			{/if}
			{#if step.actions}
				<StringList items={step.actions} />
			{/if}
			{#if step.prompt}
				<p class="mt-2 text-sm font-medium">{step.prompt}</p>
			{/if}
			{#if step.options}
				<LabelledTable rows={step.options} />
			{/if}
			{#if step.groups}
				<div class="mt-2 space-y-3">
					{#each step.groups as group, gi (gi)}
						<div>
							<p class="text-sm font-medium">{group.prompt}</p>
							<LabelledTable rows={group.options} />
						</div>
					{/each}
				</div>
			{/if}
			{#if step.items}
				<StringList items={step.items} />
			{/if}
			{#if step.tagLists}
				<div class="mt-2 grid gap-3 sm:grid-cols-3">
					<div>
						<p class="text-xs font-semibold tracking-wide text-muted uppercase">Useful</p>
						<StringList items={step.tagLists.useful} />
					</div>
					<div>
						<p class="text-xs font-semibold tracking-wide text-muted uppercase">Problematic</p>
						<StringList items={step.tagLists.problematic} />
					</div>
					<div>
						<p class="text-xs font-semibold tracking-wide text-muted uppercase">Mixed blessing</p>
						<StringList items={step.tagLists.mixedBlessing} />
					</div>
				</div>
			{/if}
			{#if step.special}
				<dl class="mt-2 space-y-1 text-sm">
					{#each Object.entries(step.special) as [key, value] (key)}
						<div>
							<dt class="inline font-medium capitalize">{key}:</dt>
							<dd class="inline text-muted"><Markdown text={value} inline /></dd>
						</div>
					{/each}
				</dl>
			{/if}
			{#if step.note}
				<p class="mt-2 text-xs text-muted italic">{step.note}</p>
			{/if}
		</li>
	{/each}
</ol>
