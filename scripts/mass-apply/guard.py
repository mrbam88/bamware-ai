#!/usr/bin/env python3
"""
Duplicate guard for fill.py: decides, before any form is opened, which queue
lines must not be filled.

Why it exists (2026-10-10): run 20261010-1224 refilled Gusto, Nectar Social and
Found although all three had been submitted days earlier. The tracker rows still
said "Ready to submit" because Bilal had submitted from the open tabs and the
status had not been flipped yet, and fill.py filled whatever the queue said.

Two independent sources, because either one alone was wrong that day:

  1. The tracker ledger: an export of the Notion Applications table written by
     the agent session right before the run (fill.py has no Notion access).
     Must be fresh, or nothing is filled.
  2. Run history: every form fill.py has already filled. A filled form sits in
     Bilal's Chrome with a Submit button, so "filled before" is treated as
     "may already be submitted" until he says otherwise (--refill).

Pure functions, no Playwright, so it is unit-tested (test_guard.py).
"""
import datetime, json, pathlib, re, urllib.parse

# Statuses meaning "this posting is finished business": never fill it again.
DONE = {"Applied", "Screen", "Interviewing", "Offer", "Rejected", "Withdrawn"}
# Statuses meaning "there is a live application at this company" (one role per
# company) or "they turned him down" (no re-apply after a recent rejection).
ACTIVE = {"Applied", "Screen", "Interviewing", "Offer"}
# "Ready to submit" means a form was already filled and handed to Bilal, by
# fill.py or by any other route (Chrome extension, live fill). Four such forms
# from 2026-10-08 (Twilio, ServiceTrade, Flowcode, Brigit) passed the first
# version of this guard because only fill.py's own run history counted.
HELD = {"Ready to submit"}
COMPANY_WINDOW_DAYS = 180   # older applications/rejections no longer block the company
LEDGER_MAX_AGE_MIN = 120    # preview + Bilal's confirmation fit in this; older = re-export


def job_key(url: str):
    """(key, org) for an apply URL. `key` identifies the posting across the
    different URLs one job has (Greenhouse board, embed and gh_jid links all
    carry the same id); `org` is the ATS slug of the company, '' if unknown."""
    u = urllib.parse.urlparse(url.strip())
    host = u.netloc.lower()
    q = urllib.parse.parse_qs(u.query)
    parts = [urllib.parse.unquote(p) for p in u.path.split("/") if p]
    if "greenhouse.io" in host:
        if q.get("token"):
            return ("greenhouse", q["token"][0]), q.get("for", [""])[0].lower()
        if "jobs" in parts and parts.index("jobs") + 1 < len(parts):
            i = parts.index("jobs")
            return ("greenhouse", parts[i + 1]), (parts[i - 1].lower() if i else "")
    if q.get("gh_jid"):                       # company career site wrapping Greenhouse
        return ("greenhouse", q["gh_jid"][0]), ""
    if "ashbyhq.com" in host and len(parts) >= 2:
        return ("ashby", parts[1].lower()), parts[0].lower()
    if "lever.co" in host and len(parts) >= 2:
        return ("lever", parts[1].lower()), parts[0].lower()
    if "linkedin.com" in host and "view" in parts and parts.index("view") + 1 < len(parts):
        return ("linkedin", parts[parts.index("view") + 1]), ""
    return ("url", (host + u.path).rstrip("/").lower()), ""


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def same_company(org: str, row: dict) -> bool:
    """Does ATS slug `org` belong to the company of this tracker row? Slugs and
    names differ ("gametimeunited" vs "Gametime", "urbancompass" vs "Compass"),
    so compare the row's own link slug first, then name containment."""
    org = _norm(org)
    if not org: return False
    row_org = _norm(job_key(row["job_link"])[1]) if row.get("job_link") else ""
    name = _norm(row.get("company"))
    if org == row_org or org == name: return True
    return len(name) >= 4 and (name in org or org in name)


def load_ledger(path, now=None, max_age_min=LEDGER_MAX_AGE_MIN):
    """Rows of the tracker export, or raise SystemExit with what to do. A missing
    or stale ledger stops the run: filling blind is how the duplicates happened."""
    path = pathlib.Path(path)
    how = (f"Export the Notion Applications table (every row: company, role, status, job_link, applied) to\n"
           f"  {path}\nas {{\"exported_at\": \"<ISO time>\", \"rows\": [...]}} and run again. See docs/mass-apply-cli.md.")
    if not path.exists():
        raise SystemExit(f"NO TRACKER LEDGER, nothing filled.\n{how}")
    data = json.loads(path.read_text())
    exported = datetime.datetime.fromisoformat(data["exported_at"])
    now = now or datetime.datetime.now(exported.tzinfo)
    age = (now - exported).total_seconds() / 60
    if age > max_age_min or age < -5:
        raise SystemExit(f"TRACKER LEDGER IS STALE ({age:.0f} min old, limit {max_age_min}), nothing filled.\n{how}")
    return data["rows"]


def load_history(state_dir):
    """{job key: 'run #n'} for every form fill.py has filled in earlier runs."""
    seen = {}
    for run in sorted(pathlib.Path(state_dir).glob("*/run.json")):
        try:
            for rec in json.loads(run.read_text()):
                if not rec.get("skipped"):
                    seen[job_key(rec["url"])[0]] = f"run {run.parent.name} #{rec['n']}"
        except Exception:
            continue
    return seen


def _recent(row, today):
    """True when the row's Date applied is inside the company window. Unknown
    date counts as recent for a live application and as old for a rejection
    (undated rejections are historical email reconstructions)."""
    d = row.get("applied")
    if not d: return row.get("status") in ACTIVE | HELD
    return (today - datetime.date.fromisoformat(d[:10])).days <= COMPANY_WINDOW_DAYS


def check(jobs, ledger, history, refill=(), allow_company=(), today=None):
    """One verdict per queue line: {"url", "ok", "reason"}. `jobs` is a list of
    (url, kit). `refill` / `allow_company` are URL substrings Bilal has cleared
    in chat for this run; they never override a finished posting."""
    today = today or datetime.date.today()
    verdicts, in_queue = [], {}
    for n, (url, _kit) in enumerate(jobs, 1):
        key, org = job_key(url)
        reason = None
        same_job = [r for r in ledger if r.get("job_link") and job_key(r["job_link"])[0] == key]
        done = [r for r in same_job if r.get("status") in DONE]
        held = [r for r in same_job if r.get("status") in HELD]
        refill_ok = any(s and s.lower() in url.lower() for s in refill)
        company = [r for r in ledger if r not in same_job and same_company(org, r)
                   and (r.get("status") in ACTIVE | HELD or r.get("status") == "Rejected") and _recent(r, today)]
        if done:
            r = done[0]
            reason = f"ALREADY {r['status'].upper()}: {r.get('company')} · {r.get('role')} ({r.get('applied') or 'no date'}). Do not fill."
        elif key in in_queue:
            reason = f"DUPLICATE IN QUEUE: same posting as line {in_queue[key]}."
        elif (key in history or held) and not refill_ok:
            where = history.get(key) or f"the tracker ({held[0].get('company')} is Ready to submit)"
            reason = (f"FILLED BEFORE per {where}: Bilal may have submitted it from the tab. "
                      f"Ask him; only if he says it is not submitted, rerun with --refill=<url part>.")
        elif company and not any(s and s.lower() in url.lower() for s in allow_company):
            r = company[0]
            reason = (f"COMPANY ALREADY IN TRACKER: {r.get('company')} · {r.get('role')} is {r['status']} "
                      f"({r.get('applied') or 'no date'}). One role per company / no re-apply after a recent rejection; "
                      f"only if Bilal names it a special case, rerun with --allow-company=<url part>.")
        in_queue.setdefault(key, n)
        verdicts.append({"url": url, "ok": reason is None, "reason": reason})
    return verdicts


def report(verdicts) -> str:
    lines = []
    for n, v in enumerate(verdicts, 1):
        lines.append(f"[{n:02d}] {'fill  ' if v['ok'] else 'BLOCK '} {v['url']}" + ("" if v["ok"] else f"\n       {v['reason']}"))
    blocked = sum(not v["ok"] for v in verdicts)
    lines.append(f"\n{len(verdicts) - blocked} to fill, {blocked} blocked.")
    return "\n".join(lines)
