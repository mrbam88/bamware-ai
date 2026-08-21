---
name: ats-playbooks
description: Per-ATS quirks and workarounds for filling job applications on Greenhouse, Lever, Ashby, Workday, SmartRecruiters, and LinkedIn Easy Apply. Use when an application form misbehaves, a file input is unreachable, an embedded form cannot be read, or before starting a form on an unfamiliar ATS.
---

# ATS playbooks

Identify the ATS first, from the URL or page chrome. Then read its section.

## Greenhouse

- Embedded as an iframe on company sites, and accessibility tooling cannot see
  inside it. Navigate directly to the standalone form:
  `https://job-boards.greenhouse.io/embed/job_app?for={company}&token={gh_jid}`
- The standalone page exposes the full form and allows direct file upload.
- Custom career sites often wrap the same form (Upstart's careers site,
  Fireblocks' careers page). Fireblocks redirects the board URL back to its own
  site; read the iframe's `for` and `token` params and open the standalone
  embed URL above instead. Upstart's site is plain HTML with native selects.
- The standard job-boards form (2026-08) is React. Every dropdown is
  React-Select (class prefix `select__`). Synthetic mouse and keyboard events
  do **not** open the menu. What works: one real click (by ref or screenshot
  coordinate) anywhere on the form to wake the tab, then per dropdown: focus
  the combobox input via JS, press ArrowDown with the keyboard tool, wait a
  second, click the matching `.select__option` via JS. Typed comboboxes
  (Location, School) take real keystrokes after a JS focus; clear a wrong value
  with a JS native setter, not select-all, which is Cmd-A on Bilal's Mac.
- Phone is a country React-Select plus a tel input; choose "United States +1"
  then set the number. Location (City) wants the "New York, New York, United
  States" suggestion. Hispanic/Latino = No reveals a second Race dropdown.
- Resume and cover letter each offer Attach, Dropbox, and "Enter manually".
  Use the second "Enter manually" button for the letter text; the textarea id is
  `cover_letter_text`.

## SmartRecruiters

- File inputs live in a **shadow DOM** and are unreachable by ref-based upload
  from a browser extension. Hand the resume attachment to Bilal, or drive his
  computer directly. This is the one case where computer use beats the extension.
- Location and postal-code fields are **autocompletes**. Typing alone fails
  validation — you must click the suggestion.

## Ashby

- Tab state survives while the application is unsubmitted, so a half-filled form
  can be resumed later. Do not close a mid-fill tab.
- Watch for custom screening questions that are not in any standard answer set.
- A role can be **unlisted**: promoted on LinkedIn but absent from both the
  public board and `https://api.ashbyhq.com/posting-api/job-board/{org}`. It is
  still open. Find it through the employer's careers-page embed.
- Embedded Ashby boards expose the posting ID in page JS. Read
  `window.__Ashby.settings.jobPostingId`, then open
  `https://jobs.ashbyhq.com/{org}/{jobPostingId}/application` — the standalone
  form beats the iframe. (Proven on GovWell, 2026-08.)
- Single page. Text inputs register through a JS native value setter plus
  input and change events (check the __reactProps value afterwards). Yes/No
  questions are two buttons with an aria-pressed attribute; click the button
  via JS.
  Radios and checkboxes take a plain JS click. The Location combobox: set the
  input value via the native setter, dispatch input, wait for `role=option`,
  click the option. Resume is required; a Cover Letter field, when present, is
  file-only. An optional Diversity Survey (age bracket, transgender,
  communities) sits above the EEO block; leave what `bilal-answers` does not
  cover blank and flag it.

## Workday

- Account creation is usually mandatory. That is a **blocker** — hand it to Bilal.
- Multi-page wizard. Verify each page before advancing; going back can clear fields.

## Lever

- Simple single-page form. Resume upload is a plain file input.
- Plain HTML, not React: setting DOM values is enough. Standard inputs are
  named `name`, `email`, `phone`, `location`, `org` (current company), and
  `urls[LinkedIn]` etc. Custom questions live in `.application-question`
  blocks with textareas named `cards[...]`; EEO are native selects named
  `eeo[gender]`, `eeo[race]`, `eeo[veteran]`. Pronouns are checkboxes named
  `pronouns`. Lever's veteran wording is "I am not a veteran".

## LinkedIn Easy Apply

- Prefer "Apply on company website" and fill the real ATS instead.
- On LinkedIn, "Applied on company site" only logs the click. It is not an
  application. Never record it as one.
- The Apply button is an anchor to a LinkedIn redirect page whose `url` query
  parameter holds the real apply URL. Read it with JS instead of clicking, and
  return only hostname and path. The Chrome tool's output filter blocks any
  result containing a query string, so strip or decode params before returning.
- "Application submitted N hours ago" on the job page means Bilal already
  applied by hand. Skip, and check the tracker has it.

## Marketplaces that look like jobs

- SME Careers (sme.careers, by SuperAnnotate) posts "iOS Engineer" listings
  that resolve to a data-trainer signup behind a login. Not a job. Skip.

## Universal

- Never click an "Attach" button — it opens a native picker you cannot see. Use
  the file-upload tool on the input element.
- **Cowork's Chrome extension (2026-08) has no file-upload tool**, and a file
  input cannot be set from JS without the bytes in the page. Bilal drops the
  resume PDF (and the cover letter PDF where the field is file-only) on each
  form during his review pass. Fill everything else first; never block on it.
- Click coordinates are in the **screenshot's pixel frame**, not CSS pixels.
  Take a screenshot, read the pixel position off it, click that. Ref clicks
  work for plain inputs and radios but are unreliable for custom selects.
- Keyboard input reaches a tab only after one real click on it. Batches that
  start with typing into a freshly focused field lose the first keystrokes.
- CAPTCHAs, SSO, logins, and mandatory account creation are blockers. Stop and
  hand off; never attempt to defeat them.
- Grant "always allow" on the major ATS domains once, to avoid stopping on every
  page.
