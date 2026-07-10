<!--
	Render first-party pack Markdown (emphasis, lists) to HTML. Pack content is
	validated at build and authored by us, so the output is trusted. `inline`
	renders without a wrapping paragraph, for use inside labels and list items.
-->
<script lang="ts">
	import { marked } from 'marked';

	let { text, inline = false }: { text: string; inline?: boolean } = $props();

	const html = $derived(
		inline ? marked.parseInline(text, { async: false }) : marked.parse(text, { async: false })
	);
</script>

<!-- Trusted: first-party pack markdown. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html html}
