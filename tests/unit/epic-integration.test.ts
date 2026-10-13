// tests/unit/epic-integration.test.ts
// @vitest-environment node
//
// Story 5 of 5: the integration pass. Stories 1-4 each shipped with their
// own isolated unit tests — this file is the one place a SINGLE cart/order
// combines all four features at once (a variant line, a bundle instance,
// a custom-packaged line, and a restricted payment method), the way a real
// customer's cart could. Covers the brief's acceptance scenarios end to
// end rather than per-feature, with a particular focus on scenario 12
// (historical snapshots survive later changes to the underlying product/
// packaging/bundle configuration).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBundle, createBundleItem } from "@/repositories/bundle.repository";
import { createProduct } from "@/repositories/product.repository";
import { addBundleToCart } from "@/services/bundle.service";
import { addItem } from "@/services/cart.service";
import { PaymentMethodNotAllowedError } from "@/services/checkout.errors";
import { createIntentForCart, listEligiblePaymentMethods, placeOrder } from "@/services/checkout.service";
import { confirmPayment } from "@/services/payment.service";
import type { PlaceOrderInput } from "@/validation/checkout.schema";

let sequence = 0;
const SKU_PREFIX = "EPIC-INT-SKU-";

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `epic-int-product-${sequence}`,
    name: `Epic Integration Product ${sequence}`,
    status: "Published",
    stockQuantity: 20,
    weightGrams: 100,
    ...overrides,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "400.00" } });
  return product;
}

async function makeVariantProduct() {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}variant-parent-${sequence}`,
    slug: `epic-int-variant-parent-${sequence}`,
    name: `Epic Integration Variant Product ${sequence}`,
    status: "Published",
    weightGrams: 100,
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `${SKU_PREFIX}variant-${sequence}`,
      name: "250g",
      netWeightGrams: 250,
      price: "600.00",
      currency: "LKR",
      stockQuantity: 20,
      isActive: true,
      inStock: true,
    },
  });
  return { product, variant };
}

async function makeFixedBundle(components: { product: { id: string }; quantity: number }[]) {
  sequence += 1;
  const bundleProduct = await createProduct({
    sku: `${SKU_PREFIX}bundle-${sequence}`,
    slug: `epic-int-bundle-${sequence}`,
    name: `Epic Integration Bundle ${sequence}`,
    status: "Published",
    productType: "Bundle",
  });
  const bundle = await createBundle({ product: { connect: { id: bundleProduct.id } }, bundleType: "Fixed", name: "Epic Integration Fixed Bundle", stockMode: "Derived" });
  for (const component of components) {
    await createBundleItem({ bundle: { connect: { id: bundle.id } }, componentProduct: { connect: { id: component.product.id } }, quantity: component.quantity });
  }
  return bundle;
}

async function makePackagingOption(productId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const method = await prisma.packagingMethod.create({ data: { name: `Epic Integration Packaging Method ${sequence}` } });
  return prisma.productPackagingOption.create({ data: { productId, packagingMethodId: method.id, charge: "75.00", leadTimeDays: 3, shelfLifeDays: 30, ...overrides } });
}

async function makeZone() {
  return prisma.deliveryZone.create({
    data: { name: "Western", cities: ["Colombo"], rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } } },
  });
}

async function seedPaymentMethods() {
  await prisma.paymentMethodSetting.createMany({
    data: [
      { key: "card", label: "Card", enabled: true, sortOrder: 0, method: "Card", allowedForRestrictedOrders: true },
      { key: "bank_transfer", label: "Bank Transfer", enabled: true, sortOrder: 1, method: "BankTransfer", allowedForRestrictedOrders: true },
      { key: "cash_on_delivery", label: "Cash on Delivery", enabled: true, sortOrder: 2, method: "CashOnDelivery", allowedForRestrictedOrders: false },
    ],
  });
}

const address: PlaceOrderInput["address"] = {
  recipientName: "Epic Integration Guest",
  phone: "+94 77 123 4567",
  line1: "10 Test Lane",
  city: "Colombo",
};

beforeEach(async () => {
  await seedPaymentMethods();
});

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.deliveryRateOverride.deleteMany();
  await prisma.deliveryRate.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.shippingSetting.deleteMany();
  await prisma.bundleItem.deleteMany();
  await prisma.productBundle.deleteMany();
  await prisma.productPackagingOption.deleteMany({ where: { packagingMethod: { name: { startsWith: "Epic Integration Packaging Method " } } } });
  await prisma.packagingMethod.deleteMany({ where: { name: { startsWith: "Epic Integration Packaging Method " } } });
  await prisma.standardPrice.deleteMany();
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.paymentMethodSetting.deleteMany();
});

describe("Story 5: full epic integration — one cart, all four features together", () => {
  async function buildCombinedCart() {
    await makeZone();
    const { product: variantProduct, variant } = await makeVariantProduct();
    const bundleComponent = await makeProduct();
    const bundle = await makeFixedBundle([{ product: bundleComponent, quantity: 2 }]);
    const packagedProduct = await makeProduct();
    const packagingOption = await makePackagingOption(packagedProduct.id, { requiresManualReview: false });

    // Line 1: a variant-driven product (scenarios 1/2).
    const identity = await addItem(null, undefined, variantProduct.id, 1, variant.id);
    const cookie = identity.newCookieValue!;

    // Line 2+: a Fixed bundle, exploded into its own component row(s) (scenario 3).
    await addBundleToCart(null, cookie, bundle.id, null);

    // Line N: a custom-packaged product (scenarios 6/8).
    await addItem(null, cookie, packagedProduct.id, 1, null, { packagingOptionId: packagingOption.id, declaredAvailability: "Export" });

    return { cookie, variantProduct, variant, bundleComponent, bundle, packagedProduct, packagingOption };
  }

  it("prices every line correctly and restricts payment to card/bank transfer for the combined cart — scenarios 1/3/6/8/9/10", async () => {
    const { cookie, variant, bundleComponent, packagingOption } = await buildCombinedCart();

    const methods = await listEligiblePaymentMethods(null, cookie);
    expect(methods.map((m) => m.method).sort()).toEqual(["BankTransfer", "Card"].sort());

    const summary = await prisma.cartItem.findMany({ where: { cart: { guestToken: { not: null } } }, include: { product: true } });
    expect(summary.length).toBeGreaterThanOrEqual(3); // variant line + bundle component(s) + packaged line

    const variantLine = summary.find((item) => item.variantId === variant.id);
    expect(variantLine?.unitPriceSnapshot.toFixed(2)).toBe("600.00");

    const bundleLine = summary.find((item) => item.bundleInstanceId !== null);
    expect(bundleLine?.productId).toBe(bundleComponent.id);

    const packagedLine = summary.find((item) => item.packagingOptionId === packagingOption.id);
    expect(packagedLine?.packagingChargeSnapshot?.toFixed(2)).toBe("75.00");
  });

  it("CashOnDelivery is rejected for the combined cart even though only ONE of its three lines carries packaging — scenario 10, 11", async () => {
    const { cookie } = await buildCombinedCart();

    await expect(createIntentForCart(null, cookie, "Colombo", "CashOnDelivery")).rejects.toBeInstanceOf(PaymentMethodNotAllowedError);
  });

  it("places the combined order Confirmed via Card, with every feature's fields correctly snapshotted on the order — scenarios 1/3/6/8/9", async () => {
    const { cookie, variant, bundle, bundleComponent, packagingOption } = await buildCombinedCart();

    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      traveler: { travelerName: "Jane Traveler", travelerCountry: "Australia", travelerPhone: "+94771234567" },
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    expect(order.status).toBe("Confirmed");
    expect(order.paymentMethod).toBe("Card");

    const variantItem = order.items.find((item) => item.variantId === variant.id);
    expect(variantItem).toMatchObject({ variantName: "250g" });
    expect(variantItem?.unitPrice.toFixed(2)).toBe("600.00");

    const bundleItems = order.items.filter((item) => item.bundleId === bundle.id);
    expect(bundleItems.length).toBeGreaterThan(0);
    expect(bundleItems.every((item) => item.bundleInstanceId === bundleItems[0].bundleInstanceId)).toBe(true);
    expect(bundleItems[0].productId).toBe(bundleComponent.id);

    const packagedItem = order.items.find((item) => item.packagingOptionId === packagingOption.id);
    expect(packagedItem).toMatchObject({ packagingDeclaredAvailability: "Export", packagingRequiresManualReview: false });
    expect(packagedItem?.packagingCharge?.toFixed(2)).toBe("75.00");

    // Stock decremented for every feature's own line — variant stock,
    // bundle component stock (bundle is Derived, no own counter), and the
    // packaged product's stock — all independently, in the one transaction.
    const variantAfter = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(variantAfter.stockQuantity).toBe(19);
    const componentAfter = await prisma.product.findUniqueOrThrow({ where: { id: bundleComponent.id } });
    expect(componentAfter.stockQuantity).toBe(18); // 20 - (quantity 2 from the bundle)
  });

  it("a manual-review packaging line sends the COMBINED order to PendingConfirmation, and confirming it leaves the Card payment untouched", async () => {
    await makeZone();
    const { product: variantProduct, variant } = await makeVariantProduct();
    const packagedProduct = await makeProduct();
    const packagingOption = await makePackagingOption(packagedProduct.id, { requiresManualReview: true, availability: "Export" });

    const identity = await addItem(null, undefined, variantProduct.id, 1, variant.id);
    const cookie = identity.newCookieValue!;
    await addItem(null, cookie, packagedProduct.id, 1, null, { packagingOptionId: packagingOption.id, declaredAvailability: "Export" });

    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      traveler: { travelerName: "Jane Traveler", travelerCountry: "Australia", travelerPhone: "+94771234567" },
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } });
    expect(order.status).toBe("PendingConfirmation");
    expect(order.paymentMethod).toBe("Card");

    const paymentBefore = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId! } });
    expect(paymentBefore.status).toBe("Succeeded"); // the real mock confirm already succeeded

    // Import lazily to avoid a module-order dependency on the rest of this file's top-level imports.
    const { transitionOrderStatus } = await import("@/services/order.service");
    await transitionOrderStatus(order.id, "Confirmed", "admin:epic-integration-test");

    const paymentAfter = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId! } });
    expect(paymentAfter.status).toBe("Succeeded"); // unchanged — the BankTransfer-only flip never applies to a Card payment
  });

  it("scenario 12: later changes to the variant price, the packaging charge, and the bundle's components never alter the already-placed order's snapshots", async () => {
    const { cookie, variant, bundleComponent, packagedProduct, packagingOption } = await buildCombinedCart();

    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      traveler: { travelerName: "Jane Traveler", travelerCountry: "Australia", travelerPhone: "+94771234567" },
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    const variantItemBefore = orderBefore.items.find((item) => item.variantId === variant.id)!;
    const bundleItemBefore = orderBefore.items.find((item) => item.productId === bundleComponent.id)!;
    const packagedItemBefore = orderBefore.items.find((item) => item.packagingOptionId === packagingOption.id)!;

    // Change everything the order touched, after the fact.
    await prisma.productVariant.update({ where: { id: variant.id }, data: { price: "9999.00" } });
    await prisma.productPackagingOption.update({ where: { id: packagingOption.id }, data: { charge: "500.00" } });
    await prisma.standardPrice.updateMany({ where: { productId: bundleComponent.id }, data: { price: "9999.00" } });
    await prisma.product.update({ where: { id: packagedProduct.id }, data: { name: "Renamed After Order" } });

    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    const variantItemAfter = orderAfter.items.find((item) => item.variantId === variant.id)!;
    const bundleItemAfter = orderAfter.items.find((item) => item.productId === bundleComponent.id)!;
    const packagedItemAfter = orderAfter.items.find((item) => item.packagingOptionId === packagingOption.id)!;

    expect(variantItemAfter.unitPrice.toFixed(2)).toBe(variantItemBefore.unitPrice.toFixed(2));
    expect(bundleItemAfter.unitPrice.toFixed(2)).toBe(bundleItemBefore.unitPrice.toFixed(2));
    expect(packagedItemAfter.packagingCharge?.toFixed(2)).toBe(packagedItemBefore.packagingCharge?.toFixed(2));
    expect(packagedItemAfter.productName).toBe(packagedItemBefore.productName); // "Epic Integration Product N", not "Renamed After Order"
  });

  it("scenario 14: a plain cart with none of the new features still checks out exactly as before — the epic's baseline regression case", async () => {
    await makeZone();
    const product = await makeProduct();
    const identity = await addItem(null, undefined, product.id, 1);
    const cookie = identity.newCookieValue!;

    const methods = await listEligiblePaymentMethods(null, cookie);
    expect(methods.map((m) => m.method).sort()).toEqual(["BankTransfer", "CashOnDelivery", "Card"].sort());

    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } });
    expect(order.status).toBe("Confirmed");
    expect(order.paymentMethod).toBe("Card");
  });
});
