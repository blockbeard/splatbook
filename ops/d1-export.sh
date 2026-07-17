#!/usr/bin/env bash
#
# Nightly D1 export (commit 118) — runs from cron on atlas, dumps *production*
# into a dated, compressed file under a directory the existing 3-2-1 backup
# already sweeps, so the offsite copies come for free.
#
# Design notes, in the order they matter:
#   - Retention is simple on purpose: 14 daily dumps, 12 monthlies (the first
#     dump of each month is copied aside before pruning can eat it).
#   - The success ping to Argus's Uptime Kuma push monitor is the *last* line,
#     after the dump is written, compressed, verified non-empty and rotated —
#     silent cron death is the actual failure mode of home-grown backups, and
#     a push monitor alerts on the night nothing pinged.
#   - `set -euo pipefail` + a temp file renamed into place: a half-written
#     dump never carries the dated name the sweep would trust.
#
# Requirements on atlas:
#   - node 22 + npx (already there for the staging migration step)
#   - CLOUDFLARE_API_TOKEN in the environment file, scoped to D1 read only —
#     a backup job holds the narrowest key that can do its job
#   - CLOUDFLARE_ACCOUNT_ID alongside it
#
# Cron (see docs/deployment.md → "Nightly D1 export to atlas"):
#   15 3 * * *  . /etc/splatbook-backup.env && /opt/splatbook/ops/d1-export.sh
#
set -euo pipefail

# ---- config (override via environment) --------------------------------------
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/storage/backups/splatbook-d1}"
DB_NAME="${DB_NAME:-splatbook}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
# The Kuma push URL for the splatbook-d1-export monitor. Optional but you want
# it: without it, nobody learns the night this stopped running.
KUMA_PUSH_URL="${KUMA_PUSH_URL:-}"
# ------------------------------------------------------------------------------

# Run from the checkout this script lives in: `npx wrangler` then resolves the
# repo's own pinned wrangler (and its wrangler.toml names the database) instead
# of whatever cron's $HOME happens to offer — cron gives no useful cwd.
cd "$(dirname "$(readlink -f "$0")")/.."

today="$(date +%F)"          # 2026-07-17
month="$(date +%Y-%m)"       # 2026-07
daily_dir="$BACKUP_ROOT/daily"
monthly_dir="$BACKUP_ROOT/monthly"
mkdir -p "$daily_dir" "$monthly_dir"

dump="$daily_dir/$DB_NAME-$today.sql"
tmp="$dump.part"

# --remote: production D1, not a local shadow. The API token comes from the
# environment; wrangler needs no interactive login for this.
npx wrangler d1 export "$DB_NAME" --remote --output "$tmp"

# An empty or trivially small dump is a failed dump wearing a success exit.
if [ ! -s "$tmp" ] || [ "$(wc -c <"$tmp")" -lt 1024 ]; then
	echo "d1-export: dump suspiciously small, refusing to keep it" >&2
	rm -f "$tmp"
	exit 1
fi

mv "$tmp" "$dump"
gzip -f "$dump"

# First dump of the month becomes the monthly, before any pruning.
monthly="$monthly_dir/$DB_NAME-$month.sql.gz"
if [ ! -e "$monthly" ]; then
	cp "$dump.gz" "$monthly"
fi

# Retention: newest KEEP_* stay, the rest go. Names sort chronologically.
ls -1 "$daily_dir"/$DB_NAME-*.sql.gz 2>/dev/null | sort | head -n -"$KEEP_DAILY" | xargs -r rm -f
ls -1 "$monthly_dir"/$DB_NAME-*.sql.gz 2>/dev/null | sort | head -n -"$KEEP_MONTHLY" | xargs -r rm -f

# Tell the watchdog tonight happened. Failure to ping is not a backup failure —
# the dump exists — so don't let a Kuma hiccup turn success into a cron error.
if [ -n "$KUMA_PUSH_URL" ]; then
	curl -fsS -m 10 "$KUMA_PUSH_URL" >/dev/null || echo "d1-export: backup ok but Kuma ping failed" >&2
fi

echo "d1-export: wrote $dump.gz"
