# STORY-070: Monitoring, Training & Go-Live

**Status:** Draft
**Epic:** 10 — Production Launch
**Priority:** High
**Persona(s):** DevOps/Engineering Team, Oristor Business Team, New Admin Console User (Content Editor, Marketing Manager, and other admin roles per `docs/blueprint.md` Section 7)

## User Story
As the DevOps/engineering team, I want monitoring, alerting, automated backups, and disaster recovery in place before go-live, so that the platform meets its 99.9% availability target and incidents are caught and recoverable rather than discovered by customers.

As the Oristor business team, I want production analytics live and a validated ERP integration point at launch, so that we can measure the platform's business impact from day one and trust that order data reaches operations correctly.

As a new admin console user, I want training materials and onboarding documentation for the admin console, so that I can operate my assigned modules (per my role) without developer involvement from day one.

## Description
This story covers the remainder of Build Order item 10, "Production Launch," in `docs/blueprint.md` Section 9 — monitoring, backups, analytics, ERP integration, training, and documentation — plus the final go-live cutover. It assumes the infrastructure, domain, SSL, and CI/CD pipeline from STORY-069 are already live, and turns that infrastructure into an operationally ready product with humans able to run it day to day.

**ERP integration is scoped as integration-point validation, not a full ERP build.** `docs/blueprint.md` Section 10 lists the specific ERP system as an unconfirmed open item — the spec assumes ERP sync exists (see Section 5's commerce lifecycle: "Order Confirmation → ERP Sync → Warehouse Processing") and the admin console already has an ERP Integration Console module planned (Section 7, STORY-056), but does not name which ERP is being integrated. This story's Acceptance Criteria therefore require the ERP system to be confirmed and its integration contract (sync method, data format, retry/failure behavior) documented as a prerequisite, after which the go-live tasks validate that the confirmed integration point works end to end rather than building against a guessed system.

## Acceptance Criteria

**Prerequisite (must be satisfied before ERP-related AC in this story can close):**
- [ ] ERP system is confirmed by Oristor stakeholders and documented in `docs/architecture-decisions.md`, including: system name, integration method (API/file-based/middleware), authentication mechanism, and which entities sync (orders, inventory, customers)

**Monitoring & alerting (targeting 99.9% availability per `docs/blueprint.md` Section 6):**
- [ ] Uptime monitoring is configured against the production domain from an external service, checking the homepage and at least one critical API route (e.g. `/api/health`) at intervals of 5 minutes or less
- [ ] Application performance monitoring (APM) is wired into the production app, capturing error rates, p50/p95/p99 response times, and tracking against the blueprint's <300ms API response target
- [ ] Alerting is configured to notify the engineering team (email/Slack/SMS) within 5 minutes of: uptime check failure, error rate spike above a defined threshold, and API response time breaching the 300ms p95 target
- [ ] A status/uptime dashboard exists showing current and historical availability, tracked against the 99.9% target
- [ ] Server/infrastructure health metrics (CPU, memory, DB connection pool, disk) are monitored with alert thresholds configured
- [ ] An on-call/incident escalation path is documented (who gets paged, in what order, for what severity)

**Backups & disaster recovery:**
- [ ] Automated production database backups run on a defined schedule (at minimum daily, with point-in-time recovery enabled if the provider supports it)
- [ ] Backup retention policy is documented (e.g. 30 daily + 12 monthly) and enforced
- [ ] A disaster recovery runbook exists defining Recovery Time Objective (RTO) and Recovery Point Objective (RPO), and has been tested at least once with a documented restore-from-backup drill
- [ ] Media Library assets (product images, videos per `docs/blueprint.md` Section 7) are backed up or stored in a durable, versioned object store independent of the application server

**Production analytics:**
- [ ] A web analytics platform (e.g. GA4 or equivalent) is integrated in production, tracking the customer journey funnel described in `docs/blueprint.md` Section 4 (Browse → Product View → Cart → Checkout → Purchase)
- [ ] E-commerce event tracking is verified end to end (product view, add to cart, begin checkout, purchase) with at least one live transaction validated in the analytics dashboard
- [ ] Analytics data feeds the admin dashboard's "today's revenue/orders" and related live metrics described in `docs/blueprint.md` Section 7
- [ ] Core Web Vitals monitoring is live in production (per the blueprint's Lighthouse >95 target) with real-user monitoring (RUM), not lab data only

**ERP integration go-live:**
- [ ] The confirmed ERP's order sync integration point is validated end to end in a staging/UAT environment: a test order placed on the storefront successfully reaches the ERP Integration Console's sync queue (STORY-056) and is marked synced
- [ ] Failure/retry behavior is validated: a simulated ERP outage results in the order queuing for retry rather than being lost, and is visible as a "failed" sync job in the ERP Integration Console per `docs/blueprint.md` Section 7
- [ ] ERP sync status is visible on the admin dashboard's live system health / ERP sync status widget (per Section 7's admin dashboard spec)
- [ ] A go/no-go decision on ERP readiness for launch is documented — if the ERP integration is not ready, the go-live checklist explicitly calls this out as a known gap with a fallback (e.g. manual order entry) rather than silently launching without it

**Admin/business-team training:**
- [ ] Role-specific onboarding documentation exists for each admin role active at launch (per `docs/blueprint.md` Section 7's role list: Super Administrator, Administrator, Marketing Manager, Sales Manager, Finance Manager, Production Manager, Warehouse Manager, Customer Support, Export Manager, Content Editor, SEO Specialist, Viewer), covering at minimum the modules relevant to that role
- [ ] At least one live or recorded training session is delivered to Oristor business-team admin users covering core workflows: product CRUD, order management, reviews moderation, and the CMS publish workflow (Draft → Review → Approval → Publish per Section 7)
- [ ] A quick-reference guide or FAQ exists for the most common admin tasks, accessible without developer involvement
- [ ] Training completion/sign-off is tracked for each admin user who will operate the console at launch

**Go-live checklist & cutover:**
- [ ] A written go-live checklist exists covering: final smoke test on production, DNS cutover confirmation, SSL verification, monitoring/alerting live, backups running, analytics verified, ERP go/no-go decision recorded, admin training sign-off complete, rollback plan (from STORY-069) reconfirmed
- [ ] A cutover plan defines the go-live window, who is on call during and immediately after cutover, and the communication plan to stakeholders before/during/after cutover
- [ ] A post-launch monitoring period (e.g. first 48–72 hours) is defined with heightened on-call coverage and a defined checkpoint to formally close out the launch
- [ ] Go-live sign-off is documented, naming who approved production release per the blueprint's Section 8 governance requirement that no undocumented changes are accepted

## Tasks

- [ ] **Infrastructure/Monitoring:**
  - [ ] Select and configure an uptime monitoring service against the production domain and `/api/health` endpoint
  - [ ] Integrate an APM tool into the Next.js production app (server and client-side error/performance tracking)
  - [ ] Configure alert rules and notification channels (Slack/email/SMS) for uptime, error rate, and latency thresholds
  - [ ] Build or configure a status/availability dashboard tracked against the 99.9% target
  - [ ] Document the on-call rotation and incident escalation path

- [ ] **Database/Backups:**
  - [ ] Configure automated production database backup schedule and retention policy
  - [ ] Enable point-in-time recovery if supported by the chosen provider (from STORY-069)
  - [ ] Run and document a disaster recovery restore drill; record actual RTO/RPO achieved against targets
  - [ ] Confirm Media Library assets are stored in durable, versioned object storage with its own backup/versioning

- [ ] **Service/Backend — ERP integration validation:**
  - [ ] Facilitate the ERP system confirmation decision with Oristor stakeholders; document in `docs/architecture-decisions.md`
  - [ ] Coordinate with STORY-069 on network/firewall/allowlist requirements for ERP connectivity
  - [ ] Execute an end-to-end test order through the confirmed ERP's sync integration in staging/UAT; verify it lands in the ERP Integration Console sync queue (STORY-056)
  - [ ] Simulate an ERP outage/failure scenario and verify retry/failed-job behavior in the sync queue
  - [ ] Wire ERP sync status into the admin dashboard system health widget

- [ ] **Frontend — Analytics:**
  - [ ] Integrate the chosen analytics platform (e.g. GA4) with consent/cookie handling appropriate for target markets
  - [ ] Instrument e-commerce funnel events (product view, add to cart, begin checkout, purchase) and verify with a live test transaction
  - [ ] Wire Core Web Vitals RUM reporting into the analytics/monitoring stack
  - [ ] Connect analytics data feeds into the admin dashboard's live metrics (revenue, orders, visitors) per Section 7

- [ ] **Validation:**
  - [ ] Run the full go-live checklist against staging as a dry run before the real cutover
  - [ ] Confirm rollback plan from STORY-069 is current and re-confirmed as part of the checklist

- [ ] **Testing:**
  - [ ] Add automated post-deploy smoke tests verifying monitoring/alerting endpoints and analytics tracking snippet are present in production HTML
  - [ ] Verify alert notifications actually fire by triggering a controlled test failure (e.g. temporarily point the uptime check at a 503) before go-live

- [ ] **Documentation:**
  - [ ] Write role-specific admin onboarding guides for each active role, stored alongside admin console documentation
  - [ ] Produce or record training session material covering product CRUD, order management, reviews moderation, and CMS publish workflow
  - [ ] Write the go-live checklist and cutover plan documents
  - [ ] Document the incident/on-call escalation path and disaster recovery runbook
  - [ ] Record go-live sign-off with approver names and date

## Dependencies
- STORY-069 (Deployment & Infrastructure Launch) — this story requires live production infrastructure, domain, SSL, and CI/CD pipeline before monitoring, backups, and go-live can be configured
- Epic 09 — Quality & Security must be complete (STORY-065 through STORY-068) before go-live proceeds; the blueprint's Section 9 build order requires production quality standards to be met first, and go-live cannot responsibly launch a platform that has not passed security/performance/accessibility validation
- STORY-056 (ERP Integration Console) — the admin-facing sync queue and retry monitoring this story validates against must exist
- STORY-039 (Admin Dashboard) — this story wires live metrics (revenue, orders, ERP sync status) into the dashboard built there
- **Open item — blocks Ready status:** The specific ERP system is unconfirmed per `docs/blueprint.md` Section 10. This story cannot move from Draft to Ready until the ERP system is confirmed and its integration contract documented (see the Prerequisite Acceptance Criteria above). Hosting/cloud provider specifics (also unconfirmed per Section 10) are STORY-069's blocker but affect this story's monitoring/backup tooling choices as well

## Out of Scope
- Building a new ERP system or a from-scratch ERP integration beyond validating the confirmed system's sync contract (full ERP integration engineering, if needed beyond the existing ERP Integration Console, is a separate future story once the ERP system is confirmed)
- Domain, SSL, CI/CD pipeline, and database migration strategy (covered in STORY-069)
- AI-driven business insights and demand forecasting (blueprint Section 5 marks these "future")
- Redis caching and BullMQ queueing (blueprint marks these "planned/future")

## References
- `docs/blueprint.md` Section 9 item 10 (Production Launch)
- `docs/blueprint.md` Section 10 (Open Items — ERP system unconfirmed, hosting/cloud provider specifics unconfirmed)
- `docs/blueprint.md` Section 6 (Non-Functional Principles — 99.9% availability, <300ms API response, Lighthouse >95)
- `docs/blueprint.md` Section 7 (Admin Console — role list, admin dashboard live metrics, ERP Integration Console, CMS workflow)
- `docs/blueprint.md` Section 5 (Commerce lifecycle — Order Confirmation → ERP Sync → Warehouse Processing)
- `docs/stories/10-production-launch/STORY-069-deployment-infrastructure-launch.md`
