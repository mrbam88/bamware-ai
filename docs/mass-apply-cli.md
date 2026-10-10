# Mass-apply from Claude Code CLI (no per-site permission prompts)

Set up 2026-10-08 after the Chrome-extension flow kept stalling on site and
domain permissions. Same rules as `skills/apply-to-job`: the assistant fills,
Bilal approves each submit. **No auto-submit.**

## One-time setup (M3 or X1)

```bash
cd ~/interviews && git pull            # private answers + kits + queue
cd ~/bamware-ai && git pull            # this script
pip3 install playwright && python3 -m playwright install chromium
```

Allowlist the few commands once so Claude Code stops asking, in
`~/.claude/settings.json`:

```json
{ "permissions": { "allow": [
  "Bash(python3 ~/bamware-ai/scripts/mass-apply/fill.py:*)",
  "Bash(caffeinate:*)", "Bash(git:*)", "Read", "Edit", "Write"
] } }
```

## Duplicate guard (2026-10-10) — fill.py refuses to fill blind

Incident: run `20261010-1224` refilled Gusto, Nectar Social and Found, all
submitted days earlier. Their tracker rows still said "Ready to submit" (Bilal
had submitted from the open tabs) and `fill.py` filled whatever the queue said.
Bilal caught it. `scripts/mass-apply/guard.py` now runs before any form opens:

- **Tracker ledger, required and fresh.** Right before a run, export every row
  of Notion Job Tracker 2026 → Applications to
  `~/interviews/imports/tracker-ledger.json` as
  `{"exported_at": "<ISO time>", "rows": [{"company", "role", "status", "job_link", "applied"}]}`
  (one SQL query through the Notion connector returns all rows). Missing or older
  than 2 hours: `run` and `check` exit without opening anything.
- **Finished postings are never opened**: same job (Greenhouse id, Ashby/Lever
  uuid, LinkedIn id) with status Applied, Screen, Interviewing, Offer, Rejected
  or Withdrawn. No flag overrides this.
- **Filled before = maybe submitted.** A form filled in any earlier run is not
  refilled. Ask Bilal; only when he says it is not submitted, pass
  `--refill=<url part>`. Never pass it on your own judgment: the tracker status
  is exactly what was wrong on 2026-10-10.
- **One role per company / recent rejection**: a different posting at a company
  with a live application or a rejection in the last 180 days is blocked unless
  Bilal names it, then `--allow-company=<url part>`.
- `fill.py check queue.txt` prints the verdicts without a browser; paste them
  into the preview. Blocked lines stay in `run.json` as `skipped` so numbering
  still matches the queue. `python3 scripts/mass-apply/test_guard.py` tests it.

## Ashby: shown is not registered (2026-10-10)

Ashby saves each field to its server separately. A field can show a value the
server never got; Ashby then answers Submit with "Missing entry for required
field", and an optional field in that state goes out blank. Seen on Nectar
(LinkedIn), Propel (work authorization) and Suno (three fields), most likely
from ad-hoc fills over the debug port. `fill.py` now reads the registered value
of every field (`fieldEntry.fieldValue` on the React fiber), re-enters
unregistered ones with real keystrokes/clicks, and prints what is still wrong.

- `fill.py verify` — read-only report for every Ashby tab open on port 9222.
  Run it after **any** manual or scripted edit to an Ashby tab and before
  telling Bilal a form is ready. "All required fields set" may only be written
  in the tracker when `verify` says `ok`.
- Finishing leftover Ashby fields: use Playwright `click` + `press_sequentially`
  + `Tab`, never a JS value setter or `element.click()` in `evaluate`.

## Daily loop

0. **Preview first (Bilal, 2026-10-09):** export the tracker ledger, run
   `fill.py check queue.txt`, post `Company · Role · location · kit` plus every
   blocked line in chat, fill only after he confirms. See `skills/job-guardrails`.
1. Queue: `~/interviews/imports/<date>/queue.txt`, one line per job,
   `<apply-url> <kit>` (kit = mobile-ios | mobile-rn | fullstack | manager).
   Source candidates from `imports/linkedin-job-tracker-2026-10-08/queue-batch5.md`
   and the Greenhouse board search trick `job-boards.greenhouse.io/<org>?keyword=ios`.
2. `caffeinate -i python3 ~/bamware-ai/scripts/mass-apply/fill.py run queue.txt --eeo`
   — fills every form, screenshots to `~/interviews/imports/mass-apply-runs/<run>/`,
   leaves the tabs open. `--eeo` fills self-identification from the private
   `answers.json` `eeo` block (Bilal approved 2026-10-08). Company essays and
   one-off dropdowns go in `custom.json` next to the queue
   (`{"<url substring>": {"<label regex>": "text" | ["^option regex"]}}`) so
   they are filled on run **and** on submit. Repos elsewhere than `~/`:
   `INTERVIEWS_REPO=~/code/interviews`. Keep the process alive (`tail -f /dev/null |`
   in front) or the tabs close; its Chrome listens on debug port 9222.
3. Bilal looks at screenshots (or the tabs), then per job:
   `python3 ~/bamware-ai/scripts/mass-apply/fill.py submit <n>` → typed `yes` →
   it re-fills and clicks Submit, saves a `-submitted.png`. **It refills from
   scratch**, so anything typed by hand into a tab is lost; either put it in
   `custom.json` first or submit in the tab and say "submitted N".
4. Claude Code logs each row in the Notion Job Tracker (Ready to submit →
   Applied) with the run folder + kit + commit, exactly as before.

## Real Chrome mode (Bilal, 2026-10-09)

Bigger ATSes score automation signals and application bursts. Preferred flow now:
`scripts/mass-apply/real-chrome.sh` opens a normal Chrome (no automation flags,
dedicated profile `~/.bamware/chrome-bilal`, debug port 9222, does not take
focus); Bilal logs into LinkedIn/Google once. Then
`fill.py run queue.txt --eeo --attach` fills inside that Chrome and he submits
there. Pace 10-15 a day, rephrase every essay, answer "did you use AI" honestly.

## Lessons from 2026-10-08/09

- Ashby's submit runs a bot check: a Chrome launched with Playwright's default
  `--enable-automation` gets "flagged as possible spam". `fill.py` now launches
  with `--disable-blink-features=AutomationControlled` and without the automation
  flag; `navigator.webdriver` must be `false` in the tab.
- Lever's resume upload rejects `set_input_files` with a bogus "exceeds 100MB";
  use the Attach button's file chooser (works, shows "Success!").
- Leftover required fields are easiest to finish **live** over the debug port:
  `connect_over_cdp("http://localhost:9222")`, scan labels ending in `*` with an
  empty control, fill from `skills/bilal-answers`, leave essays drafted for Bilal.
- Greenhouse embeds that redirect to a company site: use
  `job-boards.greenhouse.io/embed/job_app?for=<org>&token=<id>`.
- Sourcing at scale: probe `boards-api.greenhouse.io/v1/boards/<slug>/jobs`,
  `api.ashbyhq.com/posting-api/job-board/<slug>`, `api.lever.co/v0/postings/<slug>`
  for a slug list, filter titles, dedupe against the Notion table, then apply
  `skills/job-guardrails` (one role per company, top-tier mobile-only).

## What the script leaves to Bilal

- EEO / demographic dropdowns (unless run with `--eeo`, not wired yet).
- Any free-text box that says AI-written answers are not accepted.
- CAPTCHAs, logins, Workday wizards (open the page, stop, hand off).

## Known gaps (first version)

- Greenhouse and Ashby are solid as of 2026-10-08 (PR #159); Lever is untested.
- Gem, Workable, Workday, LinkedIn Easy Apply: opened and screenshotted only.
- Salary-range questions are not auto-answered; use the `salary_range_answer`
  template from `answers.json` by hand.
- Notion logging is done by the Claude Code session, not the script.
