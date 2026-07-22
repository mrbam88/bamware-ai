# Bamware business models (decided 2026-07-23)

Bilal's call: **support all three** — flexibility is the core of Bamware.
Sell software at whatever altitude the client wants, plus consulting as a
fourth revenue stream. The serverless stack (Lambda + DynamoDB + S3) makes
this cheap: the unit of delivery is *an AWS account with Terraform
applied*, never a container cluster.

## The ladder

| # | Model | What the client gets | We operate? | Revenue shape | Status |
|---|---|---|---|---|---|
| 1 | **Multi-tenant SaaS** | Branded app (their store accounts), shared backend, tenantId isolation | Yes | Subscription / rev-share | **Works today** — needs `create_tenant` automation |
| 2 | **Dedicated instance** | Same stack in a separate AWS account, physical data isolation, own domains | Yes | Setup fee + managed hosting | Needs Terraform completeness + parameterization |
| 3 | **Full buyout** | Repos + Terraform + RUNBOOK + handover week, deployed to THEIR AWS | No | Large one-time license + support contract | Needs everything in #2 + legal templates |
| 4 | **Consulting** (Upwork/Fiverr/direct) | Bilal + the agent engine building on their stack | n/a | Hourly/project | The bamware-ai process engine travels to any codebase |

## Prerequisites by gap

- **Terraform completeness** — everything the product needs must be in
  bamware-infra (dating-service, SNS, S3, Secrets Manager). Rule: *if
  it's not in Terraform, you can't sell it twice.*
- **`environments/<customer>/`** parameterization: account, region,
  tenant id, domains.
- **App template repo** (`create-bamware-app`) so app #2 isn't a fork
  of Baat.
- **Contract package** (dating-app #6) so client/server version
  together during handovers.
- **Bamware MCP server** — the one-person sales-engineering dept (see
  its issue): `create_tenant` (model 1, minutes), `provision_dedicated`
  (model 2, terraform wrapper).
- **Non-code**: license/IP terms, data ownership, SLA templates —
  lawyer, not repo.
- Docker/K8s: only if a buyer demands cloud-agnostic. Services are
  serverless-http-wrapped Express — containerizing is ~a day, on demand.

## Positioning notes

- Model 1 is the default pitch; 2 is the "enterprise/compliance" tier;
  3 is priced so the handover is worth it.
- Consulting gigs seed future model-1/2 customers and stress-test the
  process engine on foreign codebases.
