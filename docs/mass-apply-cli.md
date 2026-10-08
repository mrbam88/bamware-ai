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

## Daily loop

1. Queue: `~/interviews/imports/<date>/queue.txt`, one line per job,
   `<apply-url> <kit>` (kit = mobile-ios | mobile-rn | fullstack | manager).
   Source candidates from `imports/linkedin-job-tracker-2026-10-08/queue-batch5.md`
   and the Greenhouse board search trick `job-boards.greenhouse.io/<org>?keyword=ios`.
2. `caffeinate -i python3 ~/bamware-ai/scripts/mass-apply/fill.py run queue.txt`
   — fills every form, screenshots to `~/interviews/imports/mass-apply-runs/<run>/`,
   leaves the tabs open.
3. Bilal looks at screenshots (or the tabs), then per job:
   `python3 ~/bamware-ai/scripts/mass-apply/fill.py submit <n>` → typed `yes` →
   it re-fills and clicks Submit, saves a `-submitted.png`.
4. Claude Code logs each row in the Notion Job Tracker (Ready to submit →
   Applied) with the run folder + kit + commit, exactly as before.

## What the script leaves to Bilal

- EEO / demographic dropdowns (unless run with `--eeo`, not wired yet).
- Any free-text box that says AI-written answers are not accepted.
- CAPTCHAs, logins, Workday wizards (open the page, stop, hand off).

## Known gaps (first version)

- Greenhouse is solid; Ashby/Lever are best-effort label matching.
- Salary-range questions are not auto-answered; use the `salary_range_answer`
  template from `answers.json` by hand.
- Notion logging is done by the Claude Code session, not the script.
