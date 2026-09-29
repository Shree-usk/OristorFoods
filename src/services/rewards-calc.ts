/**
 * Points-redemption calculation (STORY-030) — pure, no DB, no implicit
 * Date.now(). Mirrors discount.service.ts's pure calculateDiscount()
 * separated from its DB-reading orchestrator.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface PointsRedemptionCalcInput {
  pointsRequested: number;
  spendableBalance: number;
  /** RewardSetting.pointsToCurrencyRate — null means redemption is disabled entirely. */
  pointsToCurrencyRate: number | null;
  /** RewardSetting.maxRedeemablePointsPerOrder — null means no separate cap (balance is the only bound). */
  maxRedeemablePointsPerOrder: number | null;
  /** subtotal - couponPromoDiscount + deliveryCharge — the amount actually owed before points. */
  payableBeforePoints: number;
}

export interface PointsRedemptionCalcResult {
  pointsToRedeem: number;
  discountValue: number;
}

export function calculatePointsRedemption(input: PointsRedemptionCalcInput): PointsRedemptionCalcResult {
  const { pointsRequested, spendableBalance, pointsToCurrencyRate, maxRedeemablePointsPerOrder, payableBeforePoints } = input;

  if (pointsToCurrencyRate === null || pointsToCurrencyRate <= 0) return { pointsToRedeem: 0, discountValue: 0 };
  if (!Number.isFinite(pointsRequested) || pointsRequested <= 0) return { pointsToRedeem: 0, discountValue: 0 };
  if (payableBeforePoints <= 0) return { pointsToRedeem: 0, discountValue: 0 };

  const balanceCap = Math.max(0, Math.floor(spendableBalance));
  const orderCap = maxRedeemablePointsPerOrder !== null ? Math.max(0, maxRedeemablePointsPerOrder) : Infinity;
  // A point can never be worth redeeming past what's actually owed — cap
  // by the whole-point amount whose currency value doesn't exceed the
  // payable total, so the resulting discount can never drive the order
  // total negative.
  const payableCap = Math.floor(payableBeforePoints / pointsToCurrencyRate);

  const pointsToRedeem = Math.min(Math.floor(pointsRequested), balanceCap, orderCap, payableCap);
  if (pointsToRedeem <= 0) return { pointsToRedeem: 0, discountValue: 0 };

  return { pointsToRedeem, discountValue: round2(pointsToRedeem * pointsToCurrencyRate) };
}
