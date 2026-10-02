# BrewDesk marketing — brand-led launch and Instagram handoff

Decision and evidence: 2026-09-30. Canonical continuation point for this effort.
Supersedes the marketing channel suggestions in `brewdesk-gameplan-2026-09.md`;
that older document's release assumptions are historical, not current gates.

## October 2 research continuation

The [NYC audience and competitor brief](brewdesk-marketing-research-2026-10-02.md)
records the first application of the shared marketing skills and a proposed
seven-day Instagram checklist experiment. Research is complete for that bounded
pass; creative production and publishing approval remain pending. Apple lookup
verified public version 1.1 on October 2, superseding the historical submission
status below. This is listing verification, not an installed-build walkthrough.

## Bilal's direction

- BrewDesk is on the App Store; Bilal reports zero users and no acquisition effort.
  This is his report, not an analytics measurement. Instagram followers are not app users.
- Anonymous, brand-led, online-only marketing. No face, personal brand, personal
  social accounts, friend outreach, in-person promotion, or café visits required.
  The App Store developer identity may still be public; do not promise legal anonymity.
- Agents do research, copy, creative preparation, distribution preparation and
  authorized execution. Bilal approves batches and handles necessary login,
  verification and consent. Do not turn execution into homework for him.
- No ad spend, purchased placements or subscriptions authorized. No new app
  features, analytics-platform build or website rebuild as marketing prerequisites.
- Public posts, messages, profile changes and spending require approval. Approval
  of the strategy or API setup is not approval of particular content.

## Agreed work breakdown

Four-week organic experiment, not a forecast or guaranteed acquisition result:

1. Audit the public App Store build/listing and existing website; prepare a bounded
   fix list, measurement baseline and consumer-facing positioning.
2. Use the existing Instagram account; improve the profile and prepare three
   screen-recording videos plus three neighborhood carousels.
3. Publish three genuinely useful NYC neighborhood guides after approval, picking
   areas with strong evidence. Reuse the existing web presence and link to the app.
4. Research appropriate directories, NYC discovery accounts and newsletters;
   prepare transparent BrewDesk submissions/outreach, not personal promotion.
5. Review traffic/downloads and repeat use where existing measurement supports it.
   Repeat the strongest channel. SEO is long-term; do not infer retention from downloads.

No fabricated venue claims, testimonials, fake customers, stealth promotion,
account farming, bulk spam or imagery without rights. Existing marketing assets
(`marketing-media.md`) were made for consulting promotion; verify public-build
accuracy and reframe them for café-goers before reuse. Check the unresolved
photo-serving cost exposure before a traffic push; historical threshold estimates
in the old game plan are not a current cost audit.

## Public surfaces and audit findings

- Instagram: https://www.instagram.com/_brew.desk/
- Landing page: https://bamware.io/brewdesk
- App Store: https://apps.apple.com/us/app/id6802930990
- 2026-09-30 web extraction: `bamware.io` still said App Store "Coming soon";
  `/brewdesk` had a working App Store link. The latter's account/privacy and score
  claims need reconciliation with the public build. No website changes made.
- Full App Store screenshot/description audit and installed-build walkthrough are
  unfinished. Do not promote unreleased 1.1 features; STATE records 1.1 submitted.
- Verified Instagram API profile: BUSINESS; name and biography both `Bamware.io`;
  one follower; zero media objects; no website field returned. Snapshot only.

### Proposed profile copy — NOT approved or applied

Name: **BrewDesk | NYC Work Cafés**

Bio:

> Find your next café to work from in NYC.
> Explore spots. Check the details. Save your favorites.
> Free on iPhone ↓

Link: https://bamware.io/brewdesk

First pinned-post concepts (not produced/published): app demo; why coffee quality
is not the same as work suitability; one evidence-backed neighborhood guide.
Profile edits use Instagram settings, not the content-publishing API. Instagram
web settings reported bio-link editing as mobile-only.

## Instagram integration — verified milestone

Official Meta Instagram API with Instagram Login; no linked Facebook Page needed
for this route. No Instagram connector was present in the inspected Hermes MCP
catalog. This is a direct local API credential, NOT a completed MCP integration,
agent publishing tool, scheduler or approval queue.

Non-secret identifiers:

- Meta app: **BrewDesk Marketing**, ID `1454120269896043`, Business type.
- Instagram app: **BrewDesk Marketing-IG**, ID `1679873086902791`.
- Intended account: `_brew.desk`, Instagram user ID `17841436533902522`.
- App-scoped `id` from the profile response: `38880680541578076`; preserve the
  distinction from `user_id`, rather than silently substituting identifiers.
- Setup: https://developers.facebook.com/apps/1454120269896043/instagram-business/API-Setup/
- Roles: https://developers.facebook.com/apps/1454120269896043/roles/roles/

Verified sequence:

1. Bilal registered for Meta for Developers, created the Business app, added
   Instagram, invited `_brew.desk` as Instagram Tester and accepted the invitation.
   A personal-account tester invitation was also accidentally added; removal is
   not verified. Do not connect/publish through the personal account.
2. `_brew.desk` appeared in the app's account table. Bilal generated the token in
   his normal browser after the embedded preview would not operate the button.
3. Bilal entered the token into a hidden local terminal prompt, never into chat.
4. Real `GET https://graph.instagram.com/v26.0/me?fields=user_id,username`
   returned `_brew.desk` and `17841436533902522`.
5. Real `GET /v26.0/17841436533902522/content_publishing_limit?fields=quota_usage,config`
   passed: quota usage 0, quota total 100, duration 86400 seconds. Meta documents
   this endpoint as requiring `instagram_business_basic` and
   `instagram_business_content_publish`. This verifies that permission-gated
   read, NOT a successful end-to-end publish.
6. Real profile GET returned the public profile snapshot above.

Nothing was posted, scheduled or sent. Webhooks remained off. Last observed app
mode was Development. No Live-mode change, App Review or webhook setup completed.
Development/tester access is not proof of unrestricted production access.

## Local credential boundary and continuation

Installed only on the current ThinkPad/Linux host:

- Helper: `~/.local/share/brewdesk-marketing/connect_instagram.py`
- Credential: `~/.config/brewdesk-marketing/instagram-token`
- Setup creates credential directory mode 0700 and file mode 0600, refuses to
  overwrite, checks exact username before saving, and suppresses token output.
- Read-only identity recheck:
  `python3 ~/.local/share/brewdesk-marketing/connect_instagram.py --check`

The helper's syntax/CLI and real identity check passed. Its source and the
credential are **local only**, not published in this repo. Another machine must
not assume they exist or copy credentials automatically. Human credential
provisioning remains separate from durable capability documentation.

Never read/print the credential through chat tools, commit it, put it in command
arguments or ask Bilal to paste it in chat. API execution consumed it internally
via an Authorization header and printed only non-secret results.

Still unfinished:

- Token expiry, token type, renewal and revocation handling.
- Persistent, narrowly scoped publishing capability with explicit approved-post
  payloads, duplicate protection and published-ID/read-back verification.
- Approval queue, scheduling, comment/message management and insights checks.
- Actual approved-post publish/read-back test. No test post is pre-authorized.
- Multi-device/always-on deployment. Nothing installed on other profiles/hosts.

### Resume here

1. Recheck identity using the local helper without exposing the credential.
2. Establish expiry/renewal and a minimal approved-content publishing interface;
   do not create a broad automation platform or spend without approval.
3. Obtain approval for the proposed profile copy; then prepare the first actual
   content pack from accurate, licensed assets. Current drafts are concepts only.
4. Keep product/web fixes and marketing publishing separate; verify each external
   change by reading its exact target before claiming success.

## Tooling boundary learned

Hermes preview could read pages and navigate to URLs, but click/type actions
repeatedly reported success without changing the page. Desktop capture found no
Hermes window; no CDP endpoint was available. No root cause was established.
Do not repeat no-op clicks or claim changes landed. Ordinary-browser use enabled
Bilal to generate the token. This was a tool limitation, not a user permission
misconfiguration. Do not restart his app or turn marketing into a debugging project.

## References

- [Meta Instagram Login API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
- [First API call](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/)
- [Publishing limit and required permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit)
- [Existing asset pack](marketing-media.md)
