// Bamware assistant website client. Text chat against the real Hermes
// runtime, plus browser-side voice (Web Speech API STT, speechSynthesis TTS).
// Voice needs a secure context (HTTPS or localhost); the UI says so when absent.
(() => {
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const els = {
    dot: $("statusDot"), status: $("statusText"),
    tabs: $("tabs"), tabAgents: $("tabAgents"), tabDecisions: $("tabDecisions"),
    loginView: $("loginView"), loginForm: $("loginForm"), password: $("password"), loginHint: $("loginHint"),
    chatView: $("chatView"), transcript: $("transcript"), composer: $("composer"), text: $("text"), sendBtn: $("sendBtn"),
    micBtn: $("micBtn"), stopBtn: $("stopBtn"), voiceBar: $("voiceBar"), voiceState: $("voiceState"), interim: $("interim"),
    sessionLabel: $("sessionLabel"), traceLabel: $("traceLabel"), newBtn: $("newBtn"), exportBtn: $("exportBtn"), deleteBtn: $("deleteBtn"),
    speakToggle: $("speakToggle"), logoutBtn: $("logoutBtn"),
    agentsView: $("agentsView"), systemBanner: $("systemBanner"), systemTitle: $("systemTitle"), systemDetail: $("systemDetail"),
    agentsUpdated: $("agentsUpdated"), agentsRefresh: $("agentsRefresh"), nowHint: $("nowHint"), nowRunning: $("nowRunning"),
    nowRecent: $("nowRecent"), needsCount: $("needsCount"), needsList: $("needsList"), openDecisions: $("openDecisions"),
    capacityHint: $("capacityHint"), capacityList: $("capacityList"), capacityProblems: $("capacityProblems"),
    boardWidget: $("boardWidget"), boardLink: $("boardLink"), boardCounts: $("boardCounts"), boardList: $("boardList"), boardHint: $("boardHint"),
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
    // Chat returns only after the documented shared Chief of Staff readiness gate.
    if (name === "chat") name = "decisions";
    app.dataset.view = name;
    els.loginView.hidden = name !== "login";
    els.chatView.hidden = name !== "chat";
    els.agentsView.hidden = name !== "agents";
    els.decisionsView.hidden = name !== "decisions";
    els.tabs.hidden = name !== "chat" && name !== "agents" && name !== "decisions";
    els.tabAgents.setAttribute("aria-current", String(name === "agents"));
    els.tabDecisions.setAttribute("aria-current", String(name === "decisions"));
    if (name === "chat") els.text.focus();
    if (name === "login") els.password.focus();
    if (name === "agents") loadAgents();
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
    showView("decisions");
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
  // Agents tab V3 (Engineering Lead review, 2026-10-03). One read of
  // /api/agents answers: is the machine working, on what, what is blocking it,
  // and can I afford it. Every value comes from a source of truth server-side;
  // the client only formats. All text goes through textContent.
  const AGENTS_REFRESH_MS = 60_000;
  let agentsLoading = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function ago(ms) {
    if (!ms) return "";
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 90) return "just now";
    if (s < 5400) return `${Math.round(s / 60)} min ago`;
    if (s < 172800) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
  }
  function span(hours) {
    if (hours == null) return null;
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} days`;
  }
  function clock(ms) {
    return ms ? new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "";
  }
  function pill(text, tone) {
    return el("span", `pill ${tone}`, text);
  }
  function ticketLink(ticket) {
    const m = /^(?:([\w.-]+\/[\w.-]+))?#(\d+)$/.exec(ticket ?? "");
    if (!m || !m[1]) return el("span", "rowTitle", ticket ?? "untitled");
    const a = el("a", "rowTitle", `${m[1].split("/")[1]}#${m[2]}`);
    a.href = `https://github.com/${m[1]}/issues/${m[2]}`;
    a.target = "_blank"; a.rel = "noopener";
    return a;
  }
  // A task's own title, with its ticket as a small link; bare ticket or task id when untitled.
  function workLabel(t) {
    if (!t.title) return [ticketLink(t.ticket ?? t.task)];
    const nodes = [el("span", "rowTitle", t.title)];
    if (t.ticket) {
      const link = ticketLink(t.ticket);
      link.className = "rowMeta";
      nodes.push(link);
    }
    return nodes;
  }
  function tokenCount(n) {
    if (n < 1000) return String(n);
    if (n < 1e6) return `${Math.round(n / 1000)}k`;
    return `${(n / 1e6).toFixed(1)}M`;
  }
  function tokenBreakdown(k) {
    const pct = (n) => `${Math.round((n / k.total) * 100)}%`;
    return `${k.total.toLocaleString()} tokens: ${tokenCount(k.cacheRead)} cache reads (${pct(k.cacheRead)}), ` +
      `${tokenCount(k.cacheWrite)} cache writes, ${tokenCount(k.input)} new input, ${tokenCount(k.output)} output` +
      (k.turns ? ` over ${k.turns} turns` : "");
  }
  function row(...children) {
    const li = el("li", "row");
    for (const c of children.flat()) if (c) li.appendChild(c);
    return li;
  }
  function empty(list, text) {
    list.replaceChildren(el("li", "row muted", text));
  }

  const TASK_TONE = { verified: "ok", running: "info", queued: "muted", failed: "err", verification_failed: "err",
    timed_out: "warn", blocked_dependency: "muted", stalled: "warn", interrupted: "warn" };
  const TASK_LABEL = { verification_failed: "checks failed", timed_out: "timed out", blocked_dependency: "blocked" };

  function renderSystem(system, generatedAt) {
    els.systemBanner.dataset.state = system.state;
    els.systemTitle.textContent = system.title;
    const parts = [system.detail];
    if (system.since) parts.push(`since ${clock(system.since)}`);
    if (system.state === "paused" && system.recorded) parts.push(`${system.frozen} of ${system.recorded} sessions still frozen`);
    if (system.note) parts.push(system.note);
    if (system.waiting && system.state !== "awaiting") parts.push(`${system.waiting} waiting on you`);
    els.systemDetail.textContent = parts.filter(Boolean).join(" · ");
    els.agentsUpdated.textContent = `Updated ${ago(generatedAt)}`;
  }

  function renderNow(now) {
    if (!now.running.length) empty(els.nowRunning, "Nothing running.");
    else els.nowRunning.replaceChildren(...now.running.map((t) => row(
      pill(t.state, TASK_TONE[t.state] ?? "muted"), workLabel(t),
      el("span", "rowMeta", t.startedAt ? `started ${ago(t.startedAt)}` : "waiting to start"),
      t.smoke ? pill("smoke test", "muted") : null)));
    els.nowHint.textContent = now.running.length ? `${now.running.length} in the current run` : "";
    if (!now.recent.length) return empty(els.nowRecent, "No executor runs recorded yet.");
    els.nowRecent.replaceChildren(...now.recent.map((t) => {
      const meta = [t.finishedAt ? `finished ${ago(t.finishedAt)}` : t.startedAt ? `started ${ago(t.startedAt)}, never finished` : null,
        t.durationMs != null ? `ran ${span(t.durationMs / 3.6e6)}` : null,
        t.tokens ? `≈${tokenCount(t.tokens.total)} tokens` : null,
        t.cost ? `${t.cost.pct.toFixed(1)}% of ${t.cost.pool}${t.cost.attribution === "shared" ? " (shared)" : ""}` : null,
        t.denials ? `${t.denials} command${t.denials === 1 ? "" : "s"} denied` : null,
        t.exitCode ? `exit ${t.exitCode}` : null].filter(Boolean).join(" · ");
      const metaNode = el("span", "rowMeta", meta);
      if (t.tokens) metaNode.title = tokenBreakdown(t.tokens);
      return row(pill(TASK_LABEL[t.state] ?? t.state, TASK_TONE[t.state] ?? "muted"), workLabel(t),
        metaNode, t.smoke ? pill("smoke test", "muted") : null);
    }));
  }

  function renderNeeds(items) {
    els.needsCount.textContent = items.length ? String(items.length) : "";
    if (!items.length) return empty(els.needsList, "Nothing is waiting on you.");
    els.needsList.replaceChildren(...items.map((i) => {
      const title = i.url ? Object.assign(el("a", "rowTitle", i.title), { href: i.url, target: "_blank", rel: "noopener" }) : el("span", "rowTitle", i.title);
      const li = row(pill(i.kind === "checkpoint" ? "checkpoint" : i.urgency ?? "blocker", i.urgency === "high" ? "err" : "warn"),
        i.project ? el("span", "projectTag", i.project) : null, title,
        i.since ? el("span", "rowMeta", `since ${ago(i.since)}`) : null);
      if (i.action) li.appendChild(el("div", "rowNote", i.action));
      return li;
    }));
  }

  function renderCapacity(capacity) {
    els.capacityHint.textContent = capacity.state === "fresh" ? `CFO · ${ago(capacity.generatedAt)}` : capacity.state === "stale" ? `CFO data is stale (${ago(capacity.generatedAt)})` : "";
    els.capacityHint.classList.toggle("warnText", capacity.state !== "fresh");
    els.capacityProblems.textContent = capacity.problems.length ? `Monitoring gaps: ${capacity.problems.join(" · ")}` : "";
    if (!capacity.pools.length) return empty(els.capacityList, capacity.state === "unavailable" ? "The CFO has not published capacity yet." : "No pools reported.");
    els.capacityList.replaceChildren(...capacity.pools.map((p) => {
      const bar = el("div", "bar");
      bar.dataset.level = p.level;
      const fill = el("span", "barFill"); fill.style.width = `${Math.min(100, Math.max(0, p.usedPct))}%`;
      bar.appendChild(fill);
      if (capacity.reservePct) { const mark = el("span", "barMark"); mark.style.left = `${capacity.reservePct}%`; mark.title = `Reserve starts at ${capacity.reservePct}%`; bar.appendChild(mark); }
      // The CFO decides whether the reserve or exhaustion lands before the reset; the page only formats it.
      const forecast = !(p.ratePctH > 0.05) ? "no recent burn"
        : p.reserveBeforeReset || p.exhaustBeforeReset
          ? [p.reserveBeforeReset ? `reserve in ${span(p.etaReserveH)}` : null, p.exhaustBeforeReset ? `runs out in ${span(p.etaExhaustH)}` : null].filter(Boolean).join(" · ")
          : `burning ${p.ratePctH.toFixed(1)}%/h · safe until reset`;
      const li = row(el("span", "rowTitle", p.label), pill(p.stale ? "stale" : p.level, p.stale ? "muted" : { ok: "ok", warn: "warn", critical: "err" }[p.level] ?? "muted"));
      li.appendChild(bar);
      li.appendChild(el("div", "rowNote", [`${Math.round(p.usedPct)}% used`, p.resetAt ? `resets ${clock(p.resetAt)}` : null, forecast].filter(Boolean).join(" · ")));
      return li;
    }));
  }

  function renderBoard(board) {
    if (!board) { els.boardWidget.hidden = true; return; }
    els.boardWidget.hidden = false;
    els.boardLink.hidden = !board.url;
    if (board.url) els.boardLink.href = board.url;
    const order = ["In Progress", "Todo", "No status", "Done"];
    const rank = (k) => { const i = order.indexOf(k); return i < 0 ? 1.5 : i; }; // unknown statuses after Todo, before Done
    const keys = Object.keys(board.counts).sort((a, b) => rank(a) - rank(b));
    els.boardCounts.replaceChildren(...keys.map((k) => el("span", `chip${k === "In Progress" ? " strong" : ""}`, `${k} ${board.counts[k]}`)));
    if (!board.inProgress.length) empty(els.boardList, board.fetchedAt ? "Nothing in progress." : "Loading the board…");
    else els.boardList.replaceChildren(...board.inProgress.map((i) => {
      const a = el(i.url ? "a" : "span", "rowTitle", i.title);
      if (i.url) Object.assign(a, { href: i.url, target: "_blank", rel: "noopener" });
      return row(i.priority ? pill(i.priority.split(" ")[0], i.priority.startsWith("P0") ? "err" : "muted") : null, a,
        el("span", "rowMeta", i.repo && i.number ? `${i.repo}#${i.number}` : ""));
    }));
    els.boardHint.textContent = board.error ? `Board read failed: ${board.error}${board.fetchedAt ? ` (showing ${ago(board.fetchedAt)})` : ""}` : board.fetchedAt ? `From GitHub ${ago(board.fetchedAt)}` : "";
  }

  async function loadAgents() {
    if (agentsLoading) return;
    agentsLoading = true;
    els.agentsRefresh.disabled = true;
    try {
      const data = await api("GET", "/api/agents");
      renderSystem(data.system, data.generatedAt);
      renderNow(data.now);
      renderNeeds(data.needsYou);
      renderCapacity(data.capacity);
      renderBoard(data.board);
    } catch (err) {
      if (err.status === 401) return showView("login");
      els.systemBanner.dataset.state = "error";
      els.systemTitle.textContent = "Could not load status";
      els.systemDetail.textContent = err.message;
    } finally {
      agentsLoading = false;
      els.agentsRefresh.disabled = false;
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
      const sm = c.scrumMaster;
      const headline = document.createElement("p");
      headline.textContent = `Scrum Master · ${Array.isArray(sm?.assignments) ? `${sm.assignments.length} assigned efforts` : "Assignment data unavailable"} · ${c.currentRuntimeFailure ? "Runtime failure" : c.status || "Status unavailable"}`;
      status.appendChild(headline);
      const timing = document.createElement("p"); timing.className = "dc-meta";
      timing.textContent = `Last sweep: ${c.checkedAt || "not observed"} · Next check: ${c.nextSweepAt || "not scheduled"}`; status.appendChild(timing);
      if (c.currentRuntimeFailure) { const failure = document.createElement("p"); failure.setAttribute("role", "alert"); failure.textContent = `Runtime failure at ${c.currentRuntimeFailure.at || "unknown time"}: ${c.currentRuntimeFailure.detail || "Check unavailable; stored status may be older."}`; status.appendChild(failure); }
      const details = document.createElement("details"), summary = document.createElement("summary");
      summary.textContent = "Delivery assignments and receipts"; details.appendChild(summary);
      const coverage = document.createElement("p"); coverage.textContent = sm?.coverage || c.coverage || "Coverage unavailable."; details.appendChild(coverage);
      for (const a of sm?.assignments || []) {
        const entry = document.createElement("section"), title = document.createElement("strong"); title.textContent = a.title || a.id; entry.appendChild(title);
        const lines = [
          `Assessment: ${a.assessment?.status || "not assessed"} · Next action: ${a.assessment?.nextAction || "not recorded"}`,
          `Source check: ${a.lastSourceCheckAt || "not observed"} · Next check: ${a.nextCheckAt || "not scheduled"}`,
          `Acceptance receipt: ${a.acceptance?.receiptId || "not recorded"} · Run receipt: ${a.assessment?.runReceiptId || "not recorded"}`,
          `Worker: ${a.worker?.status || "not recorded"} · ${a.worker?.liveExecutionObserved === true ? "Execution evidence recorded; see source" : "No live worker execution observed"}`,
        ];
        for (const text of lines) { const p = document.createElement("p"); p.textContent = text; entry.appendChild(p); }
        details.appendChild(entry);
      }
      status.appendChild(details);
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
    if (location.hash.startsWith("#decision=")) {
      try { document.getElementById(`decision-${decodeURIComponent(location.hash.slice(10))}`)?.scrollIntoView({block: "start"}); } catch {}
    }
  }

  function renderDecisionCard(d, mode) {
    const li = document.createElement("li");
    li.className = `decision-card urgency-${d.urgency}`;
    li.id = `decision-${d.id}`;
    if (d.project) li.appendChild(el("div", "projectTag", d.project));

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
    meta.textContent = `${sourceText} · owner: ${d.owner}`;
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

    if (mode === "live") {
      const box = document.createElement("section"); box.className = "dc-discussion";
      const status = document.createElement("p"); status.setAttribute("role", "status");
      status.textContent = d.discussion ? `${d.discussion.stale ? "Proposal changed: resend to update CoS" : d.discussion.status === "ready" ? "Sent to CoS" : "CoS handoff needs attention"}. ${d.discussion.detail || ""}` : "Send this decision’s context to CoS in #bamware-bot. Not execution approval.";
      box.appendChild(status);
      function source(url, label) {
        if (!/^https:\/\/discord\.com\/channels\/\d+\/\d+(?:\/\d+)?$/.test(url || "")) return;
        const a = document.createElement("a"); a.href = url; a.textContent = label; a.target = "_blank"; a.rel = "noopener noreferrer"; box.appendChild(a);
      }
      source(d.discussion?.url, "Open in #bamware-bot ↗");
      function control(label, endpoint) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true; status.textContent = "Sending to CoS…";
          try { await api("POST", `/api/decisions/${encodeURIComponent(d.id)}/${endpoint}`, {candidateVersion: d.version}); await loadDecisions(); }
          catch (e) { status.textContent = `Send to CoS failed: ${e.message}`; }
          finally { button.disabled = false; }
        }); box.appendChild(button);
      }
      control(d.discussion ? "Resend / repair to CoS" : "Send to CoS", "discussion");
      if (d.discussion?.threadId) control("Refresh CoS thread", "discussion/sync");
      if (d.discussion?.pickup) { const p = document.createElement("p"); p.textContent = "CoS reply observed; no worker execution implied."; box.appendChild(p); }
      const summary = d.discussion?.summary;
      if (summary) {
        for (const text of [`Discussion proposal · version ${summary.candidateVersion} · not approved`, summary.summary, summary.proposedRevision ? `Proposed revision: ${summary.proposedRevision}` : "", "This proposal does not change the source decision. Revise the source and its version before approving changed work."]) { const p = document.createElement("p"); p.textContent = text; box.appendChild(p); }
        source(summary.url, "Source discussion message ↗");
      }
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
      for (const action of (mode === "live" ? ["selected", "reject", "defer"] : ["selected", "reject", "discuss", "defer"])) {
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
      if (action === "discuss" && mode === "live") {
        try { await api("POST", `/api/decisions/${encodeURIComponent(d.id)}/discussion`, {candidateVersion: d.version}); }
        catch (e) { alert(`Response saved. Discussion unavailable: ${e.message}`); }
      }
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
  els.tabAgents.addEventListener("click", () => showView("agents"));
  els.tabDecisions.addEventListener("click", () => showView("decisions"));
  els.decisionsRefresh.addEventListener("click", loadDecisions);
  els.decisionsDemoToggle.addEventListener("change", (e) => { decisionsDemoMode = e.target.checked; loadDecisions(); });
  setInterval(() => {
    if (!document.hidden && !els.agentsView.hidden) loadAgents();
  }, AGENTS_REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !els.agentsView.hidden) loadAgents(); });
  els.agentsRefresh.addEventListener("click", loadAgents);
  els.openDecisions.addEventListener("click", () => showView("decisions"));
  window.addEventListener("offline", () => setStatus("error", "Offline"));
  window.addEventListener("online", () => setStatus("ok", "Connected to Hermes"));

  boot();
})();
