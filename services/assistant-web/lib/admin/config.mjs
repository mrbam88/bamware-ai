// Read existing host-held capabilities in place. Never serialize this object.
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEnvFile } from "../../lib.mjs";

export function loadAdminConfig(env = process.env) {
  const checkout = path.join(os.homedir(), "code/bamware-web/.claude/worktrees/ai-spend-dashboard");
  const source = env.ASSISTANT_ADMIN_ENV_FILE ?? path.join(checkout, ".env.local");
  let vars = {};
  try { vars = parseEnvFile(readFileSync(source, "utf8")); } catch {}
  const get = (key, fallback = "") => env[key] || vars[key] || fallback;
  return {
    datingUrl: get("DATING_API_URL"), authUrl: get("AUTH_API_URL"),
    adminSecret: get("ADMIN_SECRET"), jwtSecret: get("JWT_SECRET"),
    tenantId: get("ADMIN_TENANT_ID", "bamware-dating"),
    snapshotFile: get("AI_SPEND_SNAPSHOT_PATH", path.join(checkout, ".data/ai-spend-snapshot.json")),
    usageEnv: Object.fromEntries(["AI_USAGE_TABLE", "AI_USAGE_AWS_REGION", "AI_USAGE_AWS_ACCESS_KEY_ID", "AI_USAGE_AWS_SECRET_ACCESS_KEY", "AI_USAGE_DYNAMODB_ENDPOINT"].map(k => [k, get(k)])),
    ingestToken: get("AI_USAGE_INGEST_TOKEN"),
    meteredKey: get("ANTHROPIC_ADMIN_KEY") || get("ANTHROPIC_API_KEY") || null,
  };
}
