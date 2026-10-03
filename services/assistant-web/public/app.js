// Bamware assistant website client. Text chat against the real Hermes
// runtime, plus browser-side voice (Web Speech API STT, speechSynthesis TTS).
// Voice needs a secure context (HTTPS or localhost); the UI says so when absent.
import { renderQuotaMeter } from './quota-meter.js';
(() => {
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const els = {
    dot: $("statusDot"), status: $("statusText"),
    tabs: $("tabs"), tabChat: $("tabChat"), tabAgents: $("tabAgents"), tabDecisions: $("tabDecisions"),
    loginView: $("loginView"), loginForm: $("loginForm"), password: $("password"), loginHint: $("loginHint"),
    chatView: $("chatView"), transcript: $("transcript"), composer: $("composer"), text: $("text"), sendBtn: $("sendBtn"),
    micBtn: $("micBtn"), stopBtn: $("stopBtn"), voiceBar: $("voiceBar"), voiceState: $("voiceState"), interim: $("interim"),
    sessionLabel: $("sessionLabel"), traceLabel: $("traceLabel"), newBtn: $("newBtn"), exportBtn: $("exportBtn"), deleteBtn: $("deleteBtn"),
    speakToggle: $("speakToggle"), logoutBtn: $("logoutBtn"),
    agentsView: $("agentsView"), rateLimitList: $("rateLimitList"), rateLimitsDemoBanner: $("rateLimitsDemoBanner"),
    quotaCoverage: $("quotaCoverage"),
    rateLimitsDemoToggle: $("rateLimitsDemoToggle"), rateLimitsRefresh: $("rateLimitsRefresh"), rateLimitsGenerated: $("rateLimitsGenerated"),
    workUsageProjectFilter: $("workUsageProjectFilter"), workUsageDemoToggle: $("workUsageDemoToggle"), workUsageDemoBanner: $("workUsageDemoBanner"),
    workUsageRefresh: $("workUsageRefresh"), workUsageGenerated: $("workUsageGenerated"), workUsageCoverage: $("workUsageCoverage"),
    usageByTaskList: $("usageByTaskList"), activeAgentsList: $("activeAgentsList"), workVsWaitList: $("workVsWaitList"),
    outcomesList: $("outcomesList"), routingList: $("routingList"),
    decisionsView: $("decisionsView"), decisionList: $("decisionList"), decisionsGenerated: $("decisionsGenerated"),
    decisionsDemoToggle: $("decisionsDemoToggle"), decisionsDemoBanner: $("decisionsDemoBanner"), decisionsRefresh: $("decisionsRefresh"),
  };

  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };

  let sessionId = store.get("aw.sessionId", null);
  let busy = false;

  // ---------------------------------------------------------------- status --
  function setStatus(state, text) {
    els.dot.dataset.state = state;
    els.status.textContent = text;
  }

  function showView(name) {
    app.dataset.view = name;
    els.loginView.hidden = name !== "login";
    els.chatView.hidden = name !== "chat";
    els.agentsView.hidden = name !== "agents";
    els.decisionsView.hidden = name !== "decisions";
    els.tabs.hidden = name !== "chat" && name !== "agents" && name !== "decisions";
    els.tabChat.setAttribute("aria-current", String(name === "chat"));
    els.tabAgents.setAttribute("aria-current", String(name === "agents"));
    els.tabDecisions.setAttribute("aria-current", String(name === "decisions"));
    if (name === "chat") els.text.focus();
    if (name === "login") els.password.focus();
    if (name === "agents") { loadRateLimits(); loadWorkUsage(); }
    if (name === "decisions") loadDecisions();
  }

  // ---------------------------------------------------------------- api -----
  async function api(method, path, body) {
    const res = await fetch(path, {
      method, credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) data = await res.json();
    else data = await res.text();
    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  async function boot() {
    try {
      const me = await api("GET", "/api/me");
      onSignedIn(me);
    } catch (err) {
      if (err.status === 401) { setStatus("ok", "Signed out"); showView("login"); }
      else { setStatus("error", "Server unreachable"); showView("login"); els.loginHint.textContent = err.message; }
    }
  }

  function onSignedIn(me) {
    const lf = me.langfuse || {};
    const lfText = !lf.pluginEnabled ? "Langfuse plugin off" : lf.keysPresent ? "Langfuse keys set" : "Langfuse: no keys (traces off)";
    setStatus("ok", `Connected to Hermes · ${lfText}`);
    showView("chat");
    renderSession();
  }

  // ---------------------------------------------------------------- chat ----
  function addMessage(role, text, extra) {
    const li = document.createElement("li");
    li.className = `msg ${role}`;
    li.textContent = text;
    if (extra) {
      const t = document.createElement("span");
      t.className = "time";
      t.textContent = extra;
      li.appendChild(t);
    }
    els.transcript.appendChild(li);
    els.transcript.scrollTop = els.transcript.scrollHeight;
    return li;
  }

  function renderSession() {
    const has = Boolean(sessionId);
    els.sessionLabel.textContent = has ? `Session ${sessionId}` : "New conversation";
    els.traceLabel.textContent = has ? `trace: ${sessionId}` : "";
    els.exportBtn.disabled = !has;
    els.deleteBtn.disabled = !has;
  }

  // ---------------------------------------------------------------- agents -
  // Rate-limit widget (bamware-ai#75). `demoMode` only ever flips which query
  // the client asks for; it can never relabel a live reading as demo or vice
  // versa — that distinction is made server-side per window (source.kind).
  let demoMode = false;
  let rateLimitsLoading = false;

  const RL_STATE_LABEL = {
    fresh: "Fresh", stale: "Stale", exhausted: "Exhausted", unknown: "Unknown", unsupported: "Unsupported",
  };

  async function loadRateLimits() {
    if (rateLimitsLoading) return;
    rateLimitsLoading = true;
    els.rateLimitList.innerHTML = "";
    const loading = document.createElement("li");
    loading.className = "rl-item rl-loading";
    loading.textContent = "Loading…";
    els.rateLimitList.appendChild(loading);
    try {
      const data = await api("GET", `/api/rate-limits${demoMode ? "?mode=demo" : ""}`);
      renderRateLimits(data);
    } catch (err) {
      els.rateLimitList.innerHTML = "";
      const li = document.createElement("li");
      li.className = "rl-item rl-error";
      li.textContent = `Could not load rate limits: ${err.message}`;
      els.rateLimitList.appendChild(li);
      els.rateLimitsDemoBanner.hidden = true;
      els.quotaCoverage.textContent = "Coverage unavailable until refresh succeeds.";
    } finally {
      rateLimitsLoading = false;
    }
  }

  function renderRateLimits(data) {
    els.rateLimitsDemoBanner.hidden = data.mode !== "demo";
    els.rateLimitList.innerHTML = "";
    if (!data.windows || !data.windows.length) {
      const li = document.createElement("li");
      li.className = "rl-item rl-empty";
      li.textContent = "No providers reported.";
      els.rateLimitList.appendChild(li);
    } else {
      for (const w of data.windows) els.rateLimitList.appendChild(renderRateLimitItem(w));
    }
    els.rateLimitsGenerated.textContent = data.generatedAt ? `Snapshot: ${new Date(data.generatedAt).toLocaleString()}` : "";
    els.quotaCoverage.replaceChildren();
    const seenControls = new Set();
    for (const c of data.coverage || []) {
      const row = document.createElement("p");
      row.className = "rl-meta";
      const age = c.freshnessSec == null ? "observation time unknown" : `${Math.round(c.freshnessSec)}s old`;
      let text = `${c.harness} · ${c.machine} · ${c.provider} · ${c.account || "account unknown"}: ${c.status} · ${age}`;
      if (c.reason) text += ` · ${c.reason}`;
      const key = c.account && c.identityEvidence ? c.account : `${c.harness}:${c.provider}`;
      if (!seenControls.has(key)) {
        const controls = c.controls || {};
        const yesNo = value => value == null ? "unknown" : value ? "yes" : "no";
        text += ` · Credits available: ${yesNo(controls.hasCredits)} · Balance: ${controls.balance ?? "unknown"} · Unlimited credits: ${yesNo(controls.unlimited)} · Banked resets: ${controls.resetCredits ?? "unknown"} · Spend limit: ${controls.spendLimit ?? "unknown"}`;
        seenControls.add(key);
      } else text += " · Shares the account meters and credit controls above";
      row.textContent = text;
      els.quotaCoverage.appendChild(row);
    }
  }

  function renderRateLimitItem(w) {
    const li = document.createElement("li");
    li.className = `rl-item rl-${w.state}`;

    const title = document.createElement("div");
    title.className = "rl-title";
    const name = document.createElement("span");
    name.textContent = `${w.provider} · ${w.scope}`;
    title.appendChild(name);
    const badge = document.createElement("span");
    badge.className = `rl-badge rl-badge-${w.state}`;
    badge.textContent = w.state === "fresh" && w.warning ? "Warning" : RL_STATE_LABEL[w.state] || w.state;
    title.appendChild(badge);
    if (w.source && w.source.kind === "synthetic") {
      const tag = document.createElement("span");
      tag.className = "rl-demo-tag";
      tag.textContent = "SYNTHETIC";
      title.appendChild(tag);
    }
    li.appendChild(title);

    const identity = document.createElement("div");
    identity.className = "rl-meta";
    const origins = (w.observations || [w]).map(o => `${o.harness || "harness unknown"} / ${o.machine || "machine unknown"}`);
    identity.textContent = `${[...new Set(origins)].join(" + ")} · ${w.account || "Account unknown — matching unproven"}`;
    li.appendChild(identity);
    li.appendChild(renderQuotaMeter(w));

    const meta = document.createElement("div");
    meta.className = "rl-meta";
    const resetText = w.resetAt
      ? `Resets ${new Date(w.resetAt).toLocaleString("en-US", {timeZone: w.resetTimezone || "UTC"})} (${w.resetTimezone || "UTC"})`
      : "Reset time unknown";
    const sourceLabel = (w.source && (w.source.label || w.source.kind)) || "unknown source";
    const freshText = w.freshnessSec != null ? `${sourceLabel} · ${Math.round(w.freshnessSec)}s old` : sourceLabel;
    meta.textContent = `${resetText} · ${freshText}`;
    li.appendChild(meta);

    if (w.notes) {
      const notes = document.createElement("div");
      notes.className = "rl-notes";
      notes.textContent = w.notes;
      li.appendChild(notes);
    }
    return li;
  }

  // ---------------------------------------------------------------- work-usage -
  // Project/ticket usage, active agents, work-vs-waiting, outcomes/rework and a
  // routing-recommendation signal (bamware-ai#76). `workUsageDemoMode` only
  // ever changes which query the client asks for; the server decides
  // source.kind per event, same rule as the rate-limits widget.
  let workUsageDemoMode = false;
  let workUsageLoading = false;
  let workUsageLastData = null;
  let workUsageProject = "";
  let workView = "list";
  const treeExpanded = new Set();
  function setWorkView(view) {
    workView = view;
    $("workTreeWidget").hidden = view !== "tree";
    for (const id of ["usageByTaskWidget", "activeAgentsWidget", "workVsWaitWidget", "outcomesWidget"]) $(id).hidden = view === "tree";
    $("workListButton").setAttribute("aria-pressed", String(view === "list"));
    $("workTreeButton").setAttribute("aria-pressed", String(view === "tree"));
  }
  $("workListButton").addEventListener("click", () => setWorkView("list"));
  $("workTreeButton").addEventListener("click", () => setWorkView("tree"));

  function renderWorkTree(data) {
    const container = $("workTreeContent");
    container.replaceChildren();
    $("workTreeCoverage").textContent = data.workTree?.coverage || "Work relationships are unavailable from this source.";
    const projects = (data.workTree?.projects || []).filter(p => !workUsageProject || p.project === workUsageProject);
    const line = (tag, text, className) => {
      const el = document.createElement(tag); el.textContent = text;
      if (className) el.className = className;
      return el;
    };
    const branch = (id, title, note) => {
      const el = document.createElement("details");
      el.className = "workBranch";
      el.open = treeExpanded.has(`${data.mode}:${id}`);
      const summary = line("summary", title);
      summary.appendChild(line("span", note, "treeNote"));
      el.appendChild(summary);
      el.addEventListener("toggle", () => { if (!el.isConnected) return; const k = `${data.mode}:${id}`; el.open ? treeExpanded.add(k) : treeExpanded.delete(k); });
      return el;
    };
    if (!projects.length) container.appendChild(line("p", "No observed work in this scope. Try another project or preview the labeled demo.", "hint"));
    for (const project of projects) {
      const p = branch(project.id, project.name, `${project.taskCount} known tasks · ${project.runCount} recorded runs · ${project.attentionCount} tasks with unresolved recorded signals${project.uncertainCount ? ` · ${project.uncertainCount} uncertain` : ""}`);
      if (project.attentionCount) p.classList.add("treeAttention");
      for (const task of project.tasks) {
        const t = branch(task.id, task.title, task.state);
        if (task.attention) t.classList.add("treeAttention");
        for (const run of task.runs) {
          const r = branch(run.id, `${run.kind} · ${run.provider || "Worker unknown"}`, run.state);
          r.appendChild(line("p", `${run.model || "Model unknown"} · ${run.machine || "Machine unknown"}`, "hint"));
          r.appendChild(line("p", `${run.freshness} · ${run.observedAt ? new Date(run.observedAt).toLocaleString() : "No recorded time"}`, "hint"));
          r.appendChild(line("p", `Source: ${run.source} (${run.sourceKind})`, "hint"));
          if (run.sessionId) r.appendChild(line("p", `Session: ${run.sessionId}`, "hint"));
          if (!run.runKnown) r.appendChild(line("p", "Metadata only; worker run not established.", "hint"));
          t.appendChild(r);
        }
        p.appendChild(t);
      }
      container.appendChild(p);
    }
  }

  const OUTCOME_LABEL = { "verified-pass": "Verified pass", "qa-fail": "QA fail", "retry-pending": "Retry pending", unverified: "Unverified", unknown: "Unknown" };
  const HEARTBEAT_LABEL = { active: "Active", stale: "Stale", unknown: "Unknown" };

  function fmtDuration(ms) {
    if (ms == null) return "unknown";
    const mins = Math.round(ms / 60_000);
    if (mins < 1) return "<1m";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
  function fmtTokens(n) {
    return n == null ? "unknown" : n.toLocaleString();
  }
  function machineLabel(m) {
    if (!m) return "unknown machine";
    if (m.id) return m.id;
    if (m.source === "hostname-ambiguous") return `ambiguous host (${m.hostname})`;
    return m.hostname || "unknown machine";
  }

  async function loadWorkUsage() {
    if (workUsageLoading) return;
    workUsageLoading = true;
    $("workTreeContent").textContent = "Loading work…";
    for (const list of [els.usageByTaskList, els.activeAgentsList, els.workVsWaitList, els.outcomesList]) {
      list.innerHTML = "";
      const li = document.createElement("li");
      li.className = "wu-item wu-loading";
      li.textContent = "Loading…";
      list.appendChild(li);
    }
    try {
      const data = await api("GET", `/api/work-usage${workUsageDemoMode ? "?mode=demo" : ""}`);
      workUsageLastData = data;
      renderWorkUsage(data);
    } catch (err) {
      for (const list of [els.usageByTaskList, els.activeAgentsList, els.workVsWaitList, els.outcomesList]) {
        list.innerHTML = "";
        const li = document.createElement("li");
        li.className = "wu-item wu-error";
        li.textContent = `Could not load: ${err.message}`;
        list.appendChild(li);
      }
      $("workTreeContent").textContent = `Could not load work: ${err.message}. Use Refresh to retry.`;
      $("workTreeCoverage").textContent = "";
      els.workUsageDemoBanner.hidden = true;
      els.workUsageCoverage.textContent = "";
    } finally {
      workUsageLoading = false;
    }
  }

  function renderWorkUsage(data) {
    els.workUsageDemoBanner.hidden = data.mode !== "demo";
    els.workUsageGenerated.textContent = data.generatedAt ? `Snapshot: ${new Date(data.generatedAt).toLocaleString()}` : "";
    const failedAdapters = (data.adapterNotes || []).filter((a) => !a.ok);
    els.workUsageCoverage.textContent = failedAdapters.length
      ? `Coverage gap: ${failedAdapters.map((a) => `${a.name} (${a.error})`).join("; ")}`
      : data.duplicatesDropped
        ? `${data.duplicatesDropped} duplicate reading(s) collapsed.`
        : "";

    const projects = [...new Set([...(data.usageByProjectTask || []).map(s => s.project), ...(data.workTree?.projects || []).map(p => p.project)].filter(Boolean))].sort();
    const prevValue = els.workUsageProjectFilter.value;
    els.workUsageProjectFilter.innerHTML = '<option value="">All</option>';
    for (const p of projects) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      els.workUsageProjectFilter.appendChild(opt);
    }
    workUsageProject = projects.includes(prevValue) ? prevValue : "";
    els.workUsageProjectFilter.value = workUsageProject;

    renderWorkTree(data);
    renderUsageByTask(data);
    renderActiveAgents(data);
    renderWorkVsWait(data);
    renderOutcomes(data);
  }

  function renderUsageByTask(data) {
    const list = els.usageByTaskList;
    list.innerHTML = "";
    const scopes = (data.usageByProjectTask || []).filter((s) => !workUsageProject || s.project === workUsageProject);
    if (!scopes.length && !data.unallocatedUsage) {
      const li = document.createElement("li");
      li.className = "wu-item wu-empty";
      li.textContent = "No project/ticket usage reported.";
      list.appendChild(li);
    }
    for (const s of scopes) list.appendChild(renderUsageScopeItem(s));
    if (data.unallocatedUsage && (!workUsageProject || data.unallocatedUsage.project === workUsageProject)) {
      list.appendChild(renderUsageScopeItem(data.unallocatedUsage, true));
    }
  }

  function renderUsageScopeItem(s, isUnallocated) {
    const li = document.createElement("li");
    li.className = `wu-item${isUnallocated ? " wu-unallocated" : ""}`;

    const title = document.createElement("div");
    title.className = "wu-title";
    const name = document.createElement("span");
    name.textContent = isUnallocated ? "Unallocated usage (no project/ticket)" : `${s.project} · ${s.task.title || `#${s.task.id}`}`;
    title.appendChild(name);
    if (s.retryCount) {
      const b = document.createElement("span");
      b.className = "wu-badge";
      b.textContent = `${s.retryCount} retry${s.retryCount > 1 ? "s" : ""}`;
      title.appendChild(b);
    }
    if (s.qaAttemptCount) {
      const b = document.createElement("span");
      b.className = "wu-badge";
      b.textContent = `${s.qaAttemptCount} QA`;
      title.appendChild(b);
    }
    li.appendChild(title);

    const detail = document.createElement("div");
    detail.className = "wu-detail";
    const partialMark = (f) => (s.partial[f] ? "≥" : "");
    detail.textContent =
      `in ${partialMark("input")}${fmtTokens(s.usage.input)} · out ${partialMark("output")}${fmtTokens(s.usage.output)} · ` +
      `cache-write ${partialMark("cacheWrite5m")}${fmtTokens((s.usage.cacheWrite5m ?? 0) + (s.usage.cacheWrite1h ?? 0) || null)} · ` +
      `cache-read ${partialMark("cacheRead")}${fmtTokens(s.usage.cacheRead)}`;
    li.appendChild(detail);

    if (Object.values(s.partial).some(Boolean)) {
      const note = document.createElement("div");
      note.className = "wu-notes";
      note.textContent = "≥ marks a total with at least one unknown contributing reading (floor, not exact).";
      li.appendChild(note);
    }

    const details = document.createElement("details");
    details.className = "wu-attempts";
    const summary = document.createElement("summary");
    summary.textContent = `${s.attempts.length} attempt${s.attempts.length === 1 ? "" : "s"} — drill down`;
    details.appendChild(summary);
    for (const a of s.attempts) {
      const row = document.createElement("div");
      row.className = "wu-attempt";
      const costText = a.cost.kind === "unknown" || a.cost.amountUsd == null ? "cost unknown" : `${a.cost.kind} $${a.cost.amountUsd.toFixed(2)}`;
      row.textContent =
        `${a.kind} · ${a.model || "unknown model"} · ${machineLabel(a.machine)} · ${OUTCOME_LABEL[a.outcome.state] || a.outcome.state} · ` +
        `${costText}${a.source.kind === "synthetic" ? " · SYNTHETIC" : ""}`;
      details.appendChild(row);
    }
    li.appendChild(details);
    return li;
  }

  function renderActiveAgents(data) {
    const list = els.activeAgentsList;
    list.innerHTML = "";
    const agents = (data.activeAgents || []).filter((a) => !workUsageProject || a.project === workUsageProject);
    if (!agents.length) {
      const li = document.createElement("li");
      li.className = "wu-item wu-empty";
      li.textContent = "No agent sessions reported.";
      list.appendChild(li);
      return;
    }
    for (const a of agents) {
      const li = document.createElement("li");
      li.className = "wu-item";
      const title = document.createElement("div");
      title.className = "wu-title";
      const name = document.createElement("span");
      name.textContent = `${a.provider || "unknown provider"} · ${a.model || "unknown model"}`;
      title.appendChild(name);
      const badge = document.createElement("span");
      badge.className = `wu-badge wu-badge-${a.state}`;
      badge.textContent = HEARTBEAT_LABEL[a.state] || a.state;
      title.appendChild(badge);
      li.appendChild(title);

      const detail = document.createElement("div");
      detail.className = "wu-detail";
      detail.textContent = `${machineLabel(a.machine)} · ${a.project ? `${a.project}${a.task ? " · " + (a.task.title || "#" + a.task.id) : ""}` : "no project attributed"}`;
      li.appendChild(detail);

      const meta = document.createElement("div");
      meta.className = "wu-meta";
      meta.textContent = a.lastSeenAt
        ? `Last heartbeat ${new Date(a.lastSeenAt).toLocaleString()} (${Math.round(a.heartbeatAgeSec / 60)}m ago)${a.state === "stale" ? " — stale, not necessarily still working" : ""}`
        : "Last heartbeat unknown — pickup time not recorded";
      li.appendChild(meta);
      list.appendChild(li);
    }
  }

  function renderWorkVsWait(data) {
    const list = els.workVsWaitList;
    list.innerHTML = "";
    const t = data.timing || {};
    const li = document.createElement("li");
    li.className = "wu-item";
    const title = document.createElement("div");
    title.className = "wu-title";
    title.textContent = "Active vs waiting";
    li.appendChild(title);
    const detail = document.createElement("div");
    detail.className = "wu-detail";
    detail.textContent = `Active ${fmtDuration(t.activeMsTotal)} · Waiting ${fmtDuration(t.waitMsTotal)}`;
    li.appendChild(detail);

    const reasons = Object.entries(t.waitByReason || {});
    if (reasons.length) {
      const bar = document.createElement("div");
      bar.className = "wu-waitbar";
      const total = reasons.reduce((s, [, ms]) => s + ms, 0);
      const colors = { "rate-limit": "var(--err)", permission: "var(--warn)", dependency: "var(--muted)", qa: "var(--accent)", queue: "var(--ok)" };
      for (const [reason, ms] of reasons) {
        const seg = document.createElement("span");
        seg.style.width = `${total ? (ms / total) * 100 : 0}%`;
        seg.style.background = colors[reason] || "var(--line)";
        seg.title = `${reason}: ${fmtDuration(ms)}`;
        bar.appendChild(seg);
      }
      li.appendChild(bar);
      const meta = document.createElement("div");
      meta.className = "wu-meta";
      meta.textContent = reasons.map(([reason, ms]) => `${reason}: ${fmtDuration(ms)}`).join(" · ");
      li.appendChild(meta);
    }
    if (t.unknownTimingCount) {
      const note = document.createElement("div");
      note.className = "wu-notes";
      note.textContent = `${t.unknownTimingCount} event(s) have no timing recorded at all (not counted as zero).`;
      li.appendChild(note);
    }
    list.appendChild(li);
  }

  function renderOutcomes(data) {
    const list = els.outcomesList;
    list.innerHTML = "";
    const o = data.outcomes || {};
    const li = document.createElement("li");
    li.className = "wu-item";
    const title = document.createElement("div");
    title.className = "wu-title";
    title.textContent = `Sample size: ${o.sampleSize ?? 0} attempt(s)`;
    li.appendChild(title);
    const detail = document.createElement("div");
    detail.className = "wu-detail";
    detail.textContent = Object.entries(o.counts || {})
      .filter(([, n]) => n > 0)
      .map(([state, n]) => `${OUTCOME_LABEL[state] || state}: ${n}`)
      .join(" · ") || "No outcomes reported.";
    li.appendChild(detail);
    if (o.retryCount) {
      const meta = document.createElement("div");
      meta.className = "wu-meta";
      meta.textContent = `${o.retryCount} retry attempt(s) in this range.`;
      li.appendChild(meta);
    }
    list.appendChild(li);

    const routingList = els.routingList;
    routingList.innerHTML = "";
    if (!data.routing || !data.routing.length) {
      const empty = document.createElement("li");
      empty.className = "wu-item wu-empty";
      empty.textContent = "No routing rules configured.";
      routingList.appendChild(empty);
      return;
    }
    for (const r of data.routing) {
      const item = document.createElement("li");
      item.className = "wu-item";
      const t = document.createElement("div");
      t.className = "wu-title";
      const name = document.createElement("span");
      name.textContent = `${r.ruleId} → ${r.recommendedModel}`;
      t.appendChild(name);
      const badge = document.createElement("span");
      badge.className = "wu-badge";
      badge.textContent = r.evidence === "sufficient" ? `${Math.round((r.successRate ?? 0) * 100)}% of ${r.sampleSize}` : "insufficient evidence";
      t.appendChild(badge);
      item.appendChild(t);
      if (r.note) {
        const note = document.createElement("div");
        note.className = "wu-notes";
        note.textContent = r.note;
        item.appendChild(note);
      }
      routingList.appendChild(item);
    }
  }

  // ---------------------------------------------------------------- decisions -
  // Command Center Decisions card deck (bamware-ai#78). `demoMode` only ever
  // changes which deck/store the client asks for; the server decides
  // source.kind and handoff status, same rule as the Agents widgets.
  let decisionsDemoMode = false;
  let decisionsLoading = false;

  const URGENCY_LABEL = { low: "Low", medium: "Medium", high: "High" };
  const HANDOFF_LABEL = {
    not_applicable: "No handoff (no consequential action taken)",
    handoff_pending: "Handoff pending — no confirmed live worker interface",
    pickup_confirmed: "Picked up by worker",
    completed: "Completed by worker",
  };

  async function loadDecisions() {
    if (decisionsLoading) return;
    decisionsLoading = true;
    els.decisionList.innerHTML = "";
    const loading = document.createElement("li");
    loading.className = "decision-card dc-loading";
    loading.textContent = "Loading…";
    els.decisionList.appendChild(loading);
    try {
      const data = await api("GET", `/api/decisions${decisionsDemoMode ? "?mode=demo" : ""}`);
      renderDecisions(data);
    } catch (err) {
      els.decisionList.innerHTML = "";
      const li = document.createElement("li");
      li.className = "decision-card dc-error";
      li.textContent = `Could not load decisions: ${err.message}`;
      els.decisionList.appendChild(li);
      els.decisionsDemoBanner.hidden = true;
    } finally {
      decisionsLoading = false;
    }
  }

  function renderDecisions(data) {
    els.decisionsDemoBanner.hidden = data.mode !== "demo";
    els.decisionsGenerated.textContent = data.generatedAt ? `Snapshot: ${new Date(data.generatedAt).toLocaleString()}` : "";
    els.decisionList.innerHTML = "";
    if (data.coordinator) {
      const c = data.coordinator, status = document.createElement("li");
      status.className = "decision-card";
      status.textContent = `Server follow-through: ${c.status} · Last sweep: ${c.checkedAt || "pending"} · Next sweep: ${c.nextSweepAt || "pending"}. ${c.coverage || ""}${c.failures?.length ? ` Source errors: ${c.failures.map(f => f.id).join(", ")}.` : ""}`;
      els.decisionList.appendChild(status);
    }
    if (!data.decisions || !data.decisions.length) {
      const li = document.createElement("li");
      li.className = "decision-card dc-empty";
      li.textContent = "No decisions need your input right now.";
      els.decisionList.appendChild(li);
      return;
    }
    for (const d of data.decisions) els.decisionList.appendChild(renderDecisionCard(d, data.mode));
  }

  function renderDecisionCard(d, mode) {
    const li = document.createElement("li");
    li.className = `decision-card urgency-${d.urgency}`;

    const head = document.createElement("div");
    head.className = "dc-head";
    const title = document.createElement("div");
    title.className = "dc-title";
    title.textContent = d.title;
    head.appendChild(title);
    const badges = document.createElement("div");
    badges.className = "dc-badges";
    const ub = document.createElement("span");
    ub.className = `dc-badge dc-badge-${d.urgency}`;
    ub.textContent = `${URGENCY_LABEL[d.urgency] || d.urgency} urgency`;
    badges.appendChild(ub);
    if (d.source && d.source.kind === "synthetic") {
      const tag = document.createElement("span");
      tag.className = "dc-synthetic";
      tag.textContent = "SYNTHETIC";
      badges.appendChild(tag);
    }
    head.appendChild(badges);
    li.appendChild(head);

    const meta = document.createElement("div");
    meta.className = "dc-meta";
    const sourceText = d.source && d.source.url
      ? d.source.ref
      : (d.source && d.source.ref) || "unknown source";
    meta.textContent = `${d.project} · ${sourceText} · owner: ${d.owner}`;
    li.appendChild(meta);
    if (d.source && d.source.url) {
      const link = document.createElement("a");
      link.href = d.source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "dc-meta";
      link.style.display = "block";
      link.textContent = "Open source →";
      li.appendChild(link);
    }

    const context = document.createElement("div");
    context.className = "dc-context";
    context.textContent = d.context;
    li.appendChild(context);

    if (d.recommendation) {
      const rec = document.createElement("div");
      rec.className = "dc-recommendation";
      const opt = (d.options || []).find((o) => o.id === d.recommendation.optionId);
      rec.textContent = `Recommendation: ${opt ? opt.label : d.recommendation.optionId} — ${d.recommendation.rationale}`;
      li.appendChild(rec);
    }

    if (d.blockedWork && d.blockedWork.length) {
      const blocked = document.createElement("div");
      blocked.className = "dc-blocked";
      blocked.textContent = `Blocked work: ${d.blockedWork.join("; ")}`;
      li.appendChild(blocked);
    }

    if (d.ownerBlocker) {
      const b = d.ownerBlocker, box = document.createElement("div");
      const delivery = b.notifications?.[b.status === "resolved" ? "resolved" : "waiting_for_owner"] ?? b.notification;
      box.className = "dc-handoff"; box.style.whiteSpace = "pre-wrap";
      box.textContent = `Server follow-through: ${b.status}\n${b.reconciliation?.detail || "Awaiting scheduled source check."}\nLast sweep: ${b.lastSweepAt || "not yet checked"} · Next: ${b.nextCheckAt || "pending"}\nDiscord: ${delivery?.status || "pending"}${delivery?.detail ? ` — ${delivery.detail}` : ""}\nWork: ${b.resume?.status || "blocked; no worker dispatched"}\nRuntime: ${b.runtime || "server ledger; scheduler pending"}`;
      li.appendChild(box);
    }

    // Answer / handoff state for an existing response -----------------------
    if (d.response) {
      const answer = document.createElement("div");
      answer.className = `dc-answer${d.stale ? " dc-stale" : ""}`;
      const optLabel = (d.options || []).find((o) => o.id === d.response.selectedOptionId)?.label;
      answer.textContent = d.stale
        ? `Previously ${d.response.action}${optLabel ? ` (${optLabel})` : ""} — the source changed since then; reconsider below.`
        : `${d.response.action.charAt(0).toUpperCase()}${d.response.action.slice(1)}${optLabel ? `: ${optLabel}` : ""} — ${new Date(d.response.decidedAt).toLocaleString()}`;
      li.appendChild(answer);
      if (d.response.note) {
        const noteShown = document.createElement("div");
        noteShown.className = "dc-meta";
        noteShown.textContent = `Note: ${d.response.note}`;
        li.appendChild(noteShown);
      }
      const handoff = document.createElement("div");
      handoff.className = "dc-handoff";
      handoff.textContent = HANDOFF_LABEL[d.handoff.status] || d.handoff.status;
      if (d.handoff.status === "handoff_pending" && d.handoff.reason) handoff.textContent += ` (${d.handoff.reason})`;
      if (d.handoff.status === "pickup_confirmed" && d.handoff.receiptId) handoff.textContent += ` · receipt ${d.handoff.receiptId}`;
      if (d.handoff.status === "completed" && d.handoff.completedAt) handoff.textContent += ` · ${new Date(d.handoff.completedAt).toLocaleString()}`;
      li.appendChild(handoff);
      if (d.handoffCheck) {
        const check = document.createElement("div");
        check.className = "dc-handoff";
        check.style.whiteSpace = "pre-wrap";
        const c = d.handoffCheck;
        check.textContent = `Chief of Staff check: ${c.status}\n${c.summary || c.error || "Queued for a bounded agent check."}\nDiscord: ${c.notification?.status || "not sent yet"}`;
        li.appendChild(check);
      }
      if (d.handoff.status === "pickup_confirmed") {
        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.className = "link";
        refreshBtn.textContent = "Check handoff status";
        refreshBtn.addEventListener("click", () => refreshDecisionHandoff(d.id, mode));
        li.appendChild(refreshBtn);
      }
    }

    // Response controls -------------------------------------------------------
    if (!d.response || d.stale || d.ownerBlocker) {
      const select = document.createElement("select");
      for (const o of d.options || []) {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.label;
        if (d.recommendation && d.recommendation.optionId === o.id) opt.selected = true;
        select.appendChild(opt);
      }
      const note = document.createElement("textarea");
      note.className = "dc-note";
      note.placeholder = "Optional note…";
      li.appendChild(select);
      li.appendChild(note);

      const actions = document.createElement("div");
      actions.className = "dc-actions";
      for (const action of ["selected", "reject", "discuss", "defer"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `dc-${action}`;
        btn.textContent = action === "selected" ? "Use selected option" : action.charAt(0).toUpperCase() + action.slice(1);
        btn.addEventListener("click", () => {
          const selected = (d.options || []).find(o => o.id === select.value);
          respondToDecision(d, action === "selected" ? selected?.action || "approve" : action, action === "selected" ? select.value : null, note.value, mode);
        });
        actions.appendChild(btn);
      }
      li.appendChild(actions);
    }

    return li;
  }

  async function respondToDecision(d, action, selectedOptionId, note, mode) {
    try {
      await api("POST", `/api/decisions/${encodeURIComponent(d.id)}/respond${mode === "demo" ? "?mode=demo" : ""}`, {
        action,
        selectedOptionId: selectedOptionId || null,
        note: note || null,
        candidateVersion: d.version,
      });
      loadDecisions();
    } catch (err) {
      alert(`Could not record response: ${err.message}`);
    }
  }

  async function refreshDecisionHandoff(id, mode) {
    try {
      await api("POST", `/api/decisions/${encodeURIComponent(id)}/handoff/refresh${mode === "demo" ? "?mode=demo" : ""}`);
      loadDecisions();
    } catch (err) {
      alert(`Could not check handoff status: ${err.message}`);
    }
  }

  function setBusy(v) {
    busy = v;
    els.sendBtn.disabled = v;
    els.text.disabled = v;
    if (v) setStatus("busy", "Thinking…");
    else setStatus("ok", "Connected to Hermes");
  }

  async function sendText(text) {
    const trimmed = (text || "").trim();
    if (!trimmed || busy) return;
    stopSpeaking();
    addMessage("user", trimmed);
    els.text.value = "";
    autosize();
    setBusy(true);
    const t0 = performance.now();
    try {
      const r = await api("POST", "/api/chat", { text: trimmed, sessionId });
      if (r.sessionId && r.sessionId !== sessionId) { sessionId = r.sessionId; store.set("aw.sessionId", sessionId); renderSession(); }
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      addMessage("assistant", r.reply, `${secs}s · hermes ${r.elapsedMs} ms`);
      if (els.speakToggle.checked || voice.active) speak(r.reply);
    } catch (err) {
      if (err.status === 401) { showView("login"); setStatus("ok", "Signed out"); return; }
      addMessage("error", `Request failed: ${err.message}${err.data && err.data.requestId ? ` (request ${err.data.requestId})` : ""}`);
      setStatus("error", "Last request failed");
      if (err.data && err.data.sessionId && !sessionId) { sessionId = err.data.sessionId; store.set("aw.sessionId", sessionId); renderSession(); }
      return;
    } finally {
      if (busy) setBusy(false);
      if (voice.active) voice.resume();
    }
  }

  function autosize() {
    els.text.style.height = "auto";
    els.text.style.height = Math.min(els.text.scrollHeight, window.innerHeight * 0.4) + "px";
  }

  // ---------------------------------------------------------------- voice ---
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const secure = window.isSecureContext;
  const voice = {
    active: false, rec: null, speaking: false,
    supported: Boolean(SR) && secure && "speechSynthesis" in window,
    start() {
      if (!this.supported) return;
      this.active = true;
      els.micBtn.setAttribute("aria-pressed", "true");
      els.voiceBar.hidden = false;
      this.listen();
    },
    stop() {
      this.active = false;
      els.micBtn.setAttribute("aria-pressed", "false");
      els.voiceBar.hidden = true;
      els.interim.textContent = "";
      if (this.rec) { try { this.rec.onend = null; this.rec.stop(); } catch {} this.rec = null; }
      stopSpeaking();
    },
    resume() { if (this.active && !this.rec) this.listen(); },
    listen() {
      const rec = new SR();
      this.rec = rec;
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      els.voiceState.textContent = "Listening…";
      rec.onspeechstart = () => { stopSpeaking(); els.voiceState.textContent = "Hearing you…"; };
      rec.onresult = (e) => {
        let interim = "", final = "";
        for (const r of e.results) (r.isFinal ? (final += r[0].transcript) : (interim += r[0].transcript));
        els.interim.textContent = interim;
        if (final.trim()) { els.interim.textContent = ""; els.voiceState.textContent = "Sending…"; this.rec = null; sendText(final); }
      };
      rec.onerror = (e) => {
        this.rec = null;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { addMessage("error", "Microphone permission denied. Allow the mic for this site and try again."); this.stop(); return; }
        if (e.error === "no-speech" || e.error === "aborted") { if (this.active && !busy) this.listen(); return; }
        addMessage("error", `Voice error: ${e.error}`);
        this.stop();
      };
      rec.onend = () => { this.rec = null; if (this.active && !busy && !this.speaking) this.listen(); };
      try { rec.start(); } catch (err) { this.rec = null; addMessage("error", `Could not start listening: ${err.message}`); this.stop(); }
    },
  };

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = navigator.language || "en-US";
    voice.speaking = true;
    els.stopBtn.hidden = false;
    if (voice.active) els.voiceState.textContent = "Speaking… (talk to interrupt)";
    // Keep listening while speaking so the user can barge in; onspeechstart cancels TTS.
    if (voice.active && !voice.rec) voice.listen();
    u.onend = u.onerror = () => { voice.speaking = false; els.stopBtn.hidden = true; if (voice.active) voice.resume(); };
    speechSynthesis.speak(u);
  }
  function stopSpeaking() {
    if ("speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    voice.speaking = false;
    els.stopBtn.hidden = true;
  }

  if (!voice.supported) {
    els.micBtn.disabled = true;
    els.micBtn.title = !secure ? "Voice needs HTTPS or localhost (browser secure context)." : !SR ? "This browser has no speech recognition." : "Speech synthesis unavailable.";
    els.speakToggle.disabled = !("speechSynthesis" in window);
  }

  // ---------------------------------------------------------------- events --
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginHint.textContent = "";
    try {
      await api("POST", "/api/login", { password: els.password.value });
      els.password.value = "";
      boot();
    } catch (err) { els.loginHint.textContent = err.message; }
  });
  els.composer.addEventListener("submit", (e) => { e.preventDefault(); sendText(els.text.value); });
  els.text.addEventListener("input", autosize);
  els.text.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(els.text.value); } });
  els.micBtn.addEventListener("click", () => (voice.active ? voice.stop() : voice.start()));
  els.stopBtn.addEventListener("click", stopSpeaking);
  els.newBtn.addEventListener("click", () => { sessionId = null; store.set("aw.sessionId", null); els.transcript.innerHTML = ""; renderSession(); stopSpeaking(); });
  els.exportBtn.addEventListener("click", () => { if (sessionId) window.location.href = `/api/sessions/${encodeURIComponent(sessionId)}/export`; });
  els.deleteBtn.addEventListener("click", async () => {
    if (!sessionId || !confirm(`Delete Hermes session ${sessionId} from the server? This cannot be undone.`)) return;
    try { await api("DELETE", `/api/sessions/${encodeURIComponent(sessionId)}`); els.newBtn.click(); addMessage("assistant", "Session deleted from the server."); }
    catch (err) { addMessage("error", `Delete failed: ${err.message}`); }
  });
  els.logoutBtn.addEventListener("click", async () => { voice.stop(); try { await api("POST", "/api/logout"); } catch {} showView("login"); setStatus("ok", "Signed out"); });
  els.tabChat.addEventListener("click", () => showView("chat"));
  els.tabAgents.addEventListener("click", () => showView("agents"));
  els.tabDecisions.addEventListener("click", () => showView("decisions"));
  els.decisionsRefresh.addEventListener("click", loadDecisions);
  els.decisionsDemoToggle.addEventListener("change", (e) => { decisionsDemoMode = e.target.checked; loadDecisions(); });
  setInterval(() => {
    if (!document.hidden && !els.agentsView.hidden) loadRateLimits();
  }, 60_000);
  els.rateLimitsRefresh.addEventListener("click", loadRateLimits);
  els.rateLimitsDemoToggle.addEventListener("change", (e) => { demoMode = e.target.checked; loadRateLimits(); });
  els.workUsageRefresh.addEventListener("click", loadWorkUsage);
  els.workUsageDemoToggle.addEventListener("change", (e) => { workUsageDemoMode = e.target.checked; loadWorkUsage(); });
  els.workUsageProjectFilter.addEventListener("change", (e) => { workUsageProject = e.target.value; if (workUsageLastData) renderWorkUsage(workUsageLastData); });
  window.addEventListener("offline", () => setStatus("error", "Offline"));
  window.addEventListener("online", () => setStatus("ok", "Connected to Hermes"));

  boot();
})();
