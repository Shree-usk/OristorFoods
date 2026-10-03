"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettingsPanel } from "./company-settings-panel";
import { CurrencySettingsPanel } from "./currency-settings-panel";
import { FeatureFlagsPanel } from "./feature-flags-panel";
import { LocaleSettingsPanel } from "./locale-settings-panel";
import { NotificationTemplatesPanel } from "./notification-templates-panel";
import { PaymentMethodsPanel } from "./payment-methods-panel";
import { ShippingInventorySettingsPanel } from "./shipping-inventory-settings-panel";
import { TaxSettingsPanel } from "./tax-settings-panel";

/**
 * STORY-054. Each tab is a small, self-contained panel (own fetch+save
 * cycle), mirroring admin-recipe-form.tsx's multi-tab layout. Rewards &
 * Referrals has no panel of its own — STORY-049 already built that
 * full editing surface at /admin/rewards-referrals; duplicating it
 * here would contradict this story's own AC wording.
 */
export function AdminSettingsView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">System Settings</h1>

      <Tabs defaultValue="company" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="shipping">Shipping &amp; Inventory</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="rewards-referrals">Rewards &amp; Referrals</TabsTrigger>
          <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanySettingsPanel />
        </TabsContent>
        <TabsContent value="currencies" className="mt-4">
          <CurrencySettingsPanel />
        </TabsContent>
        <TabsContent value="languages" className="mt-4">
          <LocaleSettingsPanel />
        </TabsContent>
        <TabsContent value="taxes" className="mt-4">
          <TaxSettingsPanel />
        </TabsContent>
        <TabsContent value="shipping" className="mt-4">
          <ShippingInventorySettingsPanel />
        </TabsContent>
        <TabsContent value="payment-methods" className="mt-4">
          <PaymentMethodsPanel />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationTemplatesPanel />
        </TabsContent>
        <TabsContent value="rewards-referrals" className="mt-4">
          <div className="max-w-md rounded-md border border-border p-4">
            <p className="text-small font-medium text-charcoal">Rewards &amp; Referrals</p>
            <p className="mt-1 text-small text-muted-foreground">
              Point rules, tiers, badges, and referral defaults have their own full console.
            </p>
            <Button className="mt-3" variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/rewards-referrals" />}>
              Open Rewards &amp; Referrals
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="feature-flags" className="mt-4">
          <FeatureFlagsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
