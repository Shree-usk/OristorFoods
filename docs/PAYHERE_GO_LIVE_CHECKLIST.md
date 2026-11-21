# PayHere Go-Live Checklist

This is the activation runbook for the PayHere integration built in
`docs/architecture-decisions.md`'s 2026-11-20 entry. The integration is
**prepared but inactive** everywhere (`PAYMENT_PROVIDER=mock` on local,
staging, and production) until someone deliberately follows this
document. Nothing in here should ever be done automatically or without
the client's explicit, separate go-ahead — this mirrors the same
safeguard the original integration brief asked for.

Read `docs/ORISTOR_VPS_DEPLOYMENT_HANDOVER.md` in full before touching
production. This document only covers what's specific to PayHere.

## 0. What "going live" actually changes

Going live is a **configuration change, not a code deploy** — the
PayHere code already ships inert on `master`. Activating it means:
1. Setting real PayHere credentials in the production `.env`.
2. Flipping `PAYMENT_PROVIDER` from `mock` to `payhere` in that same
   `.env`.
3. Restarting the app so it picks up the new env vars.

No new migration, no new deploy step beyond a normal code deploy if one
happens to be pending. This also means **rollback is just as cheap**:
set `PAYMENT_PROVIDER` back to `mock` and restart (see §6).

## 1. Prerequisites — confirm before starting

- [ ] PayHere merchant account for `oristor.com` is approved and active
      (the brief states this was already true as of 2026-11-20 — confirm
      it's still current, PayHere approvals can lapse).
- [ ] You have the **production** Merchant ID and Merchant Secret from
      PayHere's merchant dashboard (Settings → Domains & Credentials, or
      equivalent — PayHere's own dashboard, not this codebase).
- [ ] You have **sandbox** credentials too, separate from production —
      PayHere issues these from a sandbox account, free, no real money
      moves through it. Never skip straight to production credentials.
- [ ] The server hosting the target environment has a real, publicly
      reachable HTTPS URL — PayHere's `notify_url` must be reachable from
      PayHere's own servers. It cannot be `localhost` or an internal-only
      address.

## 2. Sandbox verification FIRST — do not skip this

This codebase's PayHere implementation has never been exercised against
a real PayHere server (only unit-tested against an independent
reimplementation of PayHere's documented formula — see
`docs/architecture-decisions.md`). Verify it for real, in sandbox, before
any production credential ever gets typed anywhere.

1. On a non-production environment (staging, or a disposable branch
   deploy — never production), set:
   ```
   PAYHERE_ENV=sandbox
   PAYHERE_MERCHANT_ID=<sandbox merchant id>
   PAYHERE_MERCHANT_SECRET=<sandbox merchant secret>
   PAYHERE_RETURN_URL=https://<that environment's domain>/checkout/payment/return
   PAYHERE_CANCEL_URL=https://<that environment's domain>/checkout/payment/cancel
   PAYHERE_NOTIFY_URL=https://<that environment's domain>/api/payments/payhere/notify
   PAYMENT_PROVIDER=payhere
   ```
2. Restart the app, then place a real checkout using PayHere's own
   published sandbox test card numbers (from PayHere's sandbox
   documentation — never a real card).
3. Confirm, end to end:
   - [ ] The onsite popup opens with the correct amount/currency.
   - [ ] A successful sandbox payment flips the `Payment` row to
         `Succeeded` (check via the admin order detail page — it now
         shows the transaction reference, timestamp, and, on failure,
         the reason).
   - [ ] A declined sandbox payment flips to `Failed` with a sensible
         `failureReason`.
   - [ ] Dismissing the popup before paying shows the "Payment was
         cancelled" message and does **not** mark anything Succeeded.
   - [ ] The order is only ever placed after the Payment is genuinely
         `Succeeded` — never on the browser's own say-so.
4. **If anything in step 3 doesn't match**, this is a code bug, not a
   config problem — fix it (and extend the relevant test in
   `tests/unit/payhere-*.test.ts`) before proceeding. Do not patch around
   it with production credentials.
5. Revert that environment back to `PAYMENT_PROVIDER=mock` once sandbox
   verification passes, unless the client specifically wants that
   environment to keep running sandbox mode.

## 3. Production environment variables

Once sandbox verification (§2) has passed, on the **production** server
only:

```
PAYHERE_ENV=live
PAYHERE_MERCHANT_ID=<production merchant id>
PAYHERE_MERCHANT_SECRET=<production merchant secret>
PAYHERE_RETURN_URL=https://oristor.com/checkout/payment/return
PAYHERE_CANCEL_URL=https://oristor.com/checkout/payment/cancel
PAYHERE_NOTIFY_URL=https://oristor.com/api/payments/payhere/notify
```

Set these first, **restart**, and verify the app is still healthy (it
will still be running `PAYMENT_PROVIDER=mock` at this point — these vars
alone don't activate anything). Only once that's confirmed healthy, in a
**separate** step:

```
PAYMENT_PROVIDER=payhere
```

Restart again. This two-step order means a mistake in the PayHere env
vars themselves surfaces before the gateway is actually live, not at the
same moment it goes live.

Secrets discipline: never commit any of these values, never print them
in logs or chat, `chmod 600 .env` as this server's other secrets already
are (see the VPS handover doc). `PAYHERE_MERCHANT_SECRET` must never be
sent to the browser — nothing in this codebase does that today (verify
this is still true if the integration is ever touched again: grep for
`NEXT_PUBLIC_PAYHERE` and confirm it finds nothing).

## 4. PayHere dashboard configuration

Confirm in PayHere's own merchant dashboard (not this codebase):
- [ ] The domain `oristor.com` is registered/approved for this merchant
      account.
- [ ] If PayHere's dashboard has its own notify-URL allowlist or domain
      verification step, `https://oristor.com/api/payments/payhere/notify`
      is added there.

## 5. First live transaction

- [ ] Place one small, real order with a real card, ideally something
      the business can immediately refund/write off.
- [ ] Confirm the notify callback arrives and the `Payment` flips to
      `Succeeded` (check the admin order detail page's transaction
      reference/timestamp).
- [ ] Confirm the order confirmation page and any customer email reflect
      the real paid amount correctly.

## 6. Rollback

If anything is wrong after going live: set `PAYMENT_PROVIDER=mock` on
production and restart. This is safe and instant — no data migration,
no code revert needed. Any `Payment` rows already created under
`provider: "payhere"` are untouched and keep their real history; new
checkouts simply go back through the mock provider until the issue is
fixed.

## 7. Known gaps — read before relying on this in production

- **Refunds are not implemented.** `PayHereProvider.refund()` always
  throws `PaymentRefundNotImplementedError`. PayHere's real Refund API
  needs a separate OAuth application credential pair (an "Application
  ID"/"Application Secret", issued separately from the Merchant
  ID/Secret used for checkout) that nobody has provisioned yet. Until a
  follow-up story implements this, **process any live refund manually
  through PayHere's own merchant dashboard**, then record it in Oristor's
  admin via the existing manual refund-record flow so the two stay in
  sync — do not expect the admin "Refund" action to call PayHere.
- **Chargebacks are not modeled.** A `status_code -3` notify is
  acknowledged (200, so PayHere doesn't retry) but causes no state
  change — `PaymentStatus` has no chargeback value today. If PayHere
  ever sends one, it will not be visible anywhere in this system; check
  PayHere's own dashboard/email notifications for chargebacks until a
  future story adds real support.
- **Never verified against a real PayHere server.** Everything above
  §2 assumes PayHere's live behavior matches its public documentation
  exactly (field names, hash formula, status codes). Sandbox testing
  (§2) is what actually proves this, not the unit tests alone.

## 8. Who approves this

Per the original integration brief: "Do not assume approval to activate
production payments." Every step past §1 of this document requires the
client's explicit, separate instruction at the time — a general
"continue the project" or "merge this PR" does not authorize flipping
`PAYMENT_PROVIDER` to `payhere` anywhere, on any environment with real
credentials.
