"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminCouponsPanel } from "@/components/admin/marketing/admin-coupons-panel";
import { AdminPromotionsPanel } from "@/components/admin/marketing/admin-promotions-panel";

/** STORY-050b. Coupon & Promotion management — reads/writes the same models STORY-029 defines and discount.service.ts already reads live at checkout. */
export function AdminCouponsView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Coupons & Promotions</h1>
      <p className="mt-1 text-small text-charcoal/70">Coupons are redeemed by code; promotions apply automatically to matching carts.</p>

      <Tabs defaultValue="coupons" className="mt-6">
        <TabsList>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
        </TabsList>

        <TabsContent value="coupons">
          <AdminCouponsPanel />
        </TabsContent>
        <TabsContent value="promotions">
          <AdminPromotionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
