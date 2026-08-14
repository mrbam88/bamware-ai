---
name: apply-to-job
description: The procedure for filling out and submitting an online job application on Bilal Malik's behalf. Use when applying to a job posting or automating an application flow on any ATS or company careers page. Orchestrates the guardrail check, profile load, form fill, verification gate, and tracker logging.
---

# Apply to a job

Thin orchestration. Each step delegates to the skill that owns it.

## 0. Ground rules

- `job-guardrails` wins over any request to apply.
- Quality over volume. A tailored application beats ten generic ones.
- Human in the loop. Bilal verifies the live form and submits.
- **Never fabricate, never default.** A fact not in `bilal-answers` — required
  field or optional — means STOP and ask, then write the answer back.
- Respect the site. Never defeat a CAPTCHA or a login.

## 1. Guardrail check

Read `job-guardrails`. Blocked or uncertain → do not apply, flag it for Bilal.

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

## 9. Blockers

CAPTCHA, SSO, mandatory account creation, or anything needing his credentials →
pause and hand off with a clear note on what is needed.
