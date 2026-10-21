import path from "node:path";
import { readFileSync } from "node:fs";
import { createAdminService } from "./service.mjs";
import { safeEqual, LoginLimiter } from "../../lib.mjs";

// One router instance per server keeps backend sessions and the login limiter
// scoped to that server. Every admin request checks the owner session again.
export function createAdminRouter(cfg, { authed, sessionKey, send, readJson, service = createAdminService(cfg.admin) }) {
  const limiter = new LoginLimiter();
  const handle = async (req, res, url) => {
    const page = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
    const ingest = url.pathname === "/api/ai-usage/ingest";
    if (!page && !ingest && !url.pathname.startsWith("/api/admin/")) return false;
    const machine = ingest && req.method === "POST" && Boolean(cfg.admin.ingestToken) && safeEqual(req.headers.authorization ?? "", `Bearer ${cfg.admin.ingestToken}`);
    if (!authed(req) && !machine) {
      send(res, page ? 303 : 401, page ? "Sign in to Bamware Assistant." : { error: "Sign in first." }, page ? { location: "/" } : {});
      return true;
    }
    const key = sessionKey(req);
    try {
      if (page) {
        if (req.method !== "GET") { send(res, 405, { error: "Method not allowed." }); return true; }
        send(res, 200, readFileSync(path.join(cfg.publicDir, "admin.html")), { "content-type": "text/html; charset=utf-8" });
        return true;
      }
      if (!["GET", "HEAD"].includes(req.method) && !machine) {
        // The custom header requires a CORS preflight cross-origin, for which
        // this server grants no access. Also reject explicitly foreign origins.
        let foreign = false;
        if (req.headers.origin) {
          try { foreign = new URL(req.headers.origin).host !== req.headers.host; } catch { foreign = true; }
        }
        if (req.headers["x-admin-action"] !== "1" || foreign) { send(res, 403, { error: "Same-origin admin action required." }); return true; }
      }
      let result;
      switch (`${req.method} ${url.pathname}`) {
        case "GET /api/admin/status": result = service.status(key); break;
        case "GET /api/admin/stats": result = await service.stats(); break;
        case "GET /api/admin/profiles": result = await service.profiles(key); break;
        case "GET /api/admin/ai-spend": result = await service.spend(); break;
        case "GET /api/admin/metered-cost": result = await service.metered(); break;
        case "GET /api/admin/ai-usage": result = await service.usage(); break;
        case "POST /api/admin/login": {
          const client = req.socket.remoteAddress ?? "unknown";
          if (limiter.blocked(client)) { send(res, 429, { error: "Too many account connection attempts. Try again in 15 minutes." }); return true; }
          try { result = await service.login(key, await readJson(req, 4096)); limiter.reset(client); }
          catch (error) { if ([400, 403].includes(error.status)) limiter.fail(client); throw error; }
          break;
        }
        case "POST /api/admin/logout": result = service.logout(key); break;
        case "POST /api/admin/seed":
        case "DELETE /api/admin/seed": result = await service.seed(req.method, await readJson(req, 4096)); break;
        case "POST /api/admin/ai-usage/import": result = await service.importCsv(await readJson(req, 1_100_000)); break;
        case "POST /api/ai-usage/ingest": result = await service.ingest(await readJson(req, 2_000_000)); break;
        default: send(res, 404, { error: "Unknown admin route." }); return true;
      }
      send(res, 200, result);
    } catch (error) {
      // Only our bounded, deliberately redacted errors reach clients. Unknown
      // dependency exceptions never enter the application's outer error logger.
      send(res, error.status ?? 500, { error: error.status ? error.message : "Admin operation failed; no result was assumed." });
    }
    return true;
  };
  handle.clearSession = req => service.logout(sessionKey(req));
  return handle;
}
