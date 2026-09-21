---
name: apply-to-job
description: The procedure for filling out and submitting an online job application on Bilal Malik's behalf. Use when applying to a job posting or automating an application flow on any ATS or company careers page. Orchestrates the guardrail check, profile load, form fill, verification gate, and tracker logging.
---

# Apply to a job

Thin orchestration. Each step delegates to the skill that owns it.

## 0. Ground rules

- `job-guardrails` wins over any request to apply.
- **Sell first, decide later (Bilal, 2026-09-21).** Every application is built
  to win THIS posting, not to reflect his preferences. He is flexible; the goal
  is offers, then he chooses. Adapt to what the form wants: in-office days,
  level, start date, travel, salary within the posted range (aim at the upper
  end, never above it). Lead with the resume bullets and projects that match
  the job description. Preferences never cause a lower-scoring answer.
- The one limit: flexible on preferences, never on facts. No invented years,
  skills, titles, degrees, or authorization answers — those get offers pulled.
- Log every screening (yes/no) answer and any salary number in the tracker
  notes, so a fast rejection can be traced to its cause.
- Quality over volume. A tailored application beats ten generic ones.
- Human in the loop. Bilal verifies the live form and submits.
- **Never fabricate, never default.** A fact not in `bilal-answers` — required
  field or optional — means STOP and ask, then write the answer back.
- Respect the site. Never defeat a CAPTCHA or a login.

## 1. Guardrail check

Read `job-guardrails`. Blocked or uncertain → do not apply, flag it for Bilal.

## 1b. Path check — easy path only (Bilal, 2026-08-21)

- **Do:** single-page forms. Land on one page, attach a resume, answer a few
  questions, submit. Ashby, Greenhouse, Lever, and custom career sites built on
  them.
- **Workday is in scope (Bilal, 2026-09-21):** he creates the account and signs in
  (one minute per employer), the agent fills the wizard to Review, one tenant at a
  time, saving each page as it is filled. See the Workday section of `ats-playbooks`.
- **Skip:** anything that requires creating an account, logging in, or walking
  a multi-step Next/Next/Submit wizard (iCIMS, Taleo, SuccessFactors,
  SmartRecruiters behind a login, AI-training marketplaces). List them in the
  summary as skipped; Bilal applies by hand if he wants them.
- Triage the whole batch first (resolve the real apply URL, identify the ATS,
  classify), then fill. Do not start a complicated one "just to see".

## 2. Capture the posting

Record company, role, location, comp if listed, URL, key requirements, and the
ATS. Then read that ATS's section in `ats-playbooks`.

## 3. Load context

`bilal-profile` for the index. `bilal-answers` before touching any field.
`bilal-resume` for upload rules. `bilal-cover-letter` for the letter.
Identifying, demographic, and compensation answers are in the private
`interviews` repo at `profile/private-answers.md`. If you cannot reach it, stop
and ask rather than guessing those fields.

## 4. Tailor

- Pick the 3 to 5 most relevant experience bullets for this role.
- Draft "why this company" with real specifics, never a brace left in.
- Include a tailored cover letter even when the field is optional.

## 5. Fill

Map profile to fields by ref. Re-scan after every selection — conditional
questions appear late.

## 6. Handle unknowns

No explicit answer → STOP, ask Bilal, then write it back: non-sensitive answers
to `bilal-answers` here, identifying or financial ones to the private repo.

## 7. Verification gate (mandatory)

1. Run the `form-verify` loop to completion.
2. Give Bilal a field-by-field summary, including flags: comp versus his target,
   in-office requirements, anything unusual, anything you could not verify.
3. **Bilal eyeballs the live form himself before submitting.** The agent's
   summary is not sufficient. This rule exists because a summary once claimed
   all-good while fields were wrong.

## 8. Submit and log

Bilal submits. Then create ONE NEW FILE in the private `interviews` repo at
`tracker/applications/<date>-<company-slug>.md`. Never append to a shared file —
per-application files are what let many agents log concurrently without
conflicting.

```
---
date: 2026-08-14
company: Example Co
role: Senior Mobile Engineer
ats: Greenhouse
status: Applied
link: https://...
comp: "$200k-$240k + equity"
location: NYC hybrid
---

## Notes

What was tailored, what was flagged, anything unusual about the form.
```

Slug is the lowercase company with non-alphanumerics as hyphens. Omit `comp` or
`location` rather than inventing them. **Never hand-edit `tracker/INDEX.md`** —
CI regenerates it from these files.

Status vocabulary: Researching → Applied → Screen → Interviewing → Offer →
Rejected → Withdrawn.

Saving progress mid-batch (forms filled, Bilal has not submitted yet): create
the file with `status: Researching` and a first Notes line "Form filled
<date>, pending Bilal's resume upload and submit", plus the open questions.
Flip to Applied when he confirms. A filled form is not an application.

Also add the same application as a row in Notion: **Job Tracker 2026 → Applications**
(data source `collection://5cb3530a-80eb-46dc-9e3c-f40a03e39839`; Company, Role, Status,
Date applied, Job link, Notes). GitHub is the record; Notion is Bilal's daily view. Both,
every time. (Missed on the 2026-09-16 batch of 11; Bilal had to ask.)

## 8b. Batch mode (Bilal, 2026-09-16)

- **Never stall a batch on Bilal.** Triage, then fill every form you can, each in its
  own tab, and leave them filled. He submits in one pass at the end. If one form is
  stuck, note it and move to the next. Do not stop at item two to ask a question.
- Ashby, Greenhouse, Workable, and Recruitee all keep a filled, unsubmitted form alive
  in its tab, so "fill everything, submit later" works.
- Log every filled form to the GitHub tracker immediately as
  `status: Filled - pending submit`, then flip to Applied as he confirms.
- Detecting a submit from the page: Ashby says "Your application was successfully
  submitted"; Greenhouse's tab title becomes "Thank you for applying"; Workable appends
  `?success` and says "submitted successfully"; Recruitee's URL ends in `/applied`.
  Check all four wordings, not just "thank you".
- Content rules that bit this round: never mention Baat, never mention his neighborhood
  or commute. See `bilal-answers`. Grep every filled textarea for "baat", "west village",
  "manhattan", "commut" before handing off.

## 9. Blockers

CAPTCHA, SSO, mandatory account creation, or anything needing his credentials →
pause and hand off with a clear note on what is needed.
