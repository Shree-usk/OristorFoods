# STORY-069: Deployment & Infrastructure Launch

**Status:** Draft
**Epic:** 10 — Production Launch
**Priority:** High
**Persona(s):** DevOps/Engineering Team, Oristor Business Team (as the accountable stakeholder for go-live decisions)

## User Story
As the DevOps/engineering team, I want a documented, repeatable production deployment pipeline — hosting, domain, SSL, environment configuration, and promotion workflow — so that ODEP can be released to production safely and releases after launch are low-risk and reversible.

As the Oristor business team, I want the hosting/cloud provider decision made and documented before any production infrastructure is provisioned, so that the platform is not built on an assumption that has to be unwound later.

## Description
This story covers Build Order item 10, "Production Launch," in `docs/blueprint.md` Section 9 — specifically the deployment, domain, SSL, and environment/CI-CD portions of that item. It picks up where Epic 09 (Quality & Security) leaves off: once the platform meets production quality standards, this story stands up the actual infrastructure that serves it to the public.

**This story is scoped as provider-agnostic.** `docs/blueprint.md` Section 10 explicitly lists "Hosting/cloud provider specifics" as an open item the source spec never confirmed. Rather than guessing a provider (e.g. Vercel, AWS, Azure, a self-managed VPS), this story's Acceptance Criteria require the decision to be made and documented as a named prerequisite deliverable, after which the remaining tasks are written to be executable against whichever provider is chosen, using standard Next.js production deployment patterns (containerized or platform-native) that are not provider-specific. Any task below that would need to change materially depending on the provider is flagged inline.

## Acceptance Criteria

**Prerequisite (must be satisfied before any other AC in this story can close):**
- [ ] Hosting/cloud provider decision is made by the Oristor business/engineering stakeholders and documented in `docs/architecture-decisions.md`, including: provider name, region(s), compute model (serverless/container/VM), estimated monthly cost, and rationale
- [ ] ERP system identity and its go-live integration touchpoints (owned by STORY-070) are cross-referenced here only insofar as they affect network/firewall/allowlist requirements for this story's environment configuration — full ERP scope stays in STORY-070

**Domain, DNS, SSL:**
- [ ] Production custom domain is registered/confirmed and DNS is pointed at the chosen provider (A/AAAA/CNAME records as required by that provider)
- [ ] SSL/TLS certificate is provisioned and auto-renewing (managed certificate service or ACME/Let's Encrypt automation) — no manually-renewed certs
- [ ] HTTP → HTTPS redirect is enforced at the edge for all production traffic
- [ ] `www` vs. apex domain canonicalization is decided and enforced with a single 301 redirect direction (no duplicate-content risk)
- [ ] DNS/domain configuration is documented in `docs/architecture-decisions.md`, including registrar, DNS provider, and TTL choices

**Environment configuration & secrets:**
- [ ] A distinct production environment configuration exists, separate from dev/staging, with its own `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and all other variables listed in `.env.example`
- [ ] All production secrets are stored in the provider's managed secret store (not committed to the repo, not stored in plaintext CI logs)
- [ ] `.env.example` at the repo root is up to date with every variable required for production, each with a comment describing its purpose, with no real values
- [ ] Least-privilege access is enforced for production secrets (only the CI/CD pipeline and named engineers can read them)

**CI/CD promotion pipeline:**
- [ ] A three-stage promotion pipeline exists mapping to the blueprint's Git workflow (Section 8: main/develop/feature/release/hotfix): `develop` branch auto-deploys to a dev environment, a `release/*` branch or tag deploys to staging, and `main` deploys to production only after manual approval
- [ ] Production deploys require passing the full validation gate from `docs/blueprint.md` Section 8 (build, TypeScript, lint, unit + integration tests, accessibility, performance, security checks) before promotion is allowed
- [ ] Production deploys require at least one human approval step (e.g. GitHub Environments protection rule) — no fully automatic deploy to production
- [ ] Every production deploy is tagged/versioned and traceable back to a specific commit SHA and Conventional Commit history

**Database migration strategy:**
- [ ] A documented production migration procedure exists using `prisma migrate deploy` (not `migrate dev`) run as a discrete, auditable CI/CD step separate from application deploy
- [ ] Migrations run against a pre-deploy backup/snapshot of the production database, taken automatically as part of the pipeline
- [ ] Backward-compatible migration practice is documented (e.g. additive-first, expand/contract pattern) so a mid-deploy rollback never leaves the schema in a state the previous app version can't read
- [ ] A staging environment with production-like data volume is used to dry-run every migration before it touches production

**Rollback plan:**
- [ ] A documented, tested rollback procedure exists covering both application rollback (redeploy previous tagged build) and database rollback (documented compensating migration or restore-from-backup path) for at least one rehearsed scenario
- [ ] Rollback can be triggered without waiting for a new CI/CD run (e.g. one-click redeploy of last-known-good build in the provider's console or a documented CLI command)
- [ ] Maximum acceptable rollback time is defined and documented (e.g. under 15 minutes for application rollback)

## Tasks

- [ ] **Infrastructure:**
  - [ ] Facilitate the hosting/cloud provider decision meeting with Oristor stakeholders; document the outcome in `docs/architecture-decisions.md`
  - [ ] Provision production compute/hosting per the chosen provider (project/account setup, resource sizing, region selection)
  - [ ] Provision production PostgreSQL instance (managed database service or self-managed, per provider decision), sized for expected launch load
  - [ ] Configure network/firewall rules, including any allowlisting required for future ERP connectivity (coordinate with STORY-070)

- [ ] **Domain/DNS/SSL:**
  - [ ] Confirm domain registrar access and DNS zone ownership
  - [ ] Configure DNS records pointing to production hosting
  - [ ] Provision and verify auto-renewing SSL/TLS certificate
  - [ ] Configure HTTPS redirect and canonical domain (www/apex) rules at the edge/CDN layer

- [ ] **CI/CD:**
  - [ ] Extend the existing GitHub Actions pipeline (from STORY-001) with `staging` and `production` deploy jobs, gated by branch/tag and the Section 8 validation suite
  - [ ] Configure GitHub Environments with required reviewers on the `production` environment
  - [ ] Wire production secrets into GitHub Environments/provider secret store; remove any secrets from plaintext config
  - [ ] Add a deploy-tagging step so every production release is traceable to a commit SHA
  - [ ] Add an automated pre-deploy production database backup step to the pipeline

- [ ] **Database:**
  - [ ] Document and implement the `prisma migrate deploy` production migration step as a distinct pipeline stage from the app deploy
  - [ ] Write and rehearse at least one expand/contract-style migration end to end on staging to validate the backward-compatible migration practice
  - [ ] Document the backup/restore procedure and verify a restore has been test-run at least once

- [ ] **Validation:**
  - [ ] Run a full staging deploy through the entire promotion pipeline (develop → staging → production dry run) before the first real production deploy
  - [ ] Rehearse the rollback procedure end to end in staging and record the actual time taken against the documented target

- [ ] **Testing:**
  - [ ] Add/confirm smoke tests that run automatically immediately after a production deploy (health check endpoint, homepage renders, DB connectivity) and can auto-trigger rollback guidance on failure
  - [ ] Verify SSL certificate validity and HTTPS redirect with an automated check in the pipeline

- [ ] **Documentation:**
  - [ ] Document the full deployment runbook (how to deploy, how to promote, how to roll back) in `docs/architecture-decisions.md` or a new `docs/deployment-runbook.md`
  - [ ] Document the hosting provider decision, DNS/SSL configuration, and secret management approach
  - [ ] Update `.env.example` to reflect final production variable list

## Dependencies
- Epic 09 — Quality & Security must be complete (STORY-065 through STORY-068) before production deployment proceeds; the blueprint's Section 9 build order and Section 8 PR gate both require the platform to meet production quality standards before this story's pipeline is exercised for a real launch
- STORY-001 (Project Foundation Setup) — this story extends the CI/CD pipeline established there
- **Open item — blocks Ready status:** Hosting/cloud provider specifics are unconfirmed per `docs/blueprint.md` Section 10. This story cannot move from Draft to Ready until that decision is made and documented (see the Prerequisite Acceptance Criteria above)
- STORY-070 (Monitoring, Training & Go-Live) — depends on this story's infrastructure being live; coordinate on network/firewall requirements for ERP connectivity

## Out of Scope
- Monitoring, alerting, uptime tracking, backups/disaster recovery *operations* (as opposed to the one-time pre-deploy backup step here), production analytics, ERP go-live, and admin training — all covered in STORY-070
- Choice of specific payment gateway, shipping/carrier integrations, and multi-currency scope — separate open items per `docs/blueprint.md` Section 10, not part of infrastructure deployment
- Load/penetration testing (belongs to Epic 09, STORY-065/066)

## References
- `docs/blueprint.md` Section 9 item 10 (Production Launch)
- `docs/blueprint.md` Section 10 (Open Items — hosting/cloud provider specifics unconfirmed)
- `docs/blueprint.md` Section 8 (Development Governance — Git workflow, PR validation gate)
- `docs/stories/01-foundation/STORY-001-project-foundation-setup.md` (existing CI/CD baseline)
