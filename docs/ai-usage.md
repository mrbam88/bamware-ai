# AI usage dashboard

Personal view of Bilal's AI usage across harnesses: `bamware.io/admin/ai-usage`
(bamware-web#12). Unblocked 2026-09-30: storage is DynamoDB (Bilal's call),
collection runs on the always-on `omarchy` server like the Discord timers.

## How it fits together

```
~/.claude/projects/**/*.jsonl      (Claude Code transcripts, any machine)
        │  scripts/ai-usage-collect.py   every 2 min (systemd user timer)
        ▼  hourly rollups per session / subagent / model
POST bamware.io/api/ai-usage/ingest   Bearer AI_USAGE_INGEST_TOKEN
        ▼
DynamoDB bamware-dev-ai-usage   (PK DAY#<utc date>, SK <HH>#host#source#session#stream#model, TTL 400d)
        ▲
/admin/ai-usage (admin JWT)   + CSV paste for Cursor / Cowork
```

- **Idempotent.** The collector recomputes each changed transcript's rollups
  whole and the server overwrites them. Re-running, `--all`, or two machines
  posting never double-counts.
- **$ is API-equivalent** at list price (`bamware-web lib/ai-usage/pricing.ts`).
  Max is flat-rate; the number measures weight, not spend.
- **5-hour window** is reconstructed from Claude Code + Cowork rollups on every
  host: a window opens at the first message after the last one expired, floored
  to the hour. "Window tokens" = input + output + cache writes (cache reads
  excluded). The limit is `AI_USAGE_WINDOW_TOKEN_LIMIT` (default 1.5M, the
  unverified figure from `token-diet.md`). **When you hit a real limit, note the
  gauge reading and set the env var to it** — that turns the gauge into a
  measured one. The banner shows at 80%.
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
