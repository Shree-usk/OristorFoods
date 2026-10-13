import { NextResponse } from "next/server";

import { listEligibleBankAccounts } from "@/services/system-settings.service";

/** Export fulfilment flow. Every active bank account — the customer picks whichever suits them (confirmed scope), no server-side selection. */
export async function GET() {
  const accounts = await listEligibleBankAccounts();
  return NextResponse.json(
    accounts.map((account) => ({
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      branch: account.branch,
      swiftCode: account.swiftCode,
      currency: account.currency,
    })),
  );
}
