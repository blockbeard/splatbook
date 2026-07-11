<!--
	Terms of service. Required alongside /privacy by Google's OAuth consent screen
	before the app can be published out of Testing mode (the URL must resolve).

	Deliberately short and plain: this is a free hobby app with no payment, no SLA
	and no company behind it, and the terms should say exactly that rather than
	impersonate an enterprise EULA. Note the licence split — GPL for the app, the
	publisher's own licence for game text — which mirrors /credits.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME, APP_REPO_URL } from '$lib';
	import { CONTACT_EMAIL } from '$lib/support';

	const LAST_UPDATED = '11 July 2026';
</script>

<svelte:head>
	<title>Terms of service — {APP_NAME}</title>
	<meta name="description" content="The terms you use {APP_NAME} under." />
</svelte:head>

<article class="mx-auto max-w-2xl space-y-10">
	<header>
		<h1 class="text-3xl font-bold tracking-tight">Terms of service</h1>
		<p class="mt-2 text-muted">
			The short version: {APP_NAME} is free, it is run by one person as a hobby, and it comes with no
			guarantees. Please be decent to the other people at your table. Last updated {LAST_UPDATED}.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-semibold">What this is</h2>
		<p class="mt-2">
			{APP_NAME} is a free companion app for tabletop roleplaying games — character sheets, campaigns,
			dice. It costs nothing, there is no subscription, and nothing is being sold to you. It is offered
			as-is to anyone who finds it useful.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Your account</h2>
		<p class="mt-2">
			You sign in with Google or Discord; keeping that account secure is your responsibility. You
			must be old enough to hold the account you sign in with. Do not use {APP_NAME} to break the law,
			to harass anyone, or to attack the service itself. Accounts doing any of those may be removed.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">What you write stays yours</h2>
		<p class="mt-2">
			Your characters, campaigns and notes belong to you. No ownership of them is claimed, they will
			not be sold, and they will not be used to train machine-learning models. They are stored only
			so the app can show them back to you and to your fellow players — see the
			<a href={resolve('/privacy')} class="underline hover:text-accent">privacy policy</a>. You can
			have them deleted at any time by asking.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Licensing</h2>
		<p class="mt-2">
			The application is free software under the GPL-3.0-or-later, and its source is public at
			<a href={APP_REPO_URL} rel="external" class="underline hover:text-accent">{APP_REPO_URL}</a>.
			Game text shown in the app remains the property of its publishers and is used under its own
			licence. The details, per game, are on the
			<a href={resolve('/credits')} class="underline hover:text-accent">credits &amp; licensing</a>
			page. {APP_NAME} is not affiliated with, nor endorsed by, any game publisher.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">No warranty, and no promises about uptime</h2>
		<p class="mt-2">
			{APP_NAME} is provided "as is", without warranty of any kind. It may break, it may go offline, and
			it may lose data. It is a hobby project, not a business: there is no service-level agreement, no
			support desk, and no guarantee it will still exist next year. To the fullest extent the law allows,
			no liability is accepted for any loss arising from your use of it.
		</p>
		<p class="mt-3 text-sm text-muted">
			Practical advice, offered sincerely: if a character sheet matters a great deal to you, keep
			your own copy. The app can export one.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Changes and ending it</h2>
		<p class="mt-2">
			These terms may change; the date above changes with them. You may stop using {APP_NAME} at any time
			and have your data deleted. The service may likewise be discontinued — if that ever happens by choice,
			reasonable notice will be given so you can get your characters out.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Contact</h2>
		<p class="mt-2">
			<a href="mailto:{CONTACT_EMAIL}" class="underline hover:text-accent">{CONTACT_EMAIL}</a>.
		</p>
	</section>
</article>
