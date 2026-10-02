// Bamware assistant website client. Text chat against the real Hermes
// runtime, plus browser-side voice (Web Speech API STT, speechSynthesis TTS).
// Voice needs a secure context (HTTPS or localhost); the UI says so when absent.
(() => {
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const els = {
    dot: $("statusDot"), status: $("statusText"),
    tabs: $("tabs"), tabChat: $("tabChat"), tabAgents: $("tabAgents"),
    loginView: $("loginView"), loginForm: $("loginForm"), password: $("password"), loginHint: $("loginHint"),
    chatView: $("chatView"), transcript: $("transcript"), composer: $("composer"), text: $("text"), sendBtn: $("sendBtn"),
    micBtn: $("micBtn"), stopBtn: $("stopBtn"), voiceBar: $("voiceBar"), voiceState: $("voiceState"), interim: $("interim"),
    sessionLabel: $("sessionLabel"), traceLabel: $("traceLabel"), newBtn: $("newBtn"), exportBtn: $("exportBtn"), deleteBtn: $("deleteBtn"),
    speakToggle: $("speakToggle"), logoutBtn: $("logoutBtn"),
    agentsView: $("agentsView"), rateLimitList: $("rateLimitList"), rateLimitsDemoBanner: $("rateLimitsDemoBanner"),
    rateLimitsDemoToggle: $("rateLimitsDemoToggle"), rateLimitsRefresh: $("rateLimitsRefresh"), rateLimitsGenerated: $("rateLimitsGenerated"),
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
    els.tabs.hidden = name !== "chat" && name !== "agents";
    els.tabChat.setAttribute("aria-current", String(name === "chat"));
    els.tabAgents.setAttribute("aria-current", String(name === "agents"));
    if (name === "chat") els.text.focus();
    if (name === "login") els.password.focus();
    if (name === "agents") loadRateLimits();
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
    badge.textContent = RL_STATE_LABEL[w.state] || w.state;
    title.appendChild(badge);
    if (w.source && w.source.kind === "synthetic") {
      const tag = document.createElement("span");
      tag.className = "rl-demo-tag";
      tag.textContent = "SYNTHETIC";
      title.appendChild(tag);
    }
    li.appendChild(title);

    const detail = document.createElement("div");
    detail.className = "rl-detail";
    detail.textContent =
      w.usedTokens != null && w.limitTokens != null
        ? `${w.usedTokens.toLocaleString()} / ${w.limitTokens.toLocaleString()} tokens · ${w.utilizationPct}%`
        : "Usage unknown";
    li.appendChild(detail);

    const meta = document.createElement("div");
    meta.className = "rl-meta";
    const resetText = w.resetAt
      ? `Resets ${new Date(w.resetAt).toLocaleString()}${w.resetTimezone ? ` (${w.resetTimezone})` : ""}`
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
  els.rateLimitsRefresh.addEventListener("click", loadRateLimits);
  els.rateLimitsDemoToggle.addEventListener("change", (e) => { demoMode = e.target.checked; loadRateLimits(); });
  window.addEventListener("offline", () => setStatus("error", "Offline"));
  window.addEventListener("online", () => setStatus("ok", "Connected to Hermes"));

  boot();
})();
