// @vitest-environment node
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { getReferralSummary, getReferredFriends } from "@/services/customer-referrals-dashboard.service";

const EMAIL_PREFIX = "rfl-dash-svc-";
let sequence = 0;

async function makeUser(name: string | null = null) {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com`, name } });
}

describe("customer-referrals-dashboard.service", () => {
  describe("getReferredFriends", () => {
    it("maps Registered/Qualified to Signed Up/Reward Earned, masks the email, and filters out Excluded", async () => {
      const referrer = await makeUser();
      const signedUp = await makeUser("Kasun Perera");
      const rewarded = await makeUser("Nadeesha Silva");
      const excluded = await makeUser("Self Referral");

      await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: signedUp.id, status: "Registered" } });
      await prisma.referralAttribution.create({
        data: { referrerUserId: referrer.id, referredUserId: rewarded.id, status: "Qualified", qualifiedAt: new Date() },
      });
      await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: excluded.id, status: "Excluded", excludedReason: "self_referral" } });

      const friends = await getReferredFriends(referrer.id);
      expect(friends).toHaveLength(2);

      const kasun = friends.find((f) => f.displayName === "Kasun Perera");
      expect(kasun?.status).toBe("Signed Up");
      // Masked to first-character + "***@domain" — the seeded email's own first character, not the display name's.
      expect(kasun?.maskedEmail).toBe(`${signedUp.email!.charAt(0)}***@test.com`);

      const nadeesha = friends.find((f) => f.displayName === "Nadeesha Silva");
      expect(nadeesha?.status).toBe("Reward Earned");
      expect(nadeesha?.qualifiedAt).not.toBeNull();

      expect(friends.some((f) => f.displayName === "Self Referral")).toBe(false);
    });

    it("falls back to a generic display name when the referred customer has none", async () => {
      const referrer = await makeUser();
      const referred = await makeUser(null);
      await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });

      const friends = await getReferredFriends(referrer.id);
      expect(friends[0]?.displayName).toBe("A friend");
    });
  });

  describe("getReferralSummary", () => {
    it("sums ReferralBonus minus ReferralBonusReversed for the referrer, not the recipient's own welcome bonus", async () => {
      const referrer = await makeUser();
      await prisma.rewardTransaction.create({ data: { userId: referrer.id, type: "ReferralBonus", points: 100, orderId: null } });
      await prisma.rewardTransaction.create({ data: { userId: referrer.id, type: "ReferralBonus", points: 50, orderId: null } });
      await prisma.rewardTransaction.create({ data: { userId: referrer.id, type: "ReferralBonusReversed", points: -50, orderId: null } });
      // A welcome bonus this same user received as a REFERRED customer elsewhere — must not count toward "rewards earned from referring".
      await prisma.rewardTransaction.create({ data: { userId: referrer.id, type: "ReferralWelcomeBonus", points: 20, orderId: null } });

      const summary = await getReferralSummary(referrer.id);
      expect(summary.totalPointsEarned).toBe(100);
      expect(summary.code).toHaveLength(8);
      expect(summary.link).toContain(`ref=${summary.code}`);
    });
  });
});
