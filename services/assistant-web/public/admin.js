(() => {
  const $ = id => document.getElementById(id);
  const number = n => typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "Unknown";
  function text(tag, value, className) { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; }
  async function api(path, method = "GET", body) {
    const res = await fetch(path, { method, credentials: "same-origin", headers: { "content-type": "application/json", "x-admin-action": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401) { location.assign("/"); throw new Error("Owner session expired. Sign in to Assistant."); }
    if (!res.headers.get("content-type")?.includes("application/json")) throw new Error(`Unexpected server response (HTTP ${res.status}); no result was assumed.`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  function table(target, headings, rows) {
    const wrap = text("div", "", "admin-table-wrap"); const t = document.createElement("table");
    const head = document.createElement("thead"); const tr = document.createElement("tr");
    headings.forEach(h => { const th = text("th", h); th.scope = "col"; tr.append(th); }); head.append(tr); t.append(head);
    const body = document.createElement("tbody");
    rows.forEach(row => { const r = document.createElement("tr"); row.forEach(v => r.append(text("td", v ?? "Unknown"))); body.append(r); });
    t.append(body); wrap.append(t); target.append(wrap);
  }
  async function load(id, path, render) {
    const target = $(id); target.replaceChildren(text("p", "Loading…", "hint"));
    try { render(target, await api(path)); } catch (err) { target.replaceChildren(text("p", err.message, "admin-error")); }
  }
  function cards(target, values) {
    const grid = text("div", "", "admin-stats");
    for (const [name, value] of values) { const card = text("div", name, "admin-stat"); card.append(text("strong", number(value))); grid.append(card); }
    target.append(grid);
  }
  async function capabilities() {
    try {
      const data = await api("/api/admin/status");
      $("capabilities").textContent = `Host capabilities — stats/seed: ${data.stats ? "configured (not yet verified)" : "unavailable"}; profile account: ${data.profiles ? "connected" : "not connected"}; usage store: ${data.usageStore ? "configured" : "unavailable"}.`;
      $("seed-generate").disabled = $("seed-delete").disabled = !data.seed;
    } catch (err) { $("capabilities").textContent = err.message; }
  }
  const stats = () => load("stats-output", "/api/admin/stats", (el, data) => { el.replaceChildren(); cards(el, [["Real profiles", data.profiles?.real], ["Fake profiles", data.profiles?.fake], ["Matches", data.matches], ["Messages", data.messages], ["Blocks", data.blocks], ["Reports", data.reports]]); });
  const profiles = () => load("profiles-output", "/api/admin/profiles", (el, data) => {
    el.replaceChildren(text("p", data.coverage, "hint"));
    if (!data.profiles.length) el.append(text("p", "The discover feed returned no profiles."));
    else table(el, ["Name", "Age", "Borough", "Seeking", "Status"], data.profiles.map(p => [p.name, p.age, p.borough, p.seeking, p.isActive ? "Active" : "Inactive"]));
  });
  const spend = () => load("spend-output", "/api/admin/ai-spend", (el, data) => {
    el.replaceChildren(text("p", `${data.stale ? "STALE snapshot" : "Snapshot"} · ${data.generatedAt} · ${data.machine}`, "hint"), text("p", data.coverage, "hint"), text("p", data.billing, "hint"));
    cards(el, [["Tokens", data.totals.total], ["Events", data.totals.events]]);
    el.append(text("p", `All-time subscription API-equivalent USD: ${number(data.totals.subscriptionEquivalentUsd)}${data.totals.hasUnpriced ? " + unknown unpriced usage" : ""}. Local metered-event estimate USD: ${number(data.totals.meteredUsd)}. Provider invoice coverage is separate.`, "hint"));
    const composition = document.createElement("details"); composition.append(text("summary", "Token composition"));
    table(composition, ["Class", "Tokens", "Priced API-equivalent USD (partial if unpriced)"], data.composition.lines.map(r => [r.label, number(r.tokens), number(r.costUsd)])); el.append(composition);
    for (const [name, rows] of Object.entries(data.breakdowns)) {
      const detail = document.createElement("details"); detail.append(text("summary", `By ${name}`));
      table(detail, [name, "Tokens", "API-equivalent USD"], rows.map(r => [r.key, number(r.total), r.hasUnpriced ? `${number(r.costUsd)} + unknown` : number(r.costUsd)])); el.append(detail);
    }
    if (data.unpricedModels.length || data.warningCount) el.append(text("p", `Unpriced models: ${data.unpricedModels.join(", ") || "none"}; collector warnings: ${data.warningCount}.`, "hint"));
  });
  const usage = () => load("usage-output", "/api/admin/ai-usage", (el, data) => {
    el.replaceChildren(text("p", data.coverage, "hint")); cards(el, [["Tokens", data.totals.tokens], ["Sessions", data.totals.sessions], ["API-equivalent USD", data.totals.costUsd]]);
    if (data.unpricedModels?.length) el.append(text("p", `Partial cost only. Unpriced models: ${data.unpricedModels.join(", ")}`, "admin-error"));
    for (const [label, rows] of [["Source", data.bySource], ["Repo", data.byRepo], ["Model", data.byModel]]) table(el, [label, "Tokens", "Estimated USD"], rows.map(r => [r.key, number(r.tokens), number(r.costUsd)]));
  });
  $("stats-refresh").onclick = stats; $("profiles-refresh").onclick = profiles; $("spend-refresh").onclick = spend; $("usage-refresh").onclick = usage;
  $("metered-refresh").onclick = () => load("metered-output", "/api/admin/metered-cost", (el, data) => {
    el.replaceChildren();
    if (!data.configured || !data.ok) { el.append(text("p", data.reason || data.error, "hint")); return; }
    el.append(text("p", `Provider cost report: USD ${number(data.totalUsd)} · ${data.from} to ${data.to}${data.truncated ? " · INCOMPLETE: provider has more pages" : ""}`, "hint"));
    table(el, ["Day", "Provider USD"], data.days.map(d => [d.date, number(d.costUsd)]));
  });
  $("profile-login").onsubmit = async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { await api("/api/admin/login", "POST", { email: $("admin-email").value, password: $("admin-password").value }); $("profiles-output").textContent = "Connected. Load profiles to browse."; await capabilities(); }
    catch (err) { $("profiles-output").textContent = err.message; }
    finally { $("admin-password").value = ""; button.disabled = false; }
  };
  $("profile-disconnect").onclick = async () => { try { await api("/api/admin/logout", "POST", {}); $("profiles-output").replaceChildren(text("p", "Account disconnected.")); await capabilities(); } catch (err) { $("profiles-output").textContent = err.message; } };
  async function seed(method) {
    const buttons = [$("seed-generate"), $("seed-delete")]; buttons.forEach(b => b.disabled = true);
    try { const data = await api("/api/admin/seed", method, { count: Number($("seed-count").value), confirmation: $("seed-confirm").value }); $("seed-output").textContent = method === "POST" ? `Created profiles: ${number(data.created)}.` : `Deleted fake profiles: ${number(data.deleted)}.`; await stats(); }
    catch (err) { $("seed-output").textContent = err.message; }
    finally { $("seed-confirm").value = ""; await capabilities(); }
  }
  $("seed-form").onsubmit = event => { event.preventDefault(); seed("POST"); }; $("seed-delete").onclick = () => seed("DELETE");
  $("csv-form").onsubmit = async event => { event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { const data = await api("/api/admin/ai-usage/import", "POST", { csv: $("usage-csv").value }); $("csv-output").textContent = `Stored ${data.written} rollups.`; await usage(); }
    catch (err) { $("csv-output").textContent = err.message; } finally { button.disabled = false; }
  };
  $("signout").onclick = async () => { try { await api("/api/logout", "POST", {}); location.replace("/"); } catch (err) { $("capabilities").textContent = err.message; } };
  capabilities(); stats(); spend(); usage();
})();
