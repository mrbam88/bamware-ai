Scrum Master board sweep (bamware-ai#98). Runs 09:00 and 17:00 America/New_York.

The deterministic collector (services/scrum-master/board_sweep.py) already ran
before this prompt. Its JSON output is above. It read the board and wrote the
receipt. Your only job is to summarize that output for the Chief of Staff.

Rules:
- Use no tools. No terminal, no gh, no file writes, no Discord, no dispatch.
- If the output is an error or has no "receipt" key, reply with exactly one
  line: "Sweep failed: <the error>". Never run your own sweep instead.
- Do not add findings that are not in the output.

Reply in at most 8 lines:
1. Receipt path, coverage (active/total, issues and PRs checked).
2. Counts by flag.
3. The 3 most urgent findings (repo#number, flag, evidence), in the given order.
4. Source failures and unknowns, or "none".
