<!--
	Credits & licensing. Three parts: the framework's own licence + prior-art
	credits, each game's *text* licence and attribution (data-driven from the pack
	manifests, so a new game shows up automatically), and this deployment's support
	links. Public-facing; linked from the footer.
-->
<script lang="ts">
	import { APP_NAME, APP_REPO_URL, INSPIRATIONS } from '$lib';
	import { licenseInfo } from '$lib/credits';
	import { KOFI_URL, DRIVETHRU_AFFILIATE_URL } from '$lib/support';

	let { data } = $props();

	const appLicense = licenseInfo('GPL-3.0-or-later');
</script>

<svelte:head>
	<title>Credits & licensing — {APP_NAME}</title>
</svelte:head>

<article class="mx-auto max-w-2xl space-y-10">
	<header>
		<h1 class="text-3xl font-bold tracking-tight">Credits &amp; licensing</h1>
		<p class="mt-2 text-muted">
			{APP_NAME} is a game-agnostic tabletop-RPG companion. The application and each game's text are licensed
			separately — the details are below.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-semibold">The application</h2>
		<p class="mt-2">
			{APP_NAME} is free software, licensed
			<a href={appLicense.url} rel="external" class="underline hover:text-accent"
				>{appLicense.label}</a
			>. The source is public:
			<a href={APP_REPO_URL} rel="external" class="underline hover:text-accent">{APP_REPO_URL}</a>.
		</p>
		<p class="mt-3 text-sm text-muted">
			Its architecture is modelled on prior art by Arrowed —
			{#each INSPIRATIONS as ins, i (ins.url)}<a
					href={ins.url}
					rel="external"
					class="underline hover:text-accent">{ins.name}</a
				>{#if i < INSPIRATIONS.length - 1}&#32;and&#32;{/if}{/each}. Thanks to them.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Game text</h2>
		<div class="mt-3 space-y-5">
			{#each data.games as game (game.id)}
				<div class="rounded-md border border-border p-4">
					<h3 class="font-semibold">{game.name}</h3>
					<p class="mt-1 text-sm">
						Text licensed
						{#if game.license.url}
							<a href={game.license.url} class="underline hover:text-accent">{game.license.label}</a
							>
						{:else}
							{game.license.label}
						{/if}.
					</p>
					<p class="mt-2 text-sm text-muted">{game.attribution}</p>
					{#if game.license.shareAlike}
						<p class="mt-2 text-xs text-muted">
							Share-alike: if you remix or build upon this content, distribute your contributions
							under the same licence.
						</p>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<section id="support" class="scroll-mt-20">
		<h2 class="text-xl font-semibold">Support</h2>
		<p class="mt-2 text-muted">
			{APP_NAME} is free, and always will be. If it's useful at your table and you'd like to chip in,
			thank you — there's no pressure either way.
		</p>
		<div class="mt-4 space-y-3">
			<div class="rounded-md border border-border p-4">
				<a
					href={KOFI_URL}
					target="_blank"
					rel="noopener external"
					class="font-medium underline hover:text-accent"
				>
					☕ Buy me a coffee on Ko-fi
				</a>
				<p class="mt-1 text-sm text-muted">A one-off tip, if you're so inclined.</p>
			</div>
			<div class="rounded-md border border-border p-4">
				<a
					href={DRIVETHRU_AFFILIATE_URL}
					target="_blank"
					rel="noopener external"
					class="font-medium underline hover:text-accent"
				>
					🎲 Shop DriveThruRPG through my affiliate link
				</a>
				<p class="mt-1 text-sm text-muted">
					If you buy anything on DriveThruRPG within a couple of weeks of following this link, it
					costs you nothing extra and the creators are paid in full — DriveThruRPG simply sends a
					small share of <em>their</em> cut my way, which helps keep the lights on. (Stonetop isn't sold
					there, so this is just for your other TTRPG shopping.)
				</p>
			</div>
		</div>
	</section>
</article>
