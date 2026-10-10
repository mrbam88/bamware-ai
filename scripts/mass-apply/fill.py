#!/usr/bin/env python3
"""
Mass-apply filler for Bilal's job search, meant to run from Claude Code CLI on
the M3 (or any machine with Chrome + Playwright). It does NOT submit.

The pattern ("fill, screenshot, wait for a human yes"):

  1. You give it a queue file: one job per line, `<apply-url> <kit>` where kit is
     mobile-ios | mobile-rn | fullstack | manager.
  2. For each job it opens the page in a *persistent* Chrome profile (so your
     LinkedIn / ATS logins carry over), fills every field it recognizes from the
     private answers file, uploads the resume + cover letter from the kit, and
     saves a full-page screenshot + a JSON record of what it filled.
  3. It leaves every tab open and exits with a summary. Submitting is a separate
     command: `fill.py submit <n>` clicks the submit button in tab n only after
     you have looked at the screenshot. There is no auto-submit path on purpose
     (Bilal, 2026-10-08: "too risky").

Why Playwright and not the Claude-in-Chrome extension: the extension asks for a
site permission on every new domain and dies when the laptop sleeps. A
Playwright session in the CLI asks nothing after the first `settings.json`
allowlist, and `caffeinate -i` keeps it alive with the lid closed on power.

Supported ATSes (fields recognised by label text, so they survive small
layout changes):
  - Greenhouse (job-boards.greenhouse.io, incl. /embed/job_app?for=...)
  - Ashby      (jobs.ashbyhq.com/<org>/<id>/application)
  - Lever      (jobs.lever.co/<org>/<id>/apply)
Anything else is opened and screenshotted but left for a human.

Private data: everything personal comes from the private `mrbam88/interviews`
repo (`profile/answers.json`). This script never contains an answer itself.
EEO / demographic dropdowns are filled ONLY with --eeo, from private-answers.md
values you add to answers.json under "eeo" (not committed by default).

Usage:
  python3 fill.py check queue.txt          # duplicate guard only: what would be filled / blocked, no browser
  python3 fill.py run queue.txt            # fill everything the guard allows, no submit
  python3 fill.py run queue.txt --eeo      # also self-identification (answers.json "eeo", private)
  python3 fill.py run queue.txt --eeo --attach   # fill inside the real Chrome from real-chrome.sh (port 9222)
  python3 fill.py submit 3                 # submit the 3rd job from the last run
  python3 fill.py status                   # what is filled / submitted
  python3 fill.py verify                   # read-only: which open Ashby tabs (port 9222) have fields that look filled but are not registered
  --refill=<url part>[,..]         # refill a form filled in an earlier run; only after Bilal says it is NOT submitted
  --allow-company=<url part>[,..]  # second role at a company already in the tracker; only when Bilal names it

Duplicate guard (guard.py, added 2026-10-10 after three already-submitted forms
were refilled): `run` and `check` need a fresh export of the Notion Applications
table at ~/interviews/imports/tracker-ledger.json and refuse to work without
it. Postings already Applied/Rejected/Withdrawn are never opened; forms filled
in an earlier run are not refilled without --refill. See docs/mass-apply-cli.md.

Requires: pip install playwright && playwright install chromium
"""
import json, re, sys, time, pathlib, datetime

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import guard

# ---------- paths ----------
# INTERVIEWS = private repo checkout. Override with $INTERVIEWS_REPO.
import os
INTERVIEWS = pathlib.Path(os.environ.get("INTERVIEWS_REPO", pathlib.Path.home() / "interviews"))
ANSWERS = json.loads((INTERVIEWS / "profile" / "answers.json").read_text())
PROFILE_DIR = pathlib.Path(os.environ.get("MASS_APPLY_PROFILE", pathlib.Path.home() / ".bamware" / "mass-apply-profile"))   # persistent Chrome profile; override to run two batches side by side
STATE_DIR = INTERVIEWS / "imports" / "mass-apply-runs"                   # screenshots + JSON, private repo
STATE_DIR.mkdir(parents=True, exist_ok=True)
LEDGER = INTERVIEWS / "imports" / "tracker-ledger.json"                  # Notion Applications export, written by the agent before each run


def flag_list(name: str):
    """Values of `--name=a,b` on the command line, [] when absent."""
    return [v for a in sys.argv if a.startswith(f"--{name}=") for v in a.split("=", 1)[1].split(",") if v]


def guard_queue(queue_file: str):
    """(jobs, verdicts) for a queue file. Exits when the tracker ledger is
    missing or stale, so nothing is ever filled without the duplicate check."""
    jobs = [l.split() for l in pathlib.Path(queue_file).read_text().splitlines() if l.strip() and not l.startswith("#")]
    verdicts = guard.check(jobs, guard.load_ledger(LEDGER), guard.load_history(STATE_DIR),
                           refill=flag_list("refill"), allow_company=flag_list("allow-company"))
    print(guard.report(verdicts) + "\n")
    return jobs, verdicts


# ---------- small helpers ----------
def kit_paths(kit: str):
    """Absolute PDF paths for a kit name. Raises if the kit is unknown so a typo
    never silently uploads the wrong resume."""
    k = ANSWERS["kits"][kit]
    root = INTERVIEWS / ANSWERS["kits_root"]
    return root / k["resume"], root / k["cover"]


def ats_of(url: str) -> str:
    if "greenhouse.io" in url: return "greenhouse"
    if "ashbyhq.com" in url:   return "ashby"
    if "lever.co" in url:      return "lever"
    return "unknown"


def fill_by_label(page: Page, label_regex: str, value: str, filled: dict) -> bool:
    """Type `value` into the first visible textbox whose accessible label matches
    the regex. Returns True on success. We match on labels, not CSS, because
    Greenhouse/Ashby regenerate class names constantly but keep the label text."""
    try:
        loc = page.get_by_label(re.compile(label_regex, re.I)).first
        if loc.count() == 0: return False
        tag = loc.evaluate("e => e.tagName.toLowerCase()")
        if tag not in ("input", "textarea"): return False
        loc.fill(value)
        filled[label_regex] = value
        return True
    except Exception:
        return False


def pick_react_select(page: Page, label_regex: str, option_text: str, filled: dict) -> bool:
    """Greenhouse/Ashby use react-select: click the combobox, type, then click the
    matching option. Plain `select_option` does not work on these."""
    try:
        box = page.get_by_label(re.compile(label_regex, re.I)).first
        if box.count() == 0: return False
        box.click()
        box.type(option_text, delay=20)
        page.wait_for_timeout(400)
        opt = page.get_by_role("option", name=re.compile(re.escape(option_text), re.I)).first
        if opt.count() == 0:
            page.keyboard.press("Escape"); return False
        opt.click()
        filled[label_regex] = option_text
        return True
    except Exception:
        return False


def upload(page: Page, label_regex: str, path: pathlib.Path, filled: dict) -> bool:
    """Greenhouse has two file inputs per field (the visible 'Attach' button and the
    real <input type=file>); set_input_files on the real one works for all three ATSes."""
    try:
        inputs = page.locator("input[type=file]")
        n = inputs.count()
        # Heuristic: the first file input is the resume, the second the cover letter.
        idx = 0 if re.search("resume|cv", label_regex, re.I) else 1
        if n <= idx: return False
        inputs.nth(idx).set_input_files(str(path))
        filled[label_regex] = path.name
        return True
    except Exception:
        return False


# ---------- per-ATS fillers ----------
def fill_common(page: Page, kit: str, filled: dict):
    """Fields that look the same on every ATS."""
    a = ANSWERS
    fill_by_label(page, r"^first name", a["first_name"], filled)
    fill_by_label(page, r"^last name", a["last_name"], filled)
    fill_by_label(page, r"^full name|^name\*?$", f'{a["first_name"]} {a["last_name"]}', filled)
    fill_by_label(page, r"preferred (first )?name", a["preferred_name"], filled)
    fill_by_label(page, r"^e-?mail", a["email"], filled)
    fill_by_label(page, r"^phone", a["phone"], filled)
    fill_by_label(page, r"linkedin", a["linkedin"], filled)
    fill_by_label(page, r"github|website|portfolio", a["github"], filled)
    fill_by_label(page, r"current (company|employer)", a["current_company"], filled)
    fill_by_label(page, r"current location|location \(city, state\)", a["location_city_state"], filled)
    resume, cover = kit_paths(kit)
    upload(page, "resume", resume, filled)
    upload(page, "cover letter", cover, filled)


def fill_greenhouse(page: Page, kit: str, filled: dict):
    fill_common(page, kit, filled)
    pick_react_select(page, r"^country", "United States", filled)
    pick_react_select(page, r"location \(city\)", ANSWERS["location_greenhouse"], filled)
    # Knockouts: answer, never leave blank (bilal-answers rule).
    pick_react_select(page, r"sponsorship", "No", filled)
    pick_react_select(page, r"authori[sz]ed to work", "Yes", filled)
    pick_react_select(page, r"how did you hear", ANSWERS["how_heard"], filled)
    pick_react_select(page, r"^school", ANSWERS["school"], filled)
    pick_react_select(page, r"^degree", ANSWERS["degree"], filled)
    fill_by_label(page, r"accommodation", ANSWERS["accommodations"], filled)

    # Cover letter: job-boards.greenhouse.io only creates the second file input
    # after the resume is attached, so the index heuristic in fill_common misses
    # it. Click the "Attach" button inside the Cover Letter block instead.
    if "cover letter" not in filled:
        try:
            _, cover = kit_paths(kit)
            block = page.locator("xpath=//*[normalize-space(text())='Cover Letter']/ancestor::*[.//button[contains(.,'Attach')]][1]").first
            with page.expect_file_chooser(timeout=4000) as fc:
                block.get_by_role("button", name=re.compile(r"^attach", re.I)).first.click()
            fc.value.set_files(str(cover)); filled["cover letter"] = cover.name
        except Exception:
            pass
    # "How did you hear" as checkboxes (Twilio style)
    try:
        page.get_by_label(re.compile(r"^linkedin$", re.I)).first.check(timeout=1000)
        filled["heard-checkbox"] = "LinkedIn"
    except Exception:
        pass
    fill_knockouts_greenhouse(page, filled)
    fill_eeo_greenhouse(page, filled)


def ashby_entry(page: Page, label_regex: str):
    """The field container for an Ashby question. Every Ashby field lives in a
    `_fieldEntry` div holding a <label> and the control, so scoping to it keeps a
    Yes/No click on the right question (the old ancestor::*[.//button] trick walked
    up to the whole form for text questions and clicked another question's Yes)."""
    return page.locator("[class*='_fieldEntry']").filter(
        has=page.locator("label", has_text=re.compile(label_regex, re.I))).first


def fill_ashby(page: Page, kit: str, filled: dict):
    page.wait_for_selector("[class*='_fieldEntry']", timeout=15000)
    a = ANSWERS
    resume, cover = kit_paths(kit)
    # 1. Ashby's "Autofill from resume" box is the first file input and has no id.
    #    Feed it first and wait for it to finish; otherwise its async autofill
    #    lands after our typing and wipes the fields (seen 2026-10-08 on Propel).
    try:
        auto = page.locator("input[type=file]:not([id])").first
        if auto.count():
            auto.set_input_files(str(resume))
            page.get_by_text(re.compile("autofill completed", re.I)).wait_for(timeout=20000)
            page.wait_for_timeout(1500)
            filled["autofill"] = resume.name
    except Exception:
        pass
    # 2. Text fields, by label -> container -> control. Values from answers.json win
    #    over whatever the autofill parsed.
    for rx, val in [
        (r"^(full )?name$", f'{a["first_name"]} {a["last_name"]}'),
        (r"^first name", a["first_name"]), (r"^last name", a["last_name"]),
        (r"^e-?mail", a["email"]), (r"^phone", a["phone"]),
        (r"linkedin", a["linkedin"]), (r"github|portfolio|website", a["github"]),
        (r"most recent company|current (company|employer)", a["current_company"]),
        (r"authori[sz]ed to work", "Yes"),
    ]:
        try:
            box = ashby_entry(page, rx).locator("input[type=text], input[type=email], input[type=tel], input[type=url], textarea").first
            if box.count():
                box.fill(val); box.press("Tab"); page.wait_for_timeout(300); filled[rx] = val
        except Exception:
            pass
    # 3. Files: the real resume input has an id; the cover letter input sits under its label.
    try:
        page.locator("input[type=file][id*='resume' i]").first.set_input_files(str(resume))
        filled["resume"] = resume.name
    except Exception:
        pass
    try:
        ci = ashby_entry(page, r"cover letter").locator("input[type=file]").first
        if ci.count():
            ci.set_input_files(str(cover)); filled["cover letter"] = cover.name
    except Exception:
        pass
    # 4. Yes/No button pairs, scoped to their own question.
    for q, ans in [
        (r"based in the united states|live in the u\.?s|located in the u", "Yes"),
        (r"sponsor", "No"), (r"authori[sz]ed", "Yes"),
        (r"over 18|18 years", "Yes"), (r"non-?compete|restrictive covenant", "No"),
    ]:
        try:
            btn = ashby_entry(page, q).get_by_role("button", name=re.compile(f"^{ans}$", re.I)).first
            if btn.count():
                btn.click(timeout=1500); filled[q] = ans
        except Exception:
            pass
    # 5. Autocompletes (location, how did you hear): type, then click the option.
    for q, text, opt in [
        (r"^location$|currently based|where are you (currently )?located", "New York", r"New York"),
        (r"how did you hear|where did you learn", a["how_heard"], "^" + re.escape(a["how_heard"])),
    ]:
        try:
            inp = ashby_entry(page, q).locator("input").first
            if not inp.count():
                continue
            inp.click(); inp.fill(text); page.wait_for_timeout(1000)
            o = page.get_by_role("option", name=re.compile(opt, re.I)).first
            if o.count():
                o.click(); filled[q] = text
            else:
                page.keyboard.press("Escape")
        except Exception:
            pass

    fill_eeo_ashby(page, filled)


# Ashby keeps the form server-side: every field change is its own save, and the
# value the server holds is on the field's React `fieldEntry.fieldValue` prop.
# A field can SHOW a value that never registered (2026-10-10: Nectar LinkedIn,
# Propel work authorization, three Suno fields), and Ashby then refuses the
# submit with "Missing entry for required field" - or, for an optional field,
# sends it blank. This reads both sides for every field.
ASHBY_STATE_JS = r"""
() => Array.from(document.querySelectorAll("[class*='_fieldEntry']")).map((ent, i) => {
  const k = Object.keys(ent).find(k => k.startsWith('__reactFiber$'));
  let f = k ? ent[k] : null, fe = null, hops = 0;
  while (f && hops++ < 6) { if (f.memoizedProps && f.memoizedProps.fieldEntry) { fe = f.memoizedProps.fieldEntry; break; } f = f.return; }
  const ctl = ent.querySelector("input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea");
  const buttons = Array.from(ent.querySelectorAll('button'));
  const pressed = buttons.findIndex(b => /_active|selected/i.test(b.className) || b.getAttribute('aria-pressed') === 'true');
  const radios = Array.from(ent.querySelectorAll('input[type=radio]'));
  const radio = radios.findIndex(r => r.checked);
  const box = !!ent.querySelector('input[type=checkbox]:checked') && !buttons.length;
  const v = fe && fe.fieldValue, val = v && v.__typename === 'JSONBox' ? v.value : v;
  return {i, label: (ent.querySelector('label')?.innerText || '').trim().slice(0, 80),
    known: !!fe, hidden: !!(fe && fe.isHidden), required: !!(fe && fe.isRequired),
    registered: !(val === null || val === undefined || val === '' || (Array.isArray(val) && !val.length)),
    text: ctl ? ctl.value : null, pressed, buttons: buttons.length, radio, radios: radios.length, box};
})
"""


def ashby_state(page: Page):
    """Per visible field: what the page shows and whether Ashby registered it."""
    fields = [f for f in page.evaluate(ASHBY_STATE_JS) if not f["hidden"]]
    for f in fields:
        f["shows"] = bool((f["text"] or "").strip()) or f["pressed"] >= 0 or f["radio"] >= 0 or f["box"]
    return fields


def ashby_problems(fields):
    """(unregistered, missing): labels that show a value Ashby does not hold, and
    required fields that are simply empty. Unknown internals count as unverified
    rather than fine, so a silent Ashby change cannot pass as success."""
    if fields and not any(f["known"] for f in fields):
        return ["(cannot read Ashby form state: nothing verified)"], []
    return ([f["label"] for f in fields if f["shows"] and not f["registered"]],
            [f["label"] for f in fields if f["required"] and not f["shows"] and not f["registered"]])


def ashby_verify(page: Page, filled: dict):
    """Re-enter every field that shows a value Ashby did not register, with real
    keystrokes and clicks, then record what is still wrong in `filled`. The last
    step is always a fresh read (skills/form-verify)."""
    entries = page.locator("[class*='_fieldEntry']")
    for _ in range(2):
        page.wait_for_timeout(1500)                      # let in-flight saves land first
        bad = [f for f in ashby_state(page) if f["known"] and f["shows"] and not f["registered"]]
        if not bad: break
        for f in bad:
            ent = entries.nth(f["i"])
            try:
                if (f["text"] or "").strip():
                    box = ent.locator("input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea").first
                    box.click(); box.press("ControlOrMeta+a"); box.press("Backspace")
                    box.press_sequentially(f["text"]); box.press("Tab")
                elif f["pressed"] >= 0 and f["buttons"] > 1:   # Yes/No pair: move off and back on
                    ent.locator("button").nth((f["pressed"] + 1) % f["buttons"]).click(); page.wait_for_timeout(700)
                    ent.locator("button").nth(f["pressed"]).click()
                elif f["radio"] >= 0 and f["radios"] > 1:
                    ent.locator("input[type=radio]").nth((f["radio"] + 1) % f["radios"]).click(force=True); page.wait_for_timeout(700)
                    ent.locator("input[type=radio]").nth(f["radio"]).click(force=True)
                page.wait_for_timeout(900)
            except Exception as e:
                filled["verify-error:" + f["label"][:40]] = repr(e)[:80]
    page.wait_for_timeout(1500)
    unregistered, missing = ashby_problems(ashby_state(page))
    if unregistered: filled["_unregistered"] = unregistered
    if missing: filled["_missing_required"] = missing
    return unregistered, missing


def fill_lever(page: Page, kit: str, filled: dict):
    fill_common(page, kit, filled)
    # Lever uses native <select>; select_option works.
    for q, ans in [(r"authori[sz]ed", "Yes"), (r"sponsorship", "No"), (r"how did you hear", ANSWERS["how_heard"])]:
        try:
            page.get_by_label(re.compile(q, re.I)).first.select_option(label=ans)
            filled[q] = ans
        except Exception:
            pass


EEO = "--eeo" in sys.argv
ATTACH = "--attach" in sys.argv   # fill inside the real Chrome from real-chrome.sh (connect_over_cdp), no launch, no hide   # fill self-identification from answers.json["eeo"] (private repo)


def pick_eeo_select(page: Page, label_regex: str, options, filled: dict) -> bool:
    """Open the react-select under `label_regex` and click the first option whose
    text matches one of `options` (regexes, tried in order, anchored by the
    caller). We scan the open menu instead of typing because EEO wording differs
    per company ("No, I am not a veteran" vs "I am not a protected veteran",
    "South Asian (...)" vs "Asian")."""
    if isinstance(options, str): options = [options]
    try:
        box = page.get_by_label(re.compile(label_regex, re.I)).first
        if box.count() == 0: return False
        box.click(); page.wait_for_timeout(400)
        for rx in options:
            opt = page.get_by_role("option", name=re.compile(rx, re.I)).first
            if opt.count():
                opt.click(); page.wait_for_timeout(200)
                filled["eeo:" + label_regex] = rx; return True
        page.keyboard.press("Escape"); return False
    except Exception:
        try: page.keyboard.press("Escape")
        except Exception: pass
        return False


# Option wordings seen so far per answer key; first match wins. Values come from
# answers.json["eeo"] only to decide WHICH list applies (so a different answer
# in the private file disables the list rather than silently picking ours).
EEO_OPTIONS = {
    "gender":      {"Male": [r"^Male$", r"^Male\b", r"^Man\b"]},
    "hispanic":    {"No":   [r"^No$", r"^No\b"]},
    "race":        {"Asian": [r"^Asian$", r"^Asian\b", r"^South Asian", r"^Asian \("]},
    "veteran":     {"I am not a protected veteran": [r"^I am not a protected veteran", r"^No, I am not a veteran", r"^I am not", r"^No\b"]},
    "disability":  {"No, I do": [r"^No, I do", r"^No$", r"^No\b"]},
    "orientation": {"Heterosexual": [r"^Heterosexual", r"^Straight"]},
    "transgender": {"No": [r"^No$", r"^No\b"]},
    "cisgender":   {"No": [r"^Cisgender man", r"^Cisgender$", r"^Cisgender\b"]},   # "I identify as:" style; answer derives from transgender=No
}


def fill_eeo_greenhouse(page: Page, filled: dict):
    e = ANSWERS.get("eeo", {})
    if not EEO or not e: return
    if "transgender" in e: e = {**e, "cisgender": e["transgender"]}
    for rx, key in [(r"identify as transgender|transgender", "transgender"), (r"^I identify as:|gender identity", "cisgender"),
                    (r"gender", "gender"), (r"hispanic", "hispanic"), (r"race|ethnicity", "race"),
                    (r"veteran", "veteran"), (r"disab", "disability"), (r"sexual orientation", "orientation")]:
        opts = EEO_OPTIONS.get(key, {}).get(e.get(key, ""))
        if opts:
            pick_eeo_select(page, rx, opts, filled)


def fill_eeo_ashby(page: Page, filled: dict):
    e = ANSWERS.get("eeo", {})
    if not EEO or not e: return
    for rx, key in [(r"^gender", "gender"), (r"^race", "race"), (r"veteran", "veteran"), (r"disab", "disability")]:
        if key not in e: continue
        try:
            lab = ashby_entry(page, rx).locator("label", has_text=re.compile("^" + re.escape(e[key]), re.I)).first
            if lab.count():
                lab.click(timeout=1500); filled["eeo:" + rx] = e[key]
        except Exception:
            pass


def fill_knockouts_greenhouse(page: Page, filled: dict):
    """Standard yes/no and consent questions from skills/bilal-answers: answered,
    never left blank (a blank auto-rejects). Company essays stay with Bilal."""
    for rx, ans in [(r"employed by|worked (at|for)|currently work(ing)? (at|for)|previously worked", r"^No\b"),
                    (r"highest level of (completed )?education", r"^Bachelor"),
                    (r"european union|eu resident", r"^No\b"),
                    (r"live or (want to )?relocate", r"^Yes\b"),   # Bilal is in NYC already
                    (r"non-?compete|restrictive covenant", r"^No\b"),
                    (r"18 years|over 18|at least 18", r"^Yes\b"),
                    (r"background check|drug (screen|test)", r"^Yes\b")]:
        pick_eeo_select(page, rx, ans, filled)
    # consent / acknowledgement checkboxes
    try:
        boxes = page.get_by_role("checkbox", name=re.compile(r"consent|acknowledge|agree|privacy|by clicking", re.I))
        for i in range(min(boxes.count(), 4)):
            boxes.nth(i).check(timeout=1000); filled[f"consent-{i}"] = True
    except Exception:
        pass


CDP_PORT = int(os.environ.get("MASS_APPLY_CDP_PORT", "9222"))   # Chrome DevTools port of the filler's Chrome; connect_over_cdp("http://localhost:9222") to edit open tabs
CUSTOM = {}       # url-substring -> {label_regex: value}; loaded from custom.json next to the queue file


def load_custom(path):
    global CUSTOM
    if path and pathlib.Path(path).exists():
        CUSTOM = json.loads(pathlib.Path(path).read_text())


def fill_custom(page: Page, ats: str, url: str, filled: dict):
    """Per-job answers (company essays, one-off dropdowns) from custom.json,
    `{"<url substring>": {"<label regex>": "text" | ["^option regex", ...]}}`.
    A string goes into the text box under that label; if there is none it is
    tried as an anchored select option. A list is a list of option regexes."""
    for key, answers in CUSTOM.items():
        if key not in url: continue
        for rx, val in answers.items():
            try:
                if isinstance(val, str):
                    if ats == "ashby":
                        box = ashby_entry(page, rx).locator("input[type=text], input[type=url], textarea").first
                        if box.count():
                            box.fill(val); filled["custom:" + rx] = val[:40]; continue
                    elif fill_by_label(page, rx, val, filled):
                        continue
                    val = ["^" + re.escape(val)]
                if ats == "ashby":
                    ent = ashby_entry(page, rx)
                    hit = False
                    for orx in val:
                        b = ent.get_by_role("button", name=re.compile(orx, re.I)).first
                        if b.count():
                            b.click(timeout=1500); filled["custom:" + rx] = orx; hit = True; break
                    if not hit:
                        inp = ent.locator("input").first
                        if inp.count():
                            inp.click(); page.wait_for_timeout(500)
                            for orx in val:
                                o = page.get_by_role("option", name=re.compile(orx, re.I)).first
                                if o.count():
                                    o.click(); filled["custom:" + rx] = orx; break
                else:
                    pick_eeo_select(page, rx, val, filled)
            except Exception as e:
                filled["custom-error:" + rx] = repr(e)[:80]


FILLERS = {"greenhouse": fill_greenhouse, "ashby": fill_ashby, "lever": fill_lever}


def hide_browser():
    """Hide the filler's Chrome right after launch so it never steals focus from
    Bilal's own windows (Bilal, 2026-10-09: "the browser takes my focus, very
    distracting"). He unhides it from the Dock or Cmd-Tab when he wants to submit.
    macOS only; no-op elsewhere or when MASS_APPLY_HIDE=0."""
    if sys.platform != "darwin" or os.environ.get("MASS_APPLY_HIDE", "1") == "0":
        return
    import subprocess
    try:
        pids = subprocess.run(["pgrep", "-f", f"--user-data-dir={PROFILE_DIR}"], capture_output=True, text=True).stdout.split()
        for pid in pids:
            subprocess.run(["osascript", "-e", f'tell application "System Events" to set visible of (first process whose unix id is {pid}) to false'],
                           capture_output=True, timeout=5)
    except Exception:
        pass


# ---------- commands ----------
def run(queue_file: str):
    jobs, verdicts = guard_queue(queue_file)
    if not any(v["ok"] for v in verdicts):
        print("Every job in the queue is blocked. Nothing opened."); return
    load_custom(pathlib.Path(queue_file).with_name("custom.json"))
    run_id = datetime.datetime.now().strftime("%Y%m%d-%H%M")
    out = STATE_DIR / run_id; out.mkdir()
    records = []
    with sync_playwright() as p:
        if ATTACH:
            # Bilal's own (non-automated) Chrome, started by scripts/mass-apply/real-chrome.sh.
            browser = p.chromium.connect_over_cdp(f"http://localhost:{CDP_PORT}")
            ctx = browser.contexts[0]
        else:
            # headless=False so you can look at (and submit from) the real tabs.
            ctx = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=False, channel="chrome", args=[f"--remote-debugging-port={CDP_PORT}", "--disable-blink-features=AutomationControlled"], ignore_default_args=["--enable-automation"], viewport=None)
            page0 = ctx.pages[0] if ctx.pages else ctx.new_page(); page0.wait_for_timeout(800); hide_browser()
        for i, (url, kit) in enumerate(jobs, 1):
            if not verdicts[i - 1]["ok"]:
                # Blocked by the duplicate guard: keep the queue numbering, open nothing.
                records.append({"n": i, "url": url, "kit": kit, "ats": ats_of(url), "submitted": False,
                                "skipped": verdicts[i - 1]["reason"], "queue": str(pathlib.Path(queue_file).resolve())})
                print(f"[{i:02d}] BLOCKED    {url}")
                continue
            page = ctx.new_page(); page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            ats = ats_of(url); filled = {}
            try:
                FILLERS.get(ats, lambda *_: None)(page, kit, filled)
                fill_custom(page, ats, url, filled)
                if ats == "ashby": ashby_verify(page, filled)
            except Exception as e:
                filled["_error"] = repr(e)
            shot = out / f"{i:02d}.png"
            page.screenshot(path=str(shot), full_page=True)
            rec = {"n": i, "url": url, "kit": kit, "ats": ats, "filled": filled, "screenshot": str(shot), "submitted": False,
                   "queue": str(pathlib.Path(queue_file).resolve())}
            records.append(rec)
            print(f"[{i:02d}] {ats:10} {kit:10} {len(filled):2d} fields  {url}")
            for key, what in [("_unregistered", "SHOWN BUT NOT REGISTERED (would be rejected or sent blank)"), ("_missing_required", "required, still empty")]:
                if filled.get(key): print(f"       {what}: " + "; ".join(filled[key]))
        (out / "run.json").write_text(json.dumps(records, indent=1))
        print(f"\nDone. Review screenshots in {out}. Tabs are still open.")
        if ATTACH:
            print("Attached mode: tabs stay in your Chrome; submit there. Nothing to close.")
            return
        print("Submit with:  python3 fill.py submit <n>   (one at a time, after you looked)")
        input("Press Enter to close the browser (tabs will close; re-run to refill)...")
        ctx.close()


def latest_run():
    runs = sorted(STATE_DIR.glob("*/run.json"))
    return runs[-1] if runs else None


def status():
    r = latest_run()
    if not r: print("no runs"); return
    for rec in json.loads(r.read_text()):
        state = "BLOCKED  " if rec.get("skipped") else "SUBMITTED" if rec["submitted"] else "filled   "
        print(f"[{rec['n']:02d}] {state} {rec['url']}")


def submit(n: int):
    """Re-opens job n in the persistent profile, re-fills it (Greenhouse forms do
    not persist across sessions) and then clicks Submit — but only after printing
    the screenshot path and asking for a typed 'yes' in the terminal."""
    r = latest_run(); recs = json.loads(r.read_text()); rec = recs[n - 1]
    if rec.get("skipped"):
        print("not submitted, the duplicate guard blocked this job:", rec["skipped"]); return
    # The tracker may have moved since the fill (Bilal submits from the tab): check again.
    done = [v for v in guard.check([(rec["url"], rec["kit"])], guard.load_ledger(LEDGER), {}) if not v["ok"] and v["reason"].startswith("ALREADY")]
    if done:
        print("not submitted:", done[0]["reason"]); return
    print("Screenshot:", rec["screenshot"]); print("URL:", rec["url"])
    if input("Type yes to submit this one: ").strip().lower() != "yes":
        print("not submitted"); return
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=False, channel="chrome", args=[f"--remote-debugging-port={CDP_PORT}", "--disable-blink-features=AutomationControlled"], ignore_default_args=["--enable-automation"], viewport=None)
        page0 = ctx.pages[0] if ctx.pages else ctx.new_page(); page0.wait_for_timeout(800); hide_browser()
        page = ctx.new_page(); page.goto(rec["url"], wait_until="domcontentloaded"); page.wait_for_timeout(2500)
        load_custom(pathlib.Path(rec.get("queue", "")).with_name("custom.json") if rec.get("queue") else None)
        filled = {}; FILLERS.get(rec["ats"], lambda *_: None)(page, rec["kit"], filled)
        fill_custom(page, rec["ats"], rec["url"], filled)
        if rec["ats"] == "ashby":
            unregistered, missing = ashby_verify(page, filled)
            if unregistered or missing:
                print("not submitted, Ashby has not registered:", "; ".join(unregistered + missing)); input("Enter to close..."); ctx.close(); return
        page.get_by_role("button", name=re.compile(r"submit", re.I)).first.click()
        page.wait_for_timeout(4000)
        ok = bool(re.search(r"thank|received|submitted", page.content(), re.I))
        page.screenshot(path=rec["screenshot"].replace(".png", "-submitted.png"), full_page=True)
        rec["submitted"] = ok; rec["submitted_at"] = datetime.datetime.now().isoformat()
        r.write_text(json.dumps(recs, indent=1))
        print("submitted" if ok else "clicked submit but no confirmation text found — check the tab")
        input("Enter to close...")
        ctx.close()


def verify():
    """Read-only check of every Ashby tab open in the Chrome on the debug port:
    no clicks, no typing, no tab switch. Exit code 1 when any tab has a problem."""
    bad = 0
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(f"http://localhost:{CDP_PORT}")
        for page in browser.contexts[0].pages:
            if ats_of(page.url) != "ashby": continue
            fields = ashby_state(page)
            unregistered, missing = ashby_problems(fields)
            if not fields:
                print(f"no form  {page.url}\n         (submitted, closed posting, or not loaded)"); continue
            print(f"{'PROBLEM' if unregistered or missing else 'ok     '}  {page.url}")
            for label in unregistered: print(f"         shown but NOT registered: {label}")
            for label in missing:      print(f"         required, empty: {label}")
            bad += bool(unregistered or missing)
    return bad


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "run":    run(sys.argv[2])
    elif cmd == "check":  sys.exit(any(not v["ok"] for v in guard_queue(sys.argv[2])[1]))
    elif cmd == "submit": submit(int(sys.argv[2]))
    elif cmd == "verify": sys.exit(1 if verify() else 0)
    else:               status()
