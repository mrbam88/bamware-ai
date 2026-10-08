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
  python3 fill.py run queue.txt            # fill everything, no submit
  python3 fill.py run queue.txt --eeo      # also self-identification (answers.json "eeo", private)
  python3 fill.py submit 3                 # submit the 3rd job from the last run
  python3 fill.py status                   # what is filled / submitted

Requires: pip install playwright && playwright install chromium
"""
import json, re, sys, time, pathlib, datetime

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

# ---------- paths ----------
# INTERVIEWS = private repo checkout. Override with $INTERVIEWS_REPO.
import os
INTERVIEWS = pathlib.Path(os.environ.get("INTERVIEWS_REPO", pathlib.Path.home() / "interviews"))
ANSWERS = json.loads((INTERVIEWS / "profile" / "answers.json").read_text())
PROFILE_DIR = pathlib.Path.home() / ".bamware" / "mass-apply-profile"   # persistent Chrome profile
STATE_DIR = INTERVIEWS / "imports" / "mass-apply-runs"                   # screenshots + JSON, private repo
STATE_DIR.mkdir(parents=True, exist_ok=True)


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
                box.fill(val); filled[rx] = val
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


def fill_lever(page: Page, kit: str, filled: dict):
    fill_common(page, kit, filled)
    # Lever uses native <select>; select_option works.
    for q, ans in [(r"authori[sz]ed", "Yes"), (r"sponsorship", "No"), (r"how did you hear", ANSWERS["how_heard"])]:
        try:
            page.get_by_label(re.compile(q, re.I)).first.select_option(label=ans)
            filled[q] = ans
        except Exception:
            pass


EEO = "--eeo" in sys.argv   # fill self-identification from answers.json["eeo"] (private repo)


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
}


def fill_eeo_greenhouse(page: Page, filled: dict):
    e = ANSWERS.get("eeo", {})
    if not EEO or not e: return
    for rx, key in [(r"gender", "gender"), (r"hispanic", "hispanic"), (r"race|ethnicity", "race"),
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


FILLERS = {"greenhouse": fill_greenhouse, "ashby": fill_ashby, "lever": fill_lever}


# ---------- commands ----------
def run(queue_file: str):
    jobs = [l.split() for l in pathlib.Path(queue_file).read_text().splitlines() if l.strip() and not l.startswith("#")]
    run_id = datetime.datetime.now().strftime("%Y%m%d-%H%M")
    out = STATE_DIR / run_id; out.mkdir()
    records = []
    with sync_playwright() as p:
        # headless=False so you can look at (and submit from) the real tabs.
        ctx = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=False, channel="chrome")
        for i, (url, kit) in enumerate(jobs, 1):
            page = ctx.new_page(); page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            ats = ats_of(url); filled = {}
            try:
                FILLERS.get(ats, lambda *_: None)(page, kit, filled)
            except Exception as e:
                filled["_error"] = repr(e)
            shot = out / f"{i:02d}.png"
            page.screenshot(path=str(shot), full_page=True)
            rec = {"n": i, "url": url, "kit": kit, "ats": ats, "filled": filled, "screenshot": str(shot), "submitted": False}
            records.append(rec)
            print(f"[{i:02d}] {ats:10} {kit:10} {len(filled):2d} fields  {url}")
        (out / "run.json").write_text(json.dumps(records, indent=1))
        print(f"\nDone. Review screenshots in {out}. Tabs are still open.")
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
        print(f"[{rec['n']:02d}] {'SUBMITTED' if rec['submitted'] else 'filled   '} {rec['url']}")


def submit(n: int):
    """Re-opens job n in the persistent profile, re-fills it (Greenhouse forms do
    not persist across sessions) and then clicks Submit — but only after printing
    the screenshot path and asking for a typed 'yes' in the terminal."""
    r = latest_run(); recs = json.loads(r.read_text()); rec = recs[n - 1]
    print("Screenshot:", rec["screenshot"]); print("URL:", rec["url"])
    if input("Type yes to submit this one: ").strip().lower() != "yes":
        print("not submitted"); return
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=False, channel="chrome")
        page = ctx.new_page(); page.goto(rec["url"], wait_until="domcontentloaded"); page.wait_for_timeout(2500)
        filled = {}; FILLERS.get(rec["ats"], lambda *_: None)(page, rec["kit"], filled)
        page.get_by_role("button", name=re.compile(r"submit", re.I)).first.click()
        page.wait_for_timeout(4000)
        ok = bool(re.search(r"thank|received|submitted", page.content(), re.I))
        page.screenshot(path=rec["screenshot"].replace(".png", "-submitted.png"), full_page=True)
        rec["submitted"] = ok; rec["submitted_at"] = datetime.datetime.now().isoformat()
        r.write_text(json.dumps(recs, indent=1))
        print("submitted" if ok else "clicked submit but no confirmation text found — check the tab")
        input("Enter to close...")
        ctx.close()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "run":    run(sys.argv[2])
    elif cmd == "submit": submit(int(sys.argv[2]))
    else:               status()
