<!--
	Privacy policy. Required by Google's OAuth consent screen before the app can be
	published out of Testing mode (the URL must resolve — Google checks it), and
	honest disclosure is worth having regardless.

	Keep this factually true against src/lib/server/db/schema.ts: if a migration adds
	a table that holds personal data, say so here — `card_table_seats` holds a name
	typed by somebody who may have no account at all, which is why there is a
	section about it. Count the cookies here against `hooks.server.ts` and
	`$lib/seat-claims` too: this page said "one cookie" for a while after a second
	one shipped. It claims no tracking and no
	advertising — that is currently true and should stay that way, or this page must
	change with it. The one measurement on the site is Cloudflare Web Analytics
	(commit 116): cookieless, aggregate page counts, nothing stored about the
	visitor — disclosed below, and if it ever grows beyond that, this page changes
	in the same commit.
-->
<script lang="ts">
	import { APP_NAME, APP_REPO_URL } from '$lib';
	import { CONTACT_EMAIL, KOFI_URL, DRIVETHRU_AFFILIATE_URL } from '$lib/support';

	const LAST_UPDATED = '9 September 2026';
</script>

<svelte:head>
	<title>Privacy policy — {APP_NAME}</title>
	<meta name="description" content="What {APP_NAME} stores, why, and how to delete it." />
</svelte:head>

<article class="mx-auto max-w-2xl space-y-10">
	<header>
		<h1 class="text-3xl font-bold tracking-tight">Privacy policy</h1>
		<p class="mt-2 text-muted">
			{APP_NAME} is a hobby project run by one person. It stores the least it can get away with, shows
			you no advertising, and tracks you nowhere. Last updated {LAST_UPDATED}.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-semibold">What is stored</h2>
		<p class="mt-2">When you sign in, {APP_NAME} keeps:</p>
		<ul class="mt-3 list-disc space-y-2 pl-5">
			<li>
				<strong>Your account.</strong> The name, email address and avatar image supplied by
				whichever provider you signed in with (Google or Discord), plus the access and refresh
				tokens that keep you signed in. {APP_NAME} never sees or stores your password — it has none.
			</li>
			<li>
				<strong>What you make.</strong> Your characters, campaigns, dice rolls and session notes, and
				which campaigns you belong to.
			</li>
		</ul>
		<p class="mt-3 text-sm text-muted">
			That is the whole list. There is no advertising, no tracking pixels, and nothing you write is
			read, mined or sold. The one measurement on the site is
			<a
				href="https://www.cloudflare.com/web-analytics/"
				rel="noopener external"
				class="underline hover:text-accent">Cloudflare Web Analytics</a
			>: aggregate page counts so one person can tell whether anyone visits. It is cookieless, it
			does not fingerprint you, it stores nothing about you, and it cannot follow you to another
			site — which is why there is still no consent banner to click.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Card tables, and playing without an account</h2>
		<p class="mt-2">
			A card table is the one part of {APP_NAME} you can use without signing in. Somebody with an account
			starts the table and shares its link; anyone holding that link can take a seat. If that is you,
			here is the whole of what is kept:
		</p>
		<ul class="mt-3 list-disc space-y-2 pl-5">
			<li>
				<strong>The name you type when you sit down.</strong> The form asks for your character's name
				rather than yours, and that is the honest advice — it is shown to everyone at the table and it
				is the only thing about you that is stored. Nothing asks for an email address, and nothing tries
				to work out who you are.
			</li>
			<li>
				<strong>What happens at the table.</strong> Which cards moved between which piles, and any label
				somebody types onto a face-down card. It is the game, not you.
			</li>
		</ul>
		<p class="mt-3">
			<strong>A table is deleted six weeks after it was last used</strong>, and the seats go with it
			— names included. Nobody has to ask and no reminder is sent; it simply goes. If you want your
			name off a table sooner than that, the person who started it can delete the whole table at
			once, which takes effect immediately. That is the practical route for a guest, because a seat
			is not an account and there is nothing for an erasure request to name you by.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Why it is stored</h2>
		<p class="mt-2">
			Solely to make the app work: to know who you are between visits, to show your characters back
			to you, and to let the other players at your table see the campaign you share with them. Your
			characters and notes are visible to you and to the members of any campaign you join — not to
			anyone else, and not to the public.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Who it is shared with</h2>
		<p class="mt-2">
			Nobody. Your data is not sold, rented, or handed to advertisers or data brokers. It is not
			used to train machine-learning models. The only third parties involved are the ones needed to
			serve the site at all:
		</p>
		<ul class="mt-3 list-disc space-y-2 pl-5">
			<li>
				<strong>Cloudflare</strong>, which hosts the app and its database, and which processes
				requests on our behalf.
			</li>
			<li>
				<strong>Google or Discord</strong>, whichever you chose to sign in with — they tell {APP_NAME}
				who you are, and their own privacy policies govern that exchange.
			</li>
		</ul>
		<p class="mt-3 text-sm text-muted">
			The site does carry two outbound links that are commercial: a
			<a href={KOFI_URL} rel="noopener external" class="underline hover:text-accent">Ko-fi</a>
			tip jar and a
			<a href={DRIVETHRU_AFFILIATE_URL} rel="noopener external" class="underline hover:text-accent"
				>DriveThruRPG affiliate link</a
			>. If you follow either, that company's cookies and privacy policy apply on their site — not
			here. Following them is entirely optional and nothing is shared about you when you do.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Cookies</h2>
		<p class="mt-2">Two, and both are essential rather than tracking:</p>
		<ul class="mt-3 list-disc space-y-2 pl-5">
			<li>
				<strong>Your sign-in session</strong>, so the site knows it is still you on the next page.
				Set only when you sign in.
			</li>
			<li>
				<strong>Your seat at a card table</strong>, set only if you take one. It holds a secret that
				proves the seat is yours, so that closing the tab does not lose your hand. It cannot be read
				by scripts, it is not sent to other sites, and it says nothing about who you are.
			</li>
		</ul>
		<p class="mt-3">
			There are no advertising or analytics cookies — the page-count measurement above is cookieless
			by design — which is why you are not being asked to click a consent banner.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Deleting your data</h2>
		<p class="mt-2">
			It is your data and you may have it back or have it destroyed. Email
			<a href="mailto:{CONTACT_EMAIL}" class="underline hover:text-accent">{CONTACT_EMAIL}</a>
			and ask, and your account and everything attached to it will be deleted. There is no retention period
			and no dark pattern — asking once is enough. You may also ask for a copy of what is held about you.
		</p>
		<p class="mt-3 text-sm text-muted">
			If you only ever sat at somebody's card table, there is no account to delete and no need to
			write: ask whoever started the table to delete it, or leave it and it will age out within six
			weeks by itself.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Where it lives</h2>
		<p class="mt-2">
			On Cloudflare's infrastructure, which is distributed globally, so your data may be stored or
			processed outside your own country. It is transmitted over HTTPS in every case.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Changes, and checking my work</h2>
		<p class="mt-2">
			If this policy changes materially, the date above changes with it. {APP_NAME} is free software and
			the source is public — if you would rather verify than trust, the code that stores all of the above
			is at
			<a href={APP_REPO_URL} rel="external" class="underline hover:text-accent">{APP_REPO_URL}</a>.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Contact</h2>
		<p class="mt-2">
			Questions, corrections, or a deletion request:
			<a href="mailto:{CONTACT_EMAIL}" class="underline hover:text-accent">{CONTACT_EMAIL}</a>.
		</p>
	</section>
</article>
