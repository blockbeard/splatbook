# splatbook.app — domain setup

Registered via Cloudflare Registrar, so the domain already sits in the Cloudflare account
with Cloudflare DNS active, WHOIS redaction on, and auto-renew. There is nothing that
*must* be done until deployment (phase 8).

## Optional, worth doing now (5 minutes)

1. **DNSSEC** — Cloudflare dashboard → splatbook.app → DNS → Settings → Enable DNSSEC.
   One click; because Cloudflare is also the registrar it self-configures. Protects
   against DNS hijacking.
2. **Email lockdown** — the domain sends no email, so tell the world that; it prevents
   spammers spoofing @splatbook.app. Add three DNS records (DNS → Records):
   - TXT, name `@`, content `v=spf1 -all`
   - TXT, name `_dmarc`, content `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s`
   - TXT, name `*._domainkey`, content `v=DKIM1; p=`

## At deployment (phase 8, Cloudflare Pages path)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the GitHub repo.
2. Build settings: framework SvelteKit; build command per repo README at that point
   (`ADAPTER=cloudflare npm run build`); bind the D1 database created in the same phase.
3. Project → Custom domains → add `splatbook.app`. Because the zone is in the same
   account, Cloudflare creates the DNS record and TLS certificate itself — no manual
   records. (.app is HSTS-preloaded and HTTPS-only; Pages TLS satisfies this
   automatically.)
4. Add `www.splatbook.app` as a second custom domain, then Bulk Redirects (or a Redirect
   Rule): `www.splatbook.app/*` → `https://splatbook.app/$1`, 301.
5. Auth callbacks (phase 4+ in production): set `AUTH_URL=https://splatbook.app` and
   register `https://splatbook.app/auth/callback/google` (and `/discord`) in the
   respective OAuth consoles.

## Alternative: serving from atlas via Cloudflare Tunnel

1. On atlas: `cloudflared tunnel create splatbook`, run `cloudflared` as a container
   alongside the app (docker-compose service, token from the dashboard).
2. Cloudflare dashboard → Zero Trust → Tunnels → route `splatbook.app` to
   `http://app:3000` (the app container). DNS record is created automatically.
3. No ports opened at home; TLS terminates at Cloudflare.

## Verification

After either path: `https://splatbook.app` loads with a padlock,
`https://www.splatbook.app` redirects, and `dig +short splatbook.app` returns Cloudflare
addresses.
