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

## Greenhouse, fixing "This field is required" after a failed submit (Affirm, 2026-09-23)

- Fiber `selectOption` AND JS-clicking `.select__option` both show the value but the form
  still reports every React-Select as required on submit. Fix that worked for Bilal before:
  a real reselect. Agent recipe: `scrollIntoView` the `.select__control`, compute its
  center as `rect * (screenshotWidth / innerWidth)`, real-click it, (type to filter for long
  lists), read the option's rect the same way, real-click it. The red "required" text does
  not clear until the next submit, so it cannot be verified before Bilal clicks Submit.
- Workday: when Bilal uploads the resume on My Experience the page can reload and drop every
  unsaved row (Synchrony). Ask for the resume BEFORE filling page 2, or save right after.

## Greenhouse dropdowns: THE FIX THAT WORKS (Bilal, 2026-09-23, "this issue happens often, it worked, remember this")

**Read this before touching any Greenhouse form. It overrides the background-fill recipe below for every dropdown.**

Script-set React-Selects LOOK filled but Greenhouse's form state never receives them. Submit then
fails with "This field is required", "Select a country" or "Phone is required" under fields that
visibly show an answer. Proven again on Reddit 2026-09-23: fiber `selectOption` failed, and calling
the Select's own `onChange` from JS also failed. Real clicks passed on the very next submit.

Per flagged dropdown, with the tab in front:

1. Screenshot first and read the coordinate frame. It changes when the window resizes, so recompute
   every time: scale = frame width / `innerWidth` (same for height).
2. Real click on the dropdown ARROW at the right end of the control. Clicking the middle can land in
   the neighbouring field.
3. Wait 1 s. Find the option with JS (`.select__option` whose text matches), scale its rect to the
   frame, and real click it. If the option is below the viewport, type a few letters of it and press
   Enter instead.
4. Multi-selects (gender, sexual orientation, ethnicity): real click the chip's x first, then open and
   pick again. Press Escape after.
5. Country code: real click the flag control, click "United States +1". The phone error clears with it.
6. The red "required" text does NOT clear until the next Submit. Do not judge success by it.

Default from now on: text fields and textareas may be set by JS, but set EVERY Greenhouse dropdown
this way before handing off. Never hand off a Greenhouse form whose dropdowns were script-set.

Two traps seen on the same form: a hidden background tab does not hydrate React until one real click
lands on it, and the extension's JS runs in an isolated world where `__reactFiber` keys are invisible
(inject a `<script>` element to read them).

## Greenhouse, background-tab fill (2026-09-21, xAI / Robinhood / MLB / Fanatics)

**CORRECTION (Bilal, 2026-09-22, after submitting all four):** the recipe below fills the
form visually and `__reactProps` reads back, but Greenhouse's submit validation still
flagged "many" fields on every form; Bilal had to click into each flagged field and
reselect it by hand before submit went through. So background fill is a DRAFT, not a
finished form. Rules that follow: (1) tell Bilal up front that script-set React-Selects
will show red on submit and need a reselect; (2) when the tab can be brought to the
front, prefer the keystroke path (real click, ArrowDown, click option) for every
React-Select and for Location, and keep the JS native setter only for plain text and
textareas; (3) after any fill, the hand-off summary lists which fields were script-set.
Lever (Hinge) did not complain.

When the tab is NOT in front (Chrome kept snapping back to the Claude tab all night),
the whole job-boards React form can still be filled from JS reads alone. Verified on
four forms; every field read back through `__reactProps` matched.

- **Text inputs and textareas:** native setter + `input` + `change` + `blur`:
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v)`
  (HTMLTextAreaElement for textareas), then the three events. React registers it.
  Verify with `el[Object.keys(el).find(k=>k.startsWith('__reactProps'))].value`.
- **Every React-Select (country, screening, EEO):** do NOT try to open the menu. Walk
  the fiber up from the combobox input (`el[__reactFiber$...]`, follow `.return`)
  until `memoizedProps` has `options` AND `selectOption`; flatten grouped options,
  find by exact `label`, call `props.selectOption(opt)`. Option labels as in the
  boards API: "United States +1", "Cisgender man", "I am not a protected veteran".
- **Location (City), async:** same fiber; call
  `props.selectProps.onInputChange('New Yor',{action:'input-change'})`, wait ~1 s,
  then `onInputChange('New York',...)`, wait ~3.5 s, re-walk the fiber (props are
  replaced), then `selectOption` the "New York, New York, United States" option
  from `selectProps.options`. One call alone returned nothing; two staged calls did.
- **Cover letter as text:** `[...document.querySelectorAll('button')]
  .filter(b=>/enter manually/i.test(b.textContent))[1].click()` reveals
  `#cover_letter_text`; set it with the textarea native setter.
- **Phone:** native setter with digits only; intl-tel-input reformats to
  (xxx) xxx-xxxx once the country React-Select is "United States +1".
- Race dropdown appears only after Hispanic/Latino is picked; wait ~1 s, then pick.
- The boards API (`?questions=true`) gives the option labels up front, so the whole
  fill is one JS call per form. Resume/cover-letter file inputs still stay with Bilal.

## Lever, background-tab location (2026-09-21, Match Group / Hinge)

- Plain fields: DOM value + input/change is enough (unchanged).
- **Current location** needs per-character synthetic keys, not one `input` event:
  for each char append to `#location-input.value` and dispatch keydown, keypress,
  InputEvent(input), keyup; wait 3 s; `.dropdown-results > *` then holds
  "New York, NY, USA"; dispatch mousedown + click + mouseup on it.
  `#selected-location` (hidden `selectedLocation`) then carries the place JSON.
  That hidden field is the one Lever validates.
- Match Group's Hinge form has no cover letter or free-text field at all; the
  only textarea is "What are your pronouns?".

## SmartRecruiters

- File inputs live in a **shadow DOM** and are unreachable by ref-based upload
  from a browser extension. Hand the resume attachment to Bilal, or drive his
  computer directly. This is the one case where computer use beats the extension.
- Location and postal-code fields are **autocompletes**. Typing alone fails
  validation — you must click the suggestion.

- The `oneclick-ui` Easy Apply form (Versant, 2026-09-21) is ALL shadow DOM:
  `read_page` sees nothing but "Apply With Indeed". Plain inputs still accept a
  real click at screenshot coordinates + keystrokes; read values back with a JS
  walker that recurses into `shadowRoot`s. City: type "New York", click the
  "New York, NY, US" suggestion. Experience/Education "Add" rows are optional.
  **Next is gated on the resume** ("Please attach your resume to complete this
  application"), so page 2 (screening questions) is only reachable after Bilal
  uploads. Message to the Hiring Team = the short "why" answer.

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
- **Background-tab fill works (Arcus, 2026-09-22):** the React native value setter
  plus input/change/blur registers on Gem's text inputs and textareas, and
  `radio.click()` from JS flips React state; `__reactProps` read back matched on
  every field. Text inputs carry no name/id, so map them by DOM order against the
  label order on the page (First name, Last name, Email, LinkedIn URL).
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

- **Country code React-Select is blank by default (NYT, 2026-09-21).** It shows
  "Select country" and the phone will not validate. JS focus `#country`, type
  "United States", wait 1 s, JS-click the `.select__option` whose text is
  "United States +1"; the phone input then reformats itself to (xxx) xxx-xxxx.
- `scrollIntoView` from JS does nothing on a fresh job-boards tab until one real
  click lands on the page. Click a blank margin first, then scroll by JS.
- NYT (`thenewyorktimes`) form: 13 screening React-Selects + two custom
  demographic selects (gender Female/Male/Non-Binary..., ethnicity list) ahead
  of the EEOC block; no disability question. Its posting asks candidates not to
  use GenAI for application content: paste only the standard letter and facts.

## Workday

Proven end to end on five tenants on 2026-09-21 (CareScout/Genworth, GEICO, Disney,
Fox, Synechron) from the Claude in Chrome extension. 15-25 minutes of agent time each.

- **Split of work (Bilal, 2026-09-21: Workday is in scope).** Each employer has its
  own Workday account. The agent may not create accounts or type passwords, so Bilal
  does one minute per employer: Apply -> Create Account or Sign In, verify email if
  asked, leave that tab in FRONT. The agent does everything after.
- **Sessions expire, and "Something went wrong / Please refresh" on Save and Continue
  means the sign-in is gone.** The reload lands on Create Account and the unsaved page
  is lost (pages already saved survive). Work ONE tenant at a time, right after Bilal
  signs in; save every page the moment it is filled; do the cheap pages first. Never
  fill four tabs and save later.
- **Consent boxes and knockout questions: answer them, don't ask (Bilal, 2026-09-21).**
  A blank or a "No" on sponsorship, authorization, over-18, terms, "worked here
  before" auto-rejects. Tick every required terms box and answer knockouts from
  `bilal-answers` without stopping. Mention arbitration or non-compete clauses in one
  line in the hand-off summary, never as a mid-form stop. If a rule prevents ticking
  something, say so up front.
- **Get the resume PDF attached to the task BEFORE a Workday batch.** Fox (page 2) and
  Disney (step 1) require the upload and will not advance without it.
- Three entry paths. **Apply Manually** (CareScout): empty rows, type everything.
  **Autofill with Resume** (Synechron, Disney): parser rows have correct titles,
  companies and dates but empty locations and mangled descriptions; keep the rows,
  retype `--location` and every `--roleDescription`, add missing roles with Add
  Another. **Use My Last Application** (GEICO): prefilled from an OLD profile (stale
  address, wrong "I currently work here" tick, old wording); re-read every field.
- **Role Description = his resume bullets, as bullets (Bilal, 2026-09-21).** Copy the
  bullets for that job from `bilal-resume/resume.txt` word for word, one per line,
  each starting with "- ", Return between them. No "Stack:" line, no merging into a
  paragraph. Single-sentence early roles get that one sentence.
- **Stable element ids.** `source--source`, `name--legalName--firstName`,
  `name--legalName--lastName`, `address--addressLine1`, `address--addressLine2`
  (Disney), `address--city`, `address--countryRegion` (state button),
  `address--postalCode`, `address--regionSubdivision1` (Disney county),
  `phoneNumber--phoneType`, `phoneNumber--phoneNumber`. Repeating rows carry a random
  index (`workExperience-46--jobTitle`), so select by SUFFIX and take the last match:
  `--jobTitle`, `--companyName`, `--location`, `--startDate-dateSectionMonth-input`,
  `--endDate-dateSectionMonth-input`, `--roleDescription`, `--schoolName`, `--degree`,
  `--fieldOfStudy`, `--lastYearAttended-dateSectionYear-input`, `--url`,
  `skills--skills`, `socialNetworkAccounts--linkedInAccount`. Footer:
  `[data-automation-id=pageFooterNextButton]`; row adders:
  `button[data-automation-id=add-button]`, in section order (work, education, certs,
  languages, websites); a section's group has `aria-labelledby="Websites-section"`.
- **Text fields:** one real click on the page, then JS `el.focus(); el.select()` and
  REAL keystrokes. Registers every time; verified on the Review page.
- **Month/year dates:** focus the Month input, type six digits (`042025`); it
  auto-advances to Year.
- **Full dates (month/day/year, disability form):** JS focus + typing LOOKS right but
  fails validation. Real click on the Month spinbutton (ref click works), type
  `09212026`, then real-click another field to blur. Never Backspace inside the
  sections. The date must be today.
- **Dropdowns (button + listbox):** JS focus the button, press Return, wait 1 s, then
  JS-click the matching `[role=option]` inside the VISIBLE `[role=listbox]` (the DOM
  keeps stale listboxes; picking by global `[role=option]` grabs the wrong one). Read
  the option texts first; wording differs per tenant.
- **"How did you hear", Field of Study, Skills** are search prompts: type, Return,
  wait 3 s, then JS-click the `[data-automation-id=promptLeafNode]` with the exact
  text; result shows as a pill (`[data-automation-id=selectedItem]`). Skill names are
  odd: no plain "Swift" (SwiftUI/SwiftData only); "Flutter Software Development Kit
  (SDK)"; "Kotlin Programming Language"; "GraphQL (Query Language)"; "MongoDB
  (Platform)". React Native, TypeScript, Node.js, PostgreSQL match exactly.
- **Checkboxes and radios:** real ref clicks. JS focus + Space is unreliable.
- After every Save and Continue, read the page: a stuck page shows "Errors Found" at
  the top; an expired session shows "Something went wrong".
- Veteran options differ per tenant: "I am not a Veteran or have any Military
  affiliation" (CareScout), "I AM NOT A VETERAN" (Disney, all caps), "I am not a
  veteran" (Fox), "No" to "served in Active/Guard/Reserve" (GEICO). Gender at Disney
  is Man/Woman/Nonbinary.
- Tenant questions seen: GEICO asks reasons for leaving the last three positions
  (free text), desired salary (free text), a state professional license, an FCRA
  acknowledgement ("I have read and acknowledge"), and in-person attendance; its
  terms box covers a hair-sample drug screen, interview confidentiality and at-will.
  Fox asks "ever employed by a Fox entity" (radio, page 1), a salary BUCKET
  ($230k target -> "200,001 to 250,000"), highest education, and a work-samples
  box (put bamware.io + GitHub there); Fox has no work-history form at all, page 2 is
  only the resume upload. Disney asks "why apply" checkboxes (chose reputation +
  career advancement) and consent to be considered for other Disney roles (Yes);
  its terms include a medical exam if hired and use of likeness. CareScout asks
  relatives at Genworth and KPMG history; its terms include binding arbitration.
- Stop at Review. Bilal reads the live page and clicks Submit. Detect a submit by the
  tab moving to `/jobTasks/completed/application` (title "Candidate Home").

- **Apply With LinkedIn (Fabletics, 2026-09-21)** signs Bilal in and prefills
  every work row from LinkedIn: LinkedIn titles ("Manager, Mobile Engineering",
  "iOS Developer", "WMI Robotics"), LinkedIn-era dates (NuvoAir end 1/2024, VPG
  "currently work here" still ticked), LinkedIn descriptions with • bullets,
  empty locations. Retype title/company/location/description on every row to
  resume wording; untick VPG current and type `072026`; retype NuvoAir end
  `112023`. Education row came as "Temple University College of Engineering" /
  Bachelors / Electrical Engineering; retype the school name.
- **Skills prompt keeps the typed text after a pick.** Typing the next skill
  appends ("React NativeTypeScript") and the search returns junk. Working loop
  per skill: JS native-setter clear + `input` event, Escape, ONE real click on
  the input (screenshot coords), type, Return, wait 3 s, JS-click the
  `promptLeafNode` with the exact text. `cmd+a` did NOT select-all here.
- **State/phone-type dropdowns:** after Return opens the list, pick with JS from
  options where `offsetParent !== null` and text matches exactly; a global
  `[role=listbox]` search grabbed the phone-country prompt instead.
- Fabletics page 1 asks SMS Opt-in / WhatsApp Opt-in checkboxes (left blank;
  SMS consent is still an open answer). Page 2 requires the Resume/CV upload
  (5 MB max) before Save and Continue, so get the PDF attached first.

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
- A job LinkedIn shows as "New York, NY" can resolve to a different city on the
  real ATS (US Mobile, 2026-09-22: Lever posting says Toronto, hybrid). Read the
  ATS page's own location line before filling and flag any mismatch.
- Easy Apply resume picker: Resume_BilalMalik_20269.pdf (9/21/2026) is the
  preselected current resume as of 2026-09-22. Farther's Easy Apply is
  Greenhouse-backed (URL gains applicantTrackingSystemName=Greenhouse at Review).
- "Application submitted N hours ago" on the job page means Bilal already
  applied by hand. Skip, and check the tracker has it.

- "Clicked apply" + "Did you finish applying? Yes / No" on a LinkedIn job page
  means Bilal clicked through once (On Me, 2026-09-21). Still not an
  application; check the tracker, then apply on the real ATS.

## YC Work at a Startup (workatastartup.com)

- `ycombinator.com/companies/{co}/jobs/{id}` "Apply to role" goes to YC login; Bilal logs
  in himself. The job then opens at `workatastartup.com/jobs/{id}`. Apply = one free-text
  message to the founder (min 50 chars, "human-written messages are more likely to get a
  response"), then Send. No resume upload, no screening. Use the short "why this company"
  shape in Bilal's voice. The Apply button needs a coordinate click; the ref click did not
  open the modal. (Hype, 2026-09-23.)
- His WaaS profile is stale (still shows NuvoAir as current). Flag it; founders read it.

## Hidden-tab behaviour (2026-09-23, side panel)

- `document.visibilityState` is "hidden" for every agent tab, yet real clicks (ref and
  coordinate) and keystrokes DID land on Workday, Ashby and WaaS. Screenshots work too.
- Workday search prompts (How did you hear, Field of Study, Skills): JS `focus()+select()`
  on the input, type, Return, wait 3 s, JS-click the exact `promptLeafNode`. A coordinate
  click on the skills box from a hidden tab did NOT take keystrokes; the JS focus path did.
  Clear between skills with the native setter + `input` event.
- Workday "Add" rows: after clicking Add, re-read the LAST row whose jobTitle is empty
  before typing. Taking the last row id on a timer typed row 3 over row 2 once.
- Workday Resume/CV is required on My Experience for both TR and Synchrony; Bilal drops
  the PDF, everything else can be filled first. Save and Continue only after the upload.
- The Chrome tool's output filter blocks results that contain a phone number or long
  company/location strings on some pages ("Cookie/query string data"); return counts
  or lengths instead of raw values when that happens.

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
- **Side-panel sessions (2026-09-21): the tab in front is usually the Claude tab, and
  it snaps back within seconds of `tabs_create`.** `navigate` and JS still work in the
  background tab; clicks/keystrokes do not. Use the Greenhouse and Lever
  background-tab recipes above and skip the keystroke path entirely.
