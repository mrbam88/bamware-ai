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

## Workday

- Account creation is usually mandatory. That is a **blocker** — hand it to Bilal.
- Multi-page wizard. Verify each page before advancing; going back can clear fields.

## Lever

- Simple single-page form. Resume upload is a plain file input.

## LinkedIn Easy Apply

- Prefer "Apply on company website" and fill the real ATS instead.
- On LinkedIn, "Applied on company site" only logs the click. It is not an
  application. Never record it as one.

## Universal

- Never click an "Attach" button — it opens a native picker you cannot see. Use
  the file-upload tool on the input element.
- CAPTCHAs, SSO, logins, and mandatory account creation are blockers. Stop and
  hand off; never attempt to defeat them.
- Grant "always allow" on the major ATS domains once, to avoid stopping on every
  page.
