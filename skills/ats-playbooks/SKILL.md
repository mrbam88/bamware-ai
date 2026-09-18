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
- Single page, React with react-hook-form. **Script-set values do NOT register
  (Rain, 2026-09-16).** A JS native-setter plus input/change events makes the
  field LOOK filled, and `__reactProps.value` even matches, but submit still
  reports "Missing entry for required field" for every such field. Same for
  `radio.click()` from JS. What works: one real click on the field, select-all
  (Cmd-A on Bilal's Mac), then real keystrokes; radios and the aria-pressed
  Yes/No toggles need a real click at screenshot coordinates (ref clicks on the
  toggles were also flaky). Textareas are uncontrolled and do accept a JS
  setter, but retype them anyway when the form has already flagged errors.
  The Location combobox: real click, type "New York", click the
  "New York City, New York, United States" option. Ashby only validates on
  submit, so after filling, Bilal clicks Submit and reads the red "Your form
  needs corrections" banner; each listed field is one that was script-set.
- Resume is required; a Cover Letter field, when present, is file-only. An
  optional Diversity Survey (age bracket, transgender, communities) sits above
  the EEO block; leave what `bilal-answers` does not cover blank and flag it.
- Org slugs can contain spaces: Superhuman's board is
  `jobs.ashbyhq.com/Superhuman%20Platform%20Inc/...`. `/superhuman/` and
  `/grammarly/` both 404. Read `window.__Ashby.settings.ashbyBaseJobBoardUrl`
  on the careers page to get the exact one.

- **Upload the resume LAST (2026-09-16, six Ashby forms).** Ashby's "Autofill from
  resume" parser fires on any resume upload, including the main Resume field, and when
  it finishes it re-renders the form and wipes every typed field. Order that works: type
  all text, click all toggles and radios, pick the date, then upload the resume, wait
  ~8s, re-read every value. Typed values survive when the upload comes last.
- **Ref clicks do not focus Ashby inputs from the Chrome extension.** The click lands,
  the field shows focus, but keystrokes go nowhere. Use screenshot-frame coordinates.
  Reliable recipe: JS `el.scrollIntoView({block:'center'})`, wait 1s (the scroll is
  smooth; clicking immediately hits the old position), click at the element's rect
  center scaled by `screenshotWidth / innerWidth`, then type. Fields near the top or
  bottom of a short page cannot scroll to center, so read their rect after the wait.
- Number-typed inputs (Comun's "Yearly gross salary expectation") reject anything but
  digits; type `220000`, not "$220k, negotiable".
- Date pickers: click the field, then use `find` for the day option
  ("Choose Thursday, October 1st, 2026") and click it by ref. That one ref click works.

## Workable

- Standalone `apply.workable.com/{org}/j/{id}/apply/`. Plain React form: ref clicks and
  typing work directly; file input takes the upload tool. Fuse Energy's form was name,
  email, resume only. Decline the cookie banner first. Success appends `?success`.

## Recruitee

- Custom domains (`highroller-careers.com/o/{slug}`). The Apply tab is a tab, not a
  page; click it at screenshot coordinates to reveal the form, then ref clicks work.
  Phone field is a country select plus tel input; click at the end of the "+1" and type
  the digits. Two file inputs (CV, cover letter) take the upload tool. Radios by
  coordinate. Templated screening questions may not fit the role ("work permit for
  Malta" on an NYC job); answer literally and note it. Success URL ends in `/applied`.

## Gem (jobs.gem.com)

- Single page, form at the bottom of the posting (`jobs.gem.com/{org}/{id}`).
  Plain React: coordinate clicks + real keystrokes work; the Location field is
  a free text box, not an autocomplete ("New York, NY" is fine). Custom
  selects are buttons that open a menu; click the button, then click the
  option at screenshot coordinates. Radios take ref clicks.
- Mouse-wheel scroll did nothing in the Gem tab; use `scroll_to` with a ref
  from `find` instead.
- Textareas auto-grow as you type, so a click aimed at the NEXT field by
  pre-typing coordinates lands inside the previous textarea and appends to
  it. Re-screenshot after each long answer before clicking the next field.
- Required privacy-consent select ("Acknowledge/Confirm") sits between the
  short answers and the EEO block. Two submit buttons: "Apply and save"
  (creates a Gem profile) and "Apply without saving". (Quo, 2026-09-17.)

## Greenhouse, extra (2026-09-17)

- The public boards API gives the whole form without opening a tab:
  `https://boards-api.greenhouse.io/v1/boards/{org}/jobs/{id}?questions=true`
  returns the description, every question, its options, and which are
  required. Read it during triage to spot below-floor ranges and unanswerable
  questions before filling. `.../boards/{org}/jobs` lists the board.
- A `grnh.se` short link resolves server-side (curl `-w '%{redirect_url}'`)
  to the company careers page with `gh_jid=`; the job id is the token for
  the standalone embed URL. Nanit's careers page hides the embed entirely.
- Greenhouse Location (City) autocomplete: type "New York", wait 2 s, click
  the first suggestion "New York, New York, United States" by coordinate.
- Some Greenhouse forms (NPR) put the mouse-wheel-blocking textarea in the
  middle of the page; scroll by wheel over a non-textarea area or use
  `scroll_to` by ref.

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
- **File uploads stay with Bilal.** The Chrome extension's file-upload tool
  (2026-09) only reads files on Bilal's own machine, so a PDF sitting in the
  cloud session cannot be attached; a file input cannot be set from JS either.
  Bilal drops the resume PDF (and the cover letter PDF where the field is
  file-only) on each form during his review pass. Fill everything else first;
  never block on it. On LinkedIn Easy Apply the resume picker defaults to the
  last-uploaded PDF, so after Bilal uploads the new one once it is preselected
  for the rest of the batch.
- Ceipal candidate portals (OP/OrangePeople): plain single-page "Easy Apply"
  form; country/state/city are searchable dropdowns and the city pick
  auto-fills a wrong zip. Conrep portals (Technomax): the Apply button opens a
  popup window outside the tab group; hand it to Bilal. iCIMS (Peraton) forces
  account login; blocker.
- Click coordinates are in the **screenshot's pixel frame**, not CSS pixels.
  Take a screenshot, read the pixel position off it, click that. Ref clicks
  work for plain inputs and radios but are unreliable for custom selects.
- Keyboard input reaches a tab only after one real click on it. Batches that
  start with typing into a freshly focused field lose the first keystrokes.
- CAPTCHAs, SSO, logins, and mandatory account creation are blockers. Stop and
  hand off; never attempt to defeat them.
- Grant "always allow" on the major ATS domains once, to avoid stopping on every
  page.
- **The extension can only click, type, or screenshot in the tab Bilal is looking at.**
  Background tabs allow `read_page`, `find`, and JS reads only. `tabs_create` makes the
  new tab active, so the batch pattern is: new tab per application, fill it, move on. If
  Bilal clicks another tab mid-fill, every action fails with "Tool failed in the
  extension" until you open a fresh tab. Tell him to leave the browser alone during a
  batch, and give a time estimate.
- The extension's file-upload tool DID accept files from the cloud session's scratch
  directory on 2026-09-16 (resume + cover letter on Ashby, Greenhouse, Workable,
  Recruitee). The 2026-09 note above about uploads staying with Bilal is not always
  true; try the upload tool first, hand off only if it errors.
- Coordinate frame changes when the window is resized or a tab opens in a different
  window. Always take one screenshot per tab to read the frame size before computing
  click coordinates; never reuse a frame from another tab.
- **Focus loss mid-batch (2026-09-17, three times in one session).** The browser's
  selected tab flipped back to the "New Tab" page during long `browser_batch` calls, and
  every later action in the working tab failed with "Tool failed in the extension"
  (JS reads included). Recovery that worked: `tabs_context_mcp` to confirm, then a fresh
  `tabs_create` + navigate and refill from scratch. Keep batches short (one field group
  per call) on long forms so less is lost, and verify with a JS read at the end of each
  batch. Right after `tabs_create`, the first keystrokes can be dropped even after a
  click; do a `scroll_to` + screenshot first, then click and type, then read back.
- No resume or cover letter PDF was reachable this session (not in git, not in Drive;
  the 2026-09-16 uploads came from a per-session attachment). Every form was left with
  the file inputs empty for Bilal. Attaching the PDFs to the Cowork task at the start
  of a batch avoids this.
