"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminCouponsPanel } from "@/components/admin/marketing/admin-coupons-panel";
import { AdminGiftOffersPanel } from "@/components/admin/marketing/admin-gift-offers-panel";
import { AdminPromotionsPanel } from "@/components/admin/marketing/admin-promotions-panel";

/** STORY-050b. Coupon & Promotion management — reads/writes the same models STORY-029 defines and discount.service.ts already reads live at checkout. Gift Offers (Project Cinnamon Option C) added as a third tab beside Coupons/Promotions — same campaign-entity shape, reads/writes GiftOffer. */
export function AdminCouponsView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Coupons & Promotions</h1>
      <p className="mt-1 text-small text-charcoal/70">Coupons are redeemed by code; promotions apply automatically to matching carts.</p>

      <Tabs defaultValue="coupons" className="mt-6">
        <TabsList>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="gift-offers">Gift Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="coupons">
          <AdminCouponsPanel />
        </TabsContent>
        <TabsContent value="promotions">
          <AdminPromotionsPanel />
        </TabsContent>
        <TabsContent value="gift-offers">
          <AdminGiftOffersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
