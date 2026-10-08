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

  // CEO-facing status chips only — never raw urgency enums or owner_* codes on the card face.
  const STATUS_FACE = {
    high: "Needs you now",
    medium: "Needs your OK",
    low: "When you can",
  };
  const HANDOFF_LABEL = {
    not_applicable: "No handoff needed",
    handoff_pending: "Saved — waiting on a worker",
    pickup_confirmed: "Worker picked this up",
    completed: "Worker finished",
  };

  // Presentation only: never infer completion from approval, a checker finishing,
  // or an agent replying in Discord. Uncertain/error follow-through stays visible.
  function decisionPresentation(d) {
    const state = (tone, label, archive = false) => ({ tone, label, archive });
    const b = d.ownerBlocker;
    const delivery = b?.notifications?.[b.status === "resolved" ? "resolved" : "waiting_for_owner"] ?? b?.notification;
    const failed = s => ["failed", "interrupted", "unknown", "unavailable", "source_error", "dispatch_unknown", "repair_required"].includes(s);
    if (failed(d.handoffCheck?.status) || failed(d.handoffCheck?.notification?.status)
        || failed(b?.status) || failed(b?.reconciliation?.state) || failed(b?.resume?.status)
        || failed(delivery?.status) || /^Worker error:/.test(d.handoff?.reason || "")
        || (d.discussion && d.discussion.status !== "ready")) {
      return state("error", "! Follow-through needs attention");
    }
    if (d.resolution) return state("resolved", d.resolution.status === "resolved" ? "✓ Resolved" : "↪ Replaced", true);
    if (d.stale) return state("awaiting", "! Needs a fresh look");
    // A still-open blocker takes precedence over an old worker completion.
    if (b && b.status !== "resolved" && !["paused", "cancelled"].includes(b.status)) {
      return state("awaiting", "! Waiting on your action");
    }
    if (!d.response) return state("awaiting", `◇ ${STATUS_FACE[d.urgency] || "Needs your OK"}`);
    if (d.handoff?.status === "completed") return state("resolved", "✓ Worker finished", true);
    if (d.handoff?.status === "pickup_confirmed") return state("working", "↻ Worker picked this up");
    if (d.response.action === "approve") return state("working", "◷ Approved · awaiting worker");
    if (d.response.action === "defer") return state("paused", "Ⅱ Deferred · still open");
    if (d.response.action === "reject" && d.handoff?.status === "not_applicable"
        && !b && !["queued", "running"].includes(d.handoffCheck?.status)) {
      return state("paused", "— Rejected · not dispatched", true);
    }
    return state("working", d.response.action === "discuss" ? "↔ Discussion requested · not approved" : "◷ Response saved · follow-through open");
  }

  let decisionActionPending = false;
  const feedback = el("p", "dc-feedback");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.tabIndex = -1;
  feedback.hidden = true;
  els.decisionList.before(feedback);

  function decisionFeedback(state, text) {
    feedback.dataset.state = state;
    feedback.textContent = text;
    feedback.hidden = false;
  }

  // One mutation at a time: a refresh must not replace a pending card or
  // let a second click submit a conflicting choice. No optimistic approval.
  async function decisionAction(card, button, pending, submit, success) {
    if (decisionActionPending || decisionsLoading) return;
    decisionActionPending = true;
    const controls = [...els.decisionsView.querySelectorAll("button, select, textarea, input")];
    const disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    const label = button.textContent;
    button.textContent = pending;
    card.setAttribute("aria-busy", "true");
    decisionFeedback("pending", `${pending} — ${card.querySelector(".dc-title").textContent}`);
    try {
      const result = await submit();
      const outcome = success(result);
      const message = typeof outcome === "string" ? outcome : outcome.text;
      decisionFeedback(outcome.state || "success", message);
      const refreshed = await loadDecisions(true);
      if (!refreshed) decisionFeedback("warning", `${message} The list could not refresh. Refresh before taking another action.`);
      feedback.focus({ preventScroll: true });
    } catch (err) {
      card.dataset.state = "error";
      card.querySelector(".dc-state-badge").textContent = "! Action not confirmed";
      decisionFeedback("error", `${card.querySelector(".dc-title").textContent}: Could not confirm this action: ${err.message}. Refresh to check its status before retrying.`);
    } finally {
      card.removeAttribute("aria-busy");
      button.textContent = label;
      controls.forEach((control, i) => { control.disabled = disabled[i]; });
      decisionActionPending = false;
    }
  }

  async function loadDecisions(afterAction = false) {
    if (decisionsLoading || (decisionActionPending && afterAction !== true)) return false;
    decisionsLoading = true;
    els.decisionList.innerHTML = "";
    const loading = document.createElement("li");
    loading.className = "decision-card dc-loading";
    loading.textContent = "Loading…";
    els.decisionList.appendChild(loading);
    try {
      const data = await api("GET", `/api/decisions${decisionsDemoMode ? "?mode=demo" : ""}`);
      renderDecisions(data);
      return true;
    } catch (err) {
      els.decisionList.innerHTML = "";
      const li = document.createElement("li");
      li.className = "decision-card dc-error";
      li.textContent = `Could not load decisions: ${err.message}`;
      els.decisionList.appendChild(li);
      els.decisionsDemoBanner.hidden = true;
      return false;
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
      const coordinatorError = c.currentRuntimeFailure || ["failed", "partial", "unavailable"].includes(c.status) || c.failures?.length;
      status.className = `decision-card dc-operations${coordinatorError ? " dc-error" : ""}`;
      const sm = c.scrumMaster;
      const headline = document.createElement("p");
      headline.textContent = `Scrum Master · ${Array.isArray(sm?.assignments) ? `${sm.assignments.length} assigned efforts` : "Assignment data unavailable"} · ${c.currentRuntimeFailure ? "Runtime failure" : c.status || "Status unavailable"}`;

      const timing = document.createElement("p"); timing.className = "dc-meta";
      timing.textContent = `Last sweep: ${c.checkedAt || "not observed"} · Next check: ${c.nextSweepAt || "not scheduled"}`;
      if (c.currentRuntimeFailure) { const failure = document.createElement("p"); failure.setAttribute("role", "alert"); failure.textContent = `Runtime failure at ${c.currentRuntimeFailure.at || "unknown time"}: ${c.currentRuntimeFailure.detail || "Check unavailable; stored status may be older."}`; status.appendChild(failure); }
      else if (coordinatorError) {
        const failure = el("p", "", "! Delivery supervision needs attention — see assignments and receipts.");
        failure.setAttribute("role", "alert"); status.appendChild(failure);
      }
      const details = document.createElement("details"), summary = document.createElement("summary");
      summary.textContent = "Delivery assignments and receipts"; details.appendChild(summary);
      details.appendChild(headline);
      details.appendChild(timing);
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
    const all = [...(data.decisions || []), ...(data.history || [])];
    const active = all.filter(d => !decisionPresentation(d).archive);
    const archived = all.filter(d => decisionPresentation(d).archive);
    // Decisions/errors first; unresolved follow-through remains visible but compact.
    active.sort((a, b) => {
      const rank = { error: 0, awaiting: 1, working: 2, paused: 3 };
      return rank[decisionPresentation(a).tone] - rank[decisionPresentation(b).tone];
    });
    if (!active.length) {
      const li = el("li", "decision-card dc-empty", "✓ Board clear — no open decisions or follow-through. Recorded decisions are kept in History.");
      els.decisionList.appendChild(li);
    }
    for (const d of active) els.decisionList.appendChild(renderDecisionCard(d, data.mode));
    // Keep operational receipts available, below the decisions that need input.
    if (data.coordinator) els.decisionList.appendChild(els.decisionList.firstElementChild);
    if (archived.length) {
      const li = el("li", "dc-history");
      const history = el("details", "dc-history-disclosure");
      history.appendChild(el("summary", "", `History (${archived.length}) · resolved, replaced & closed decisions`));
      const list = el("ul", "decisionList");
      for (const d of archived) list.appendChild(renderDecisionCard(d, data.mode));
      history.appendChild(list);
      li.appendChild(history);
      els.decisionList.appendChild(li);
    }
    if (location.hash.startsWith("#decision=")) {
      try {
        const target = document.getElementById(`decision-${decodeURIComponent(location.hash.slice(10))}`);
        const history = target?.closest(".dc-history-disclosure");
        if (history) history.open = true;
        target?.scrollIntoView({block: "start"});
      } catch {}
    }
  }

  function renderDecisionCard(d, mode) {
    // Face hierarchy (bamware-ai#141): title → status → ask → 2–3 options.
    // Rationale, source refs, owner labels, blocked lists, and technical
    // follow-through stay collapsed so a CEO can decide in <10s.
    const li = document.createElement("li");
    const presentation = decisionPresentation(d);
    li.className = `decision-card urgency-${d.urgency}`;
    li.dataset.state = presentation.tone;
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
    ub.className = "dc-badge dc-state-badge";
    const answered = Boolean(d.response) && !d.stale;
    ub.textContent = presentation.label;
    badges.appendChild(ub);
    if (d.source && d.source.kind === "synthetic") {
      const tag = document.createElement("span");
      tag.className = "dc-synthetic";
      tag.textContent = "DEMO";
      badges.appendChild(tag);
    }
    head.appendChild(badges);
    li.appendChild(head);

    const askText = d.summary || (d.context ? String(d.context).split(/(?<=\.)\s+/)[0] : "");
    if (askText) {
      const ask = document.createElement("p");
      ask.className = "dc-ask";
      ask.textContent = askText;
      li.appendChild(ask);
    }

    const recOpt = d.recommendation
      ? (d.options || []).find((o) => o.id === d.recommendation.optionId)
      : null;
    if (recOpt && !answered && !d.resolution) {
      const rec = document.createElement("p");
      rec.className = "dc-suggested";
      rec.textContent = `Suggested: ${recOpt.label}`;
      li.appendChild(rec);
    }

    // Answer / handoff state for an existing response -----------------------
    if (d.response) {
      const answer = document.createElement("div");
      answer.className = `dc-answer${d.stale ? " dc-stale" : ""}`;
      const optLabel = (d.options || []).find((o) => o.id === d.response.selectedOptionId)?.label ?? d.response.selectedOptionId;
      answer.textContent = d.stale && !d.resolution
        ? `Earlier choice${optLabel ? `: ${optLabel}` : ""} — the ask changed; pick again.`
        : `${d.response.action.charAt(0).toUpperCase()}${d.response.action.slice(1)}${optLabel ? `: ${optLabel}` : ""} · ${new Date(d.response.decidedAt).toLocaleString()}`;
      li.appendChild(answer);
      if (d.response.note) {
        const noteShown = document.createElement("div");
        noteShown.className = "dc-meta";
        noteShown.textContent = `Note: ${d.response.note}`;
        li.appendChild(noteShown);
      }
      const handoff = document.createElement("div");
      handoff.className = "dc-handoff";
      handoff.textContent = HANDOFF_LABEL[d.handoff?.status] || "Status unavailable";
      if (d.resolution) handoff.textContent = `Recorded handoff before retirement: ${handoff.textContent}`;
      li.appendChild(handoff);
      if (d.handoff?.status === "pickup_confirmed" && !d.resolution) {
        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.className = "link";
        refreshBtn.textContent = "Check progress";
        refreshBtn.addEventListener("click", () => refreshDecisionHandoff(d.id, mode));
        li.appendChild(refreshBtn);
      }
    }

    // Response controls — options first, then confirm/reject/defer ----------
    let select = null;
    let note = null;
    if (!d.resolution && !presentation.archive && (!d.response || d.stale || d.ownerBlocker)) {
      const choices = document.createElement("div");
      choices.className = "dc-choices";
      const choiceLabel = document.createElement("div");
      choiceLabel.className = "dc-choices-label";
      choiceLabel.textContent = "Your options";
      choices.appendChild(choiceLabel);
      // Native select stays for a11y + tests; chips are the CEO-scannable face.
      select = document.createElement("select");
      select.className = "dc-select-sr";
      select.setAttribute("aria-label", "Decision option");
      for (const o of d.options || []) {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.label;
        if (d.recommendation && d.recommendation.optionId === o.id) opt.selected = true;
        select.appendChild(opt);
      }
      choices.appendChild(select);
      // Native <button> chips (not a faux listbox): Tab/Enter/Space work for
      // free, and decisionAction's button-disabling freezes them while a
      // submit is pending (bamware-ai#154 — chips stayed clickable mid-POST).
      // pick() also refuses while pending/disabled/busy so programmatic
      // click/change cannot flip the displayed in-flight selection.
      const chips = document.createElement("div");
      chips.className = "dc-option-chips";
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-label", "Decision options");
      let committedOptionId = select.value;
      const selectionLocked = () =>
        decisionActionPending || select.disabled || li.getAttribute("aria-busy") === "true";
      const syncChips = () => {
        for (const c of chips.querySelectorAll(".dc-option-chip")) {
          const on = c.dataset.optionId === committedOptionId;
          c.classList.toggle("is-selected", on);
          c.setAttribute("aria-pressed", String(on));
        }
      };
      const pick = (optionId) => {
        if (selectionLocked()) return;
        select.value = optionId;
        committedOptionId = optionId;
        syncChips();
      };
      for (const o of d.options || []) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "dc-option-chip" + (d.recommendation && d.recommendation.optionId === o.id ? " is-suggested" : "");
        row.dataset.optionId = o.id;
        row.textContent = o.label;
        row.addEventListener("click", () => pick(o.id));
        chips.appendChild(row);
      }
      select.addEventListener("change", () => {
        if (selectionLocked()) {
          select.value = committedOptionId;
          return;
        }
        committedOptionId = select.value;
        syncChips();
      });
      syncChips();
      choices.appendChild(chips);
      li.appendChild(choices);

      note = document.createElement("textarea");
      note.className = "dc-note";
      note.placeholder = "Optional note…";
      note.setAttribute("aria-label", "Optional note");
      li.appendChild(note);

      const actions = document.createElement("div");
      actions.className = "dc-actions";
      for (const action of (mode === "live" ? ["selected", "reject", "defer"] : ["selected", "reject", "discuss", "defer"])) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `dc-${action}`;
        btn.textContent = action === "selected" ? "Confirm" : action.charAt(0).toUpperCase() + action.slice(1);
        btn.addEventListener("click", () => {
          const selected = (d.options || []).find(o => o.id === select.value);
          respondToDecision(d, action === "selected" ? selected?.action || "approve" : action, action === "selected" ? select.value : null, note.value, mode, li, btn);
        });
        actions.appendChild(btn);
      }
      li.appendChild(actions);
    }

    // Expandable details: rationale, blocked work, source, owner blocker, handoff check.
    // Comes before Discuss so the decide path stays primary on the face.
    const details = document.createElement("details");
    details.className = "dc-more";
    details.appendChild(el("summary", "", "Details"));
    let hasDetails = false;

    if (d.resolution) {
      li.appendChild(el("p", "dc-resolution", d.resolution.reason));
      const ref = d.resolution.evidence?.ref || "Not recorded";
      if (/^https?:\/\//.test(ref)) {
        const link = el("a", "dc-meta", "Resolution source");
        link.href = ref; link.target = "_blank"; link.rel = "noopener noreferrer";
        details.appendChild(link);
      } else details.appendChild(el("p", "dc-meta", `Evidence: ${ref}`));
    }
    if (presentation.tone === "error") {
      li.appendChild(el("p", "dc-status-detail", d.handoffCheck?.error || d.discussion?.detail || d.ownerBlocker?.reconciliation?.detail || d.handoff?.reason || "Check delivery and progress details before retrying."));
    }

    if (d.recommendation?.rationale) {
      details.appendChild(el("p", "dc-context", `Why suggested: ${d.recommendation.rationale}`));
      hasDetails = true;
    }
    if (d.blockedWork && d.blockedWork.length) {
      const blocked = document.createElement("div");
      blocked.className = "dc-blocked";
      blocked.appendChild(el("span", "dc-blocked-label", answered || d.resolution ? "Work linked to the original ask" : "Blocked until you decide"));
      const list = document.createElement("ul");
      for (const item of d.blockedWork) list.appendChild(el("li", "", item));
      blocked.appendChild(list);
      details.appendChild(blocked);
      hasDetails = true;
    }
    if (d.context) {
      details.appendChild(el("p", "dc-context", d.context));
      hasDetails = true;
    }
    const sourceText = d.source?.ref || "unknown source";
    const meta = el("p", "dc-meta", sourceText);
    details.appendChild(meta);
    if (d.source?.url) {
      const link = document.createElement("a");
      link.href = d.source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "dc-meta";
      link.textContent = "Open source →";
      details.appendChild(link);
    }
    hasDetails = true;

    if (d.ownerBlocker) {
      const b = d.ownerBlocker;
      const delivery = b.notifications?.[b.status === "resolved" ? "resolved" : "waiting_for_owner"] ?? b.notification;
      // One short line on the face; jargon lives inside Details.
      if (!answered) {
        li.appendChild(el("p", "dc-handoff", b.status === "resolved"
          ? "Follow-through resolved."
          : (b.reconciliation?.detail || "Waiting on your action — see Details.")));
      }
      details.appendChild(el("p", "dc-context", [
        `Follow-through: ${b.status}`,
        b.reconciliation?.detail || "Awaiting scheduled source check.",
        `Last check: ${b.lastSweepAt || "not yet"} · Next: ${b.nextCheckAt || "pending"}`,
        `Notify: ${delivery?.status || "pending"}${delivery?.detail ? ` — ${delivery.detail}` : ""}`,
        `Work: ${b.resume?.status || "blocked"}`,
      ].join("\n")));
      hasDetails = true;
    }

    if (d.handoffCheck) {
      const c = d.handoffCheck;
      details.appendChild(el("p", "dc-context", [
        `Progress check: ${c.status}`,
        c.summary || c.error || "Queued for a check.",
        `Notify: ${c.notification?.status || "not sent yet"}`,
      ].join("\n")));
      hasDetails = true;
    }
    if (d.handoff?.status === "handoff_pending" && d.handoff.reason) {
      details.appendChild(el("p", "dc-meta", d.handoff.reason));
      hasDetails = true;
    }
    if (d.handoff?.status === "pickup_confirmed" && d.handoff.receiptId) {
      details.appendChild(el("p", "dc-meta", `Receipt: ${d.handoff.receiptId}`));
      hasDetails = true;
    }
    if (d.handoff?.status === "completed" && d.handoff.completedAt) {
      details.appendChild(el("p", "dc-meta", `Finished ${new Date(d.handoff.completedAt).toLocaleString()}`));
      hasDetails = true;
    }

    if (hasDetails) li.appendChild(details);

    if (mode === "live" && !d.resolution && !presentation.archive) {
      const box = document.createElement("section"); box.className = "dc-discussion";
      const status = document.createElement("p"); status.setAttribute("role", "status");
      status.textContent = d.discussion
        ? (d.discussion.stale ? "Proposal changed — resend to update."
          : d.discussion.status === "ready" ? "Sent to #command-center."
          : `Send needs attention${d.discussion.detail ? `: ${d.discussion.detail}` : "."}`)
        : "Discuss with CoS — not approval.";
      box.appendChild(status);
      function source(url, label) {
        if (!/^https:\/\/discord\.com\/channels\/\d+\/\d+(?:\/\d+)?$/.test(url || "")) return;
        const a = document.createElement("a"); a.href = url; a.textContent = label; a.target = "_blank"; a.rel = "noopener noreferrer"; box.appendChild(a);
      }
      source(d.discussion?.url, "Open in #command-center ↗");
      function control(label, endpoint) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = label;
        button.addEventListener("click", () => decisionAction(li, button,
          endpoint === "discussion" ? "Sending…" : "Refreshing…",
          () => api("POST", `/api/decisions/${encodeURIComponent(d.id)}/${endpoint}`, {candidateVersion: d.version}),
          result => {
            if (result.discussion?.status !== "ready") throw new Error(result.discussion?.detail || "Send needs attention");
            return `${d.title}: ${endpoint === "discussion" ? "Sent to #command-center. Not execution approval." : "Discussion refreshed."}`;
          })); box.appendChild(button);
      }
      control(d.discussion ? "Resend / repair" : "Send to #command-center", "discussion");
      if (d.discussion?.threadId) control("Refresh discussion", "discussion/sync");
      // Long discussion payloads stay collapsed so the face stays scannable.
      if (d.discussion?.pickup || d.discussion?.summary) {
        const more = document.createElement("details");
        more.className = "dc-more";
        more.appendChild(el("summary", "", "Discussion notes"));
        if (d.discussion?.pickup) more.appendChild(el("p", "", "Agent reply observed; no worker execution implied."));
        const summary = d.discussion?.summary;
        if (summary) {
          for (const text of [
            `Proposal only · not approved`,
            summary.summary,
            summary.proposedRevision ? `Proposed revision: ${summary.proposedRevision}` : "",
            "Does not change the source decision. Update the source before approving changed work.",
          ].filter(Boolean)) more.appendChild(el("p", "", text));
          source(summary.url, "Source discussion message ↗");
        }
        box.appendChild(more);
      }
      li.appendChild(box);
    }

    // Old asks, notes and discussion remain available without competing with
    // current state. Keep owner-action controls and errors on the face.
    if ((answered && !d.ownerBlocker) || d.resolution) {
      li.classList.add("dc-compact");
      for (const node of [...li.children]) {
        if (node.matches(".dc-ask, .dc-meta, .dc-handoff, .dc-discussion")) details.appendChild(node);
      }
    }
    return li;
  }

  async function respondToDecision(d, action, selectedOptionId, note, mode, card, button) {
    const pending = { approve: "Approving…", reject: "Rejecting…", defer: "Deferring…", discuss: "Saving…" };
    const saved = { approve: "Approval saved. Worker completion is separate.", reject: "Rejected.", defer: "Deferred.", discuss: "Discussion request saved." };
    return decisionAction(card, button, pending[action] || "Saving…",
      async () => {
        await api("POST", `/api/decisions/${encodeURIComponent(d.id)}/respond${mode === "demo" ? "?mode=demo" : ""}`, {
          action,
          selectedOptionId: selectedOptionId || null,
          note: note || null,
          candidateVersion: d.version,
        });
        if (action === "discuss" && mode === "live") {
          try {
            const result = await api("POST", `/api/decisions/${encodeURIComponent(d.id)}/discussion`, {candidateVersion: d.version});
            if (result.discussion?.status !== "ready") throw new Error(result.discussion?.detail || "Send needs attention");
          } catch (err) { return { discussionError: err.message }; }
        }
        return {};
      }, result => result.discussionError
        ? { state: "warning", text: `${d.title}: Response saved. Discussion needs attention: ${result.discussionError}` }
        : `${d.title}: ${saved[action] || "Response saved."}`);
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
