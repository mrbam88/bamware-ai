# AI usage dashboard

Personal view of Bilal's AI usage across harnesses: `bamware.io/admin/ai-usage`
(bamware-web#12). Unblocked 2026-09-30: storage is DynamoDB (Bilal's call),
collection runs on the always-on `omarchy` server like the Discord timers.

## Two kinds of numbers, never mixed (re-scope 2026-10-21)

1. **Headline = vendor readings from the CFO.** The CFO (`services/cfo`) is the
   one owner of quota numbers. Every collector run posts each pool in
   `~/.local/state/bamware/cfo/capacity.json` as a `vendor_reading`: the
   vendor's `used_pct` (percent of the window already **used**), `window_min`,
   `observed_at`, `reset_at` and `stale`, verbatim; epoch seconds become ISO UTC
   to the millisecond. Nothing is recomputed or guessed. A pool missing a
   number is skipped and named on stderr. The page shows "N% of the <window>
   window used", "as of <observed_at>", "resets <reset_at>", and a STALE badge
   when the CFO flags it or the reading is over 60 minutes old. Override the
   file with `AI_USAGE_CAPACITY`. No capacity.json yet: transcripts still post.
2. **Estimates = local transcripts.** Tokens and list-price $ below the headline,
   labelled "estimated from local transcripts".

The page also shows a cross-check row per pool (vendor vs estimate). Only the
Claude Max 5-hour pool has an estimate (window tokens over the assumed budget
below); a gap over 10 points is shown in orange.

```
CFO capacity.json ─┐                 (vendor readings, every run)
~/.claude/projects/**/*.jsonl ─┤     (Claude Code transcripts, any machine)
        │  scripts/ai-usage-collect.py   every 2 min (systemd user timer)
        ▼  vendor readings + hourly rollups per session / subagent / model
POST bamware.io/api/ai-usage/ingest   Bearer AI_USAGE_INGEST_TOKEN
        ▼
DynamoDB bamware-dev-ai-usage
   rollups:  PK DAY#<utc date>, SK <HH>#host#source#session#stream#model, TTL 400d
   readings: PK VENDOR#READING, SK <poolKey> (latest per pool; older observations are ignored), TTL 30d
        ▲
/admin/ai-usage (admin JWT)   + CSV paste for Cursor / Cowork
```

Accuracy tests: `tests/test_ai_usage_collect.py` (fixture `tests/ai-usage-fixtures/capacity.json`
-> collector payload, exact) and bamware-web `lib/__tests__/ai-usage-accuracy.test.ts` (same payload ->
ingest -> headline equals the fixture). If `burn_alert.py publish_capacity` changes shape, update the fixture
in both repos.

- **Idempotent.** The collector recomputes each changed transcript's rollups
  whole and the server overwrites them. Re-running, `--all`, or two machines
  posting never double-counts.
- **$ is API-equivalent** at list price (`bamware-web lib/ai-usage/pricing.ts`).
  Max is flat-rate; the number measures weight, not spend.
- **5-hour window** is reconstructed from Claude Code + Cowork rollups on every
  host: a window opens at the first message after the last one expired, floored
  to the hour. "Window tokens" = input + output + cache writes (cache reads
  excluded). It is an estimate and is no longer shown as a percentage on its own.
  The cross-check row divides it by `AI_USAGE_WINDOW_TOKEN_LIMIT` (default 1.5M,
  the unverified figure from `token-diet.md`); a persistent gap against the vendor
  reading tells you what to set it to. The alert banner now comes from the CFO's
  own `level` (warn/critical), not from this estimate.
- **Ticket** is parsed from the branch (`feat/12-x` → `web#12`, `fix/bd-97-y` →
  `brewdesk#97`). **Repo** is the cwd's directory name (worktrees report their
  parent repo), so sessions started in `~` show as `bilalx1`.
- **Sources today:** Claude Code (collector). Cursor, Cowork and anything else:
  CSV paste on the page (`date,source,model,input_tokens,output_tokens[,cost_usd,…]`).
  Anthropic's usage API covers API-billed orgs, not Max, so it isn't used.

## One-time setup (Bilal — needs AWS, Vercel and the server)

1. **Infra** (`bamware-infra`, after its PR merges):
   ```
   cd environments/dev && terraform plan   # expect: table + IAM user + policy, nothing else
   terraform apply
   ```
2. **Access key for Vercel** (kept out of Terraform state on purpose):
   ```
   aws --profile bamware iam create-access-key --user-name bamware-dev-ai-usage-web
   ```
3. **Ingest token** into the vault:
   ```
   aws --profile bamware ssm put-parameter --name /bamware/shared/ai-usage-ingest-token \
     --type SecureString --value "$(openssl rand -hex 32)"
   ```
4. **Vercel env** (bamware-web project, Production): `AI_USAGE_TABLE=bamware-dev-ai-usage`,
   `AI_USAGE_AWS_ACCESS_KEY_ID`, `AI_USAGE_AWS_SECRET_ACCESS_KEY` (from step 2),
   `AI_USAGE_INGEST_TOKEN` (same value as step 3). Optional: `AI_USAGE_WINDOW_TOKEN_LIMIT`,
   `AI_USAGE_TZ`. Redeploy.
5. **Collector on the server** (`ssh bilal@omarchy.tailb7fa1e.ts.net`, in the bamware-ai checkout):
   ```
   git pull && scripts/secrets-pull.sh && scripts/install-ai-usage.sh omarchy
   ```
   The first collection runs in the foreground and fails loudly on a bad token/URL.
   To also count sessions run on the ThinkPad or Mac, run the same installer there
   with `thinkpad` / `mac` (the Mac has no systemd — run the script from launchd or by hand).

## Operating it

- Status: `systemctl --user status bamware-ai-usage.timer`; logs:
  `journalctl --user -u bamware-ai-usage -n 20`.
- Preview without posting: `scripts/ai-usage-collect.py --dry-run`.
- Re-post everything (e.g. after a pricing or schema change): `scripts/ai-usage-collect.py --all`.
- State (which transcripts were already posted): `~/.local/state/bamware/ai-usage-collect.json`.
- Rotate the token: new value in SSM + Vercel, then `secrets-pull.sh` on each collector host.
- Local development of the page: DynamoDB Local + `AI_USAGE_DYNAMODB_ENDPOINT` in
  bamware-web `.env.local` (see `lib/ai-usage/store.ts`).
