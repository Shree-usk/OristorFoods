// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { addItem, getCart, mergeGuestCartIntoUser } from "@/services/cart.service";
import {
  CouponAlreadyAppliedError,
  CouponExpiredError,
  CouponInactiveError,
  CouponMinOrderValueNotMetError,
  CouponNotFoundError,
  CouponNotYetActiveError,
  CouponScopeNotMetError,
  CouponUsageLimitExceededError,
  CouponCustomerLimitExceededError,
} from "@/services/coupon.errors";
import { applyCouponToCart, removeCouponFromCart, validateCoupon } from "@/services/coupon.service";
import { createProduct } from "@/repositories/product.repository";
import { createCategory } from "@/repositories/category.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { createOrder } from "@/services/order.service";
import { InsufficientStockError } from "@/services/order.errors";
import * as couponRepository from "@/repositories/coupon.repository";

const SKU_PREFIX = "CPN-SVC-SKU-";
const CODE_PREFIX = "CPN-SVC-";
let sequence = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

async function makeProduct(price = "1000.00", stockQuantity = 20) {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `cpn-svc-product-${sequence}`,
    name: `Coupon Svc Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function makeCoupon(overrides: Partial<Parameters<typeof prisma.coupon.create>[0]["data"]> = {}) {
  sequence += 1;
  return prisma.coupon.create({
    data: {
      code: `${CODE_PREFIX}${sequence}`,
      discountType: "PercentageOff",
      percentOff: "10",
      startDate: new Date(Date.now() - DAY_MS),
      endDate: new Date(Date.now() + DAY_MS),
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.couponRedemption.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_cpn-svc-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.couponScopeProduct.deleteMany();
  await prisma.couponScopeCategory.deleteMany();
  await prisma.coupon.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: "cpn-svc-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cpn-svc-" } } });
});

describe("applyCouponToCart", () => {
  it("applies a valid coupon and the cart summary reflects the discount", async () => {
    const product = await makeProduct("1000.00");
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon();

    const { summary } = await applyCouponToCart(null, newCookieValue!, coupon.code);
    expect(summary.couponCode).toBe(coupon.code);
    expect(summary.discount).toMatchObject({ amount: 100 });

    const reread = await getCart(null, newCookieValue!);
    expect(reread.couponCode).toBe(coupon.code);
    expect(reread.discount?.amount).toBe(100);
  });

  it("rejects an unknown code", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    await expect(applyCouponToCart(null, newCookieValue!, "DOES-NOT-EXIST")).rejects.toBeInstanceOf(CouponNotFoundError);
  });

  it("rejects an expired coupon", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ startDate: new Date(Date.now() - 2 * DAY_MS), endDate: new Date(Date.now() - DAY_MS) });
    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponExpiredError);
  });

  it("rejects a not-yet-active coupon", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ startDate: new Date(Date.now() + DAY_MS), endDate: new Date(Date.now() + 2 * DAY_MS) });
    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponNotYetActiveError);
  });

  it("rejects an admin-deactivated coupon", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ isActive: false });
    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponInactiveError);
  });

  it("rejects once the global usage limit is exhausted", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ usageLimitGlobal: 1 });

    // Simulate one prior redemption directly (order creation is exercised in its own test below).
    const cart = await prisma.cart.findFirstOrThrow({ where: { items: { some: { productId: product.id } } } });
    const otherOrder = await prisma.order.create({
      data: {
        orderNumber: `ORS-CPN-SVC-${sequence}`,
        idempotencyKey: `cpn-svc-idem-${sequence}`,
        status: "Confirmed",
        subtotal: "1000.00",
        deliveryCharge: "0.00",
        grandTotal: "900.00",
        deliveryZoneName: "Western",
        shipRecipientName: "x",
        shipPhone: "x",
        shipLine1: "x",
        shipCity: "x",
      },
    });
    await prisma.couponRedemption.create({ data: { couponId: coupon.id, orderId: otherOrder.id, discountAmount: "100.00" } });

    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponUsageLimitExceededError);
    void cart;
  });

  it("rejects when the cart subtotal is below the coupon's minimum order value", async () => {
    const product = await makeProduct("50.00");
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ minOrderValue: "1000.00" });

    const error = await applyCouponToCart(null, newCookieValue!, coupon.code).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CouponMinOrderValueNotMetError);
    expect((error as InstanceType<typeof CouponMinOrderValueNotMetError>).shortfall).toBe(950);
  });

  it("rejects when the cart has nothing in the coupon's scope", async () => {
    const category = await createCategory({ name: "CPN SVC Tea", slug: "cpn-svc-tea" });
    const product = await makeProduct(); // not in `category`
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ scope: "Category", scopeCategories: { create: [{ categoryId: category.id }] } });

    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponScopeNotMetError);
  });

  it("rejects re-applying the same code that's already active", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon();
    await applyCouponToCart(null, newCookieValue!, coupon.code);
    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponAlreadyAppliedError);
  });

  it("recalculates live when the cart changes — no re-apply call needed", async () => {
    const product = await makeProduct("500.00");
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ minOrderValue: "1000.00" });

    // Below minimum: rejected at apply time.
    await expect(applyCouponToCart(null, newCookieValue!, coupon.code)).rejects.toBeInstanceOf(CouponMinOrderValueNotMetError);

    // Force-apply directly via the cart's couponId (simulating a coupon that was valid, then the cart shrank) —
    // the read-side silent-skip path should show it contributing nothing, with a specific reason.
    const cart = await prisma.cart.findFirstOrThrow({ where: { guestToken: { not: null } }, orderBy: { createdAt: "desc" } });
    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
    const belowMin = await getCart(null, newCookieValue!);
    expect(belowMin.couponCode).toBe(coupon.code);
    expect(belowMin.couponInvalidReason).toBe("min_order_value_not_met");
    expect(belowMin.discount).toBeNull();

    // Add enough to cross the threshold — same coupon, no re-apply, now contributes.
    await addItem(null, newCookieValue!, product.id, 2); // now 1500 total
    const aboveMin = await getCart(null, newCookieValue!);
    expect(aboveMin.couponInvalidReason).toBeNull();
    expect(aboveMin.discount?.amount).toBeGreaterThan(0);
  });
});

describe("removeCouponFromCart", () => {
  it("clears the applied coupon", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon();
    await applyCouponToCart(null, newCookieValue!, coupon.code);

    const { summary } = await removeCouponFromCart(null, newCookieValue!);
    expect(summary.couponCode).toBeNull();
    expect(summary.discount).toBeNull();
  });
});

describe("validateCoupon — guest per-customer limit (checked only once an email exists)", () => {
  it("throws customer_limit_exceeded when a guest email has already redeemed up to the limit", async () => {
    const product = await makeProduct();
    const coupon = await makeCoupon({ usageLimitPerCustomer: 1 });

    const priorOrder = await prisma.order.create({
      data: {
        orderNumber: `ORS-CPN-SVC-G-${sequence}`,
        idempotencyKey: `cpn-svc-g-idem-${sequence}`,
        guestEmail: "cpn-svc-guest@test.com",
        status: "Confirmed",
        subtotal: "1000.00",
        deliveryCharge: "0.00",
        grandTotal: "900.00",
        deliveryZoneName: "Western",
        shipRecipientName: "x",
        shipPhone: "x",
        shipLine1: "x",
        shipCity: "x",
      },
    });
    await prisma.couponRedemption.create({ data: { couponId: coupon.id, guestEmail: "cpn-svc-guest@test.com", orderId: priorOrder.id, discountAmount: "100.00" } });

    const withScope = await couponRepository.findCouponById(coupon.id);
    await expect(
      validateCoupon(withScope!, [{ productId: product.id, categoryIds: [], lineTotal: 1000 }], 1000, null, "cpn-svc-guest@test.com"),
    ).rejects.toBeInstanceOf(CouponCustomerLimitExceededError);
  });

  it("does not check the per-customer limit when no guest email is known yet", async () => {
    const product = await makeProduct();
    const coupon = await makeCoupon({ usageLimitPerCustomer: 1 });
    // Same setup as above, but validateCoupon is called with guestEmail=null (the apply-time shape) — must NOT throw for the limit.
    const priorOrder = await prisma.order.create({
      data: {
        orderNumber: `ORS-CPN-SVC-G2-${sequence}`,
        idempotencyKey: `cpn-svc-g2-idem-${sequence}`,
        guestEmail: "cpn-svc-guest2@test.com",
        status: "Confirmed",
        subtotal: "1000.00",
        deliveryCharge: "0.00",
        grandTotal: "900.00",
        deliveryZoneName: "Western",
        shipRecipientName: "x",
        shipPhone: "x",
        shipLine1: "x",
        shipCity: "x",
      },
    });
    await prisma.couponRedemption.create({ data: { couponId: coupon.id, guestEmail: "cpn-svc-guest2@test.com", orderId: priorOrder.id, discountAmount: "100.00" } });

    const withScope = await couponRepository.findCouponById(coupon.id);
    await expect(
      validateCoupon(withScope!, [{ productId: product.id, categoryIds: [], lineTotal: 1000 }], 1000, null, null),
    ).resolves.toBeDefined();
  });
});

describe("redemption atomicity", () => {
  function orderInput(
    overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">,
  ): Omit<CreateOrderInput, "orderNumber"> {
    return {
      userId: null,
      guestToken: "cpn-svc-guest-token",
      guestEmail: "guest@test.com",
      subtotal: "1000.00",
      deliveryCharge: "0.00",
      discount: "100.00",
      couponCode: "SAVE10",
      discountLabel: "Coupon SAVE10",
      pointsRedeemed: 0,
      pointsRedemptionValue: "0.00",
      pointsRedemption: null,
      grandTotal: "900.00",
      rewardPointsEarned: 0,
      deliveryZoneName: "Western",
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      shipRecipientName: "Test",
      shipPhone: "+94 77 000 0000",
      shipLine1: "1 Test Rd",
      shipLine2: null,
      shipCity: "Colombo",
      shipDistrict: null,
      shipPostalCode: null,
      couponRedemption: null,
      ...overrides,
    };
  }

  it("records a CouponRedemption row atomically with the order", async () => {
    const product = await makeProduct("1000.00", 10);
    const payment = await prisma.payment.create({ data: { provider: "mock", providerReference: `mock_cpn-svc-${sequence}`, status: "Succeeded", amount: "900.00", currency: "LKR" } });
    const coupon = await makeCoupon();
    const cart = await prisma.cart.create({ data: { guestToken: `cpn-svc-cart-${sequence}` } });

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `cpn-svc-order-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [{ productId: product.id, productName: product.name, productSku: product.sku, unitPrice: "1000.00", quantity: 1, lineTotal: "1000.00", rewardPointsEarned: 0 }],
        couponRedemption: { couponId: coupon.id, discountAmount: "100.00" },
      }),
    );

    const redemptions = await prisma.couponRedemption.findMany({ where: { orderId: order.id } });
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0]).toMatchObject({ couponId: coupon.id, discountAmount: expect.anything() });
  });

  it("leaves zero redemption rows when the order transaction rolls back (insufficient stock)", async () => {
    const scarce = await makeProduct("1000.00", 0);
    const payment = await prisma.payment.create({ data: { provider: "mock", providerReference: `mock_cpn-svc-rb-${sequence}`, status: "Succeeded", amount: "900.00", currency: "LKR" } });
    const coupon = await makeCoupon();
    const cart = await prisma.cart.create({ data: { guestToken: `cpn-svc-cart-rb-${sequence}` } });

    await expect(
      createOrder(
        orderInput({
          idempotencyKey: `cpn-svc-order-rb-${sequence}`,
          paymentId: payment.id,
          cartId: cart.id,
          items: [{ productId: scarce.id, productName: scarce.name, productSku: scarce.sku, unitPrice: "1000.00", quantity: 1, lineTotal: "1000.00", rewardPointsEarned: 0 }],
          couponRedemption: { couponId: coupon.id, discountAmount: "100.00" },
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(0);
  });
});

describe("tier-pricing composition", () => {
  it("discounts the already tier-priced line total, not the standard price", async () => {
    const product = await makeProduct("1000.00");
    await prisma.customerGroupPrice.create({ data: { productId: product.id, customerGroup: "Distributor", price: "800.00" } });
    const user = await prisma.user.create({ data: { email: "cpn-svc-distributor@test.com" } });
    const cart = await prisma.cart.create({ data: { userId: user.id } });
    // resolvePrice() with customerGroup "Retail" is what cart.service.ts's buildSummary actually
    // calls today (STORY-009's Wholesale-account plumbing lands separately) — this test proves the
    // COMPOSITION rule (discount computed against whatever lineTotal buildSummary already resolved,
    // tier-priced or not) rather than re-deriving pricing tiers itself.
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1, unitPriceSnapshot: "800.00" } });

    const coupon = await makeCoupon({ discountType: "PercentageOff", percentOff: "10" });
    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });

    const summary = await getCart(user.id, undefined);
    // 10% of the resolved (tier-priced or snapshot) line total, not 10% of a hardcoded retail figure.
    expect(summary.discount?.amount).toBeCloseTo(summary.subtotal * 0.1, 2);
  });
});

describe("cart merge drops the coupon", () => {
  it("a coupon applied to a guest cart is not carried over on merge", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon();
    await applyCouponToCart(null, newCookieValue!, coupon.code);

    const user = await prisma.user.create({ data: { email: "cpn-svc-merge@test.com" } });
    await mergeGuestCartIntoUser(user.id, newCookieValue!);

    const merged = await getCart(user.id, undefined);
    expect(merged.couponCode).toBeNull();
  });
});
