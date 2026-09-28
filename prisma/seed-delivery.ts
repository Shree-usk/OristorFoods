import { prisma } from "../src/lib/db";

/**
 * Delivery-zone configuration seed (STORY-025/027). One zone per rate
 * model so every calculation path is demoable, plus an active campaign
 * override and the global free-shipping threshold. The admin CRUD that
 * manages this data in production is STORY-055.
 */
export async function seedDelivery() {
  await prisma.shippingSetting.create({
    data: { id: "global", freeShippingThreshold: "7500.00" },
  });

  await prisma.deliveryZone.create({
    data: {
      name: "Colombo Metro",
      cities: ["Colombo", "Dehiwala", "Mount Lavinia", "Sri Jayawardenepura Kotte"],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });

  await prisma.deliveryZone.create({
    data: {
      name: "Hill Country",
      cities: ["Kandy", "Peradeniya", "Nuwara Eliya"],
      rate: {
        create: {
          rateType: "ValueBased",
          tiers: [
            { upTo: 2500, amount: "550.00" },
            { upTo: 7500, amount: "450.00" },
            { upTo: 25000, amount: "350.00" },
          ],
          estimatedDaysMin: 2,
          estimatedDaysMax: 4,
        },
      },
    },
  });

  await prisma.deliveryZone.create({
    data: {
      name: "Southern Coast",
      cities: ["Galle", "Matara", "Hikkaduwa"],
      rate: {
        create: {
          rateType: "WeightBased",
          tiers: [
            { upTo: 1000, amount: "400.00" },
            { upTo: 5000, amount: "700.00" },
            { upTo: 20000, amount: "1100.00" },
          ],
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
        },
      },
    },
  });

  // A zone with a currently-active campaign override, to demo/e2e-test the
  // override-beats-base-rate precedence.
  const negombo = await prisma.deliveryZone.create({
    data: {
      name: "Negombo",
      cities: ["Negombo", "Katunayake"],
      rate: { create: { rateType: "Flat", flatAmount: "450.00", estimatedDaysMin: 1, estimatedDaysMax: 3 } },
    },
  });
  const now = new Date();
  await prisma.deliveryRateOverride.create({
    data: {
      zoneId: negombo.id,
      campaignName: "Coastal Delivery Deal",
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      freeShipping: false,
      overrideAmount: "199.00",
    },
  });

  return { zones: 4, overrides: 1, freeShippingThreshold: 7500 };
}
