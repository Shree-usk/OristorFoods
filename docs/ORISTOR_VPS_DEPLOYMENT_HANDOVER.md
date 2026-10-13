# ORISTOR FOODS — VPS DEPLOYMENT HANDOVER & OPERATING INSTRUCTIONS

## 1. Purpose
This is the deployment handover for Claude Code working on the ORISTOR Foods web project.

Project: OristorFoods
GitHub: https://github.com/Shree-usk/OristorFoods.git
VPS path: /home/oristor/apps/OristorFoods
Linux user: oristor
Initial deployment: staging.oristor.com
Existing production domain: oristor.com — DO NOT change during staging.

GitHub is the source of truth for application code. Do not make uncontrolled manual code changes directly on the VPS.

## 2. VPS
Provider: Hostinger KVM 2
Location: Malaysia
Public IP: 201.18.217.126
OS: Ubuntu 26.04.1 LTS
Kernel: 7.0.0-38-generic
CPU: 2 cores
RAM: ~7.7 GiB
Swap: 4 GiB
Disk: 96 GB

UFW is active. Default incoming DENY; outgoing ALLOW.
Allowed inbound: 22/tcp, 80/tcp, 443/tcp.

Security already implemented:
- Root SSH login disabled.
- Password SSH authentication was intended to be disabled; verify before production.
- SSH key authentication is intended.
- GitHub deploy key is READ-ONLY.
- Do not weaken SSH security or firewall rules without approval.

Nginx is not yet installed.

## 3. Stack
- Next.js 16.2.10
- React 19.2.4
- Node.js v24.21.0
- npm 11.19.0
- TypeScript 5.9.3
- PostgreSQL 18.6
- Prisma 7.8.0
- @prisma/client 7.8.0
- @prisma/adapter-pg
- pg
- pg_trgm 1.6
- vector 0.8.1
- Git 2.53.0

Do not upgrade major dependencies during deployment unless a specific story requires it and the change is reviewed.

## 4. Git state
Repository: git@github.com:Shree-usk/OristorFoods.git
Branch: master
Handover commit: 3a8b7c9
Commit: feat: STORY-074 admin-editable content for About Us & Contact Us (#70)

The VPS uses a GitHub read-only deploy key. Pull from GitHub; do not push application changes from the VPS.

Before deployment/update:
1. Check git status.
2. Confirm branch and intended commit.
3. Fetch/pull intended code.
4. Never overwrite uncommitted VPS work without explicit approval.

## 5. Database
Database: oristorfoods
Application DB user: oristorfoods_app
Host: 127.0.0.1
Port: 5432

DATABASE_URL is stored only in the VPS .env. Never expose it or commit it.

The database was initially empty. The project's 18 Prisma migrations have now been successfully deployed.

Required PostgreSQL extensions are enabled:
- pg_trgm 1.6
- vector 0.8.1

Production/staging database rules:
- Use `npx prisma migrate deploy`.
- DO NOT use `npx prisma db push`.
- DO NOT use `npx prisma migrate reset`.
- Do not drop/reset the database without explicit approval.
- Never manually alter Prisma migration history.

Before Prisma commands, ensure dependencies are installed with `npm ci`.
Use the project's Prisma 7.8.0. Do not let npx download Prisma 8 or another version.

## 6. Environment
A VPS .env exists and is protected with `chmod 600 .env`.

Initial configuration includes:
DATABASE_URL
AUTH_SECRET
ADMIN_AUTH_SECRET
NEXT_PUBLIC_SITE_URL=https://staging.oristor.com
PAYMENT_PROVIDER=mock
MEDIA_STORAGE_PROVIDER=local
NODE_ENV=production

Known environment variables used by the app include:
- ADMIN_AUTH_SECRET
- ADMIN_SEED_EMAIL
- ADMIN_SEED_PASSWORD
- AUTH_SECRET
- DATABASE_POOL_MAX
- DATABASE_URL
- MEDIA_STORAGE_PROVIDER
- NEXT_PUBLIC_SITE_URL
- NEXT_RUNTIME
- NODE_ENV
- OPENAI_API_KEY
- PAYMENT_PROVIDER
- SMTP_FROM
- SMTP_HOST
- SMTP_PASSWORD
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER

Never print or expose secret VALUES. Never commit .env.

## 7. Payment and storage
Current payment: `PAYMENT_PROVIDER=mock`.
No live Stripe, PayHere, WebXPay or other gateway should be introduced during basic deployment.

Current media: `MEDIA_STORAGE_PROVIDER=local`.
No S3/Cloudinary provider has been selected for the current deployment.
Future integrations must use the existing provider abstractions.

## 8. Deployment stage
Database migration is COMPLETE.

Next stages:
1. Verify migration/table state.
2. Run `npx prisma generate` if required.
3. Review seed files before seeding.
4. Do NOT blindly run the full seed.
5. Determine required staging seed data.
6. Run `npm run build`.
7. Run `npm run start` locally on the VPS and verify health.
8. Install/configure Nginx.
9. Configure staging.oristor.com DNS.
10. Obtain HTTPS for staging.oristor.com.
11. Run the app as a persistent service (systemd or approved process manager).
12. Test authentication, admin, products, content, cart, checkout/mock payment and completed stories.
13. Only after staging is stable consider production cutover to oristor.com.

Do NOT change oristor.com during staging.

## 9. Backup strategy — mandatory
Hostinger automatic backup add-on was not purchased to reduce cost. Therefore backups must be implemented separately.

Database:
- Daily automated PostgreSQL logical backup using pg_dump.
- Keep multiple rolling copies.
- At least one copy must be off-server.
- Periodically test restoration.
- Example concept: `pg_dump -Fc oristorfoods > /backup/oristorfoods_TIMESTAMP.dump`
- Exact schedule and remote destination must be finalized before production.

Application code:
- GitHub is source-code truth.

Secrets:
- .env is not stored in GitHub.
- A secure recovery procedure for production secrets is required.

Uploaded media:
- Local media is NOT protected by GitHub.
- Separate media backup is required before production.

VPS configuration such as Nginx, systemd, UFW and backup scripts must be documented/reproducible.

Before production, the system should be rebuildable from GitHub + DB backup + media backup + secure secrets.

## 10. Future amendment / communication flow
USER REQUIREMENT
  ↓
STORY / SPECIFICATION
  ↓
CLAUDE CODE IMPLEMENTATION
  ↓
LOCAL TESTS / UNIT TESTS / E2E
  ↓
GIT COMMIT
  ↓
GITHUB PR / MERGE
  ↓
VPS PULL FROM GITHUB
  ↓
DATABASE MIGRATION IF REQUIRED
  ↓
BUILD
  ↓
STAGING DEPLOYMENT
  ↓
USER QA / ACCEPTANCE
  ↓
PRODUCTION RELEASE

Claude Code must not silently change architecture or database design for convenience.

For database changes:
1. Modify Prisma schema.
2. Create a proper migration.
3. Test it.
4. Commit schema + migration together.
5. Deploy with `npx prisma migrate deploy`.

For application changes:
1. Implement through existing architecture.
2. Run appropriate tests.
3. Build successfully.
4. Commit.
5. Merge to GitHub.
6. Deploy the merged commit to staging.

For every amendment, communicate:
- What changed
- Related Story/requirement
- Whether DB schema changed
- Whether migration is required
- Whether env variables changed
- Whether external integrations changed
- Tests run
- Deployment commands
- Rollback possibility
- Whether a backup is required before deployment

## 11. Deployment safety
Before production-impacting work:
1. Confirm Git commit.
2. Confirm expected git status.
3. Confirm backup status if schema/data changes are involved.
4. Review migration SQL.
5. Never use destructive DB commands without approval.
6. Never expose secrets.
7. Never modify oristor.com during staging.
8. Prefer reversible changes.
9. Keep deployment steps documented.
10. Verify application health after deployment.

If deployment fails:
- Do not reset the database.
- Capture logs/errors.
- Identify application/dependency/database/env/Nginx/SSL/DNS/service cause.
- Preserve logs.
- Roll back code if appropriate.
- Never destroy data to make deployment pass.

## 12. Current SSH note
The current laptop previously attempted:
`C:\Users\ushreekumar\.ssh\oristor-vps`
which was not the correct key path.

The working laptop key was created under:
`C:\Users\ushreekumar\OneDrive - Humanetics\USK\oristor-vps-laptop`

Restore/fix passwordless SSH before relying on it. Do not weaken SSH security.

## 13. Immediate Claude Code checks
Start by checking, NOT changing:
1. git status
2. git branch
3. git log -1
4. node -v
5. npm -v
6. npm ls prisma
7. npx prisma --version
8. PostgreSQL connection
9. Prisma migration status
10. .env variable NAMES only (never values)
11. package.json scripts
12. whether Prisma client generation is required
13. whether the app builds

Then continue the staging deployment plan.

Do not install Nginx, configure DNS, or expose the app publicly until build and local runtime are verified.

## 14. Project continuity
This file does not replace architecture documentation, blueprint, Stories, Prisma schema, migrations, tests, or Git history.

Relevant architecture documentation:
`docs/architecture-decisions.md`

Claude Code must read relevant project documentation before substantial changes. Existing architecture decisions and completed Stories are authoritative. If a new requirement conflicts with an existing architecture decision, flag the conflict before implementation.

## 15. Core principle
GitHub = source code truth
Prisma migrations = database schema history
PostgreSQL = application data
.env = secrets/configuration
Backup system = disaster recovery
Staging = validation
Production = controlled release

Never trade security, data integrity, or recoverability for deployment speed.
