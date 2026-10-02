// Read the existing server collector's sanitized samples. No credentials or transcript reads.
import { open } from "node:fs/promises";
import { unsupportedWindow } from "../rate-limits.mjs";
export const CLAUDE_MAX_UNSUPPORTED_REASON = "No authoritative read-only quota source sample is available.";
export async function claudeMaxAdapter({ quotaSamplesFile } = {}) {
  const unavailable = () => [unsupportedWindow({ provider: "claude-max", scope: "quota", reason: CLAUDE_MAX_UNSUPPORTED_REASON })];
  if (!quotaSamplesFile) return unavailable();
  let file;
  try {
    file = await open(quotaSamplesFile, "r");
    const { size } = await file.stat();
    const start = Math.max(0, size - 65536);
    const buffer = Buffer.alloc(size - start);
    await file.read(buffer, 0, buffer.length, start);
    const lines = buffer.toString("utf8").split("\n");
    if (start) lines.shift();
    for (const line of lines.reverse()) {
      if (!line.trim()) continue;
      let sample;
      try { sample = JSON.parse(line); } catch { continue; }
      if (!Number.isFinite(Date.parse(sample.at)) || !Array.isArray(sample.meters)) continue;
      const windows = sample.meters.filter(m =>
        ["session", "weekly", "weekly-fable"].includes(m.kind) &&
        typeof m.percent === "number" && Number.isFinite(m.percent) && m.percent >= 0
      ).map(m => ({
        provider: "claude-max", scope: m.kind, utilizationPct: m.percent,
        usedTokens: null, limitTokens: null,
        resetAt: Number.isFinite(Date.parse(m.resetsAt)) ? m.resetsAt : null,
        resetTimezone: "America/New_York",
        source: {kind: "live", label: "Claude usage endpoint · server collector (10-minute sampling)", fetchedAt: sample.at},
        notes: "Provider-reported allowance percentage; this is not a token cap."
      }));
      return windows.length ? windows : unavailable();
    }
    return unavailable();
  } catch { return unavailable(); }
  finally { await file?.close(); }
}
