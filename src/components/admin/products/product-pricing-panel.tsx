"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchAdminProduct,
  removeCampaignPrice,
  removeSalePrice,
  removeVolumeDiscountTier,
  setCustomerGroupPrice,
  setStandardPrice,
  upsertCampaignPrice,
  upsertSalePrice,
  upsertVolumeDiscountTier,
} from "@/lib/api/admin-product-client";

const CUSTOMER_GROUPS = ["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"] as const;

function toDateInputValue(date: string): string {
  return date.slice(0, 10);
}

/**
 * STORY-040. Fetches its own product detail (rather than relying on the
 * parent form's copy) so each pricing mutation can invalidate and refetch
 * independently of the main product save — pricing rows are their own
 * entities, edited one at a time, not part of the tabbed form's single
 * submit.
 */
export function ProductPricingPanel({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const { data: product, isLoading } = useQuery({ queryKey: ["admin-product", productId], queryFn: () => fetchAdminProduct(productId) });

  const [standardPrice, setStandardPriceInput] = useState("");
  const [standardCurrency, setStandardCurrency] = useState("LKR");

  const [saleForm, setSaleForm] = useState({ price: "", currency: "LKR", startDate: "", endDate: "" });
  const [campaignForm, setCampaignForm] = useState({ campaignId: "", price: "", currency: "LKR", startDate: "", endDate: "" });
  const [groupPriceInputs, setGroupPriceInputs] = useState<Record<string, string>>({});
  const [tierForm, setTierForm] = useState({ minQuantity: "", discountPrice: "", discountPercent: "", currency: "LKR" });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-product", productId] });
  }

  if (isLoading || !product) return <p className="text-body text-charcoal/70">Loading pricing…</p>;

  const latestStandard = product.standardPrices[0];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-h4 font-heading text-charcoal">Standard price</h2>
        <p className="text-small text-charcoal/70">
          {latestStandard ? `Current: ${latestStandard.currency} ${latestStandard.price}` : "No standard price set."}
        </p>
        <div className="mt-2 flex items-end gap-2">
          <div>
            <Label htmlFor="standard-price">New price</Label>
            <Input id="standard-price" type="number" step="0.01" value={standardPrice} onChange={(event) => setStandardPriceInput(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="standard-currency">Currency</Label>
            <Input id="standard-currency" value={standardCurrency} onChange={(event) => setStandardCurrency(event.target.value)} className="w-20" />
          </div>
          <Button
            type="button"
            onClick={async () => {
              await setStandardPrice(productId, Number(standardPrice), standardCurrency);
              setStandardPriceInput("");
              invalidate();
            }}
            disabled={!standardPrice}
          >
            Set price
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-h4 font-heading text-charcoal">Sale prices</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {product.salePrices.map((sale: { id: string; price: string; currency: string; startDate: string; endDate: string }) => (
            <li key={sale.id} className="flex items-center gap-2 text-small text-charcoal/70">
              {sale.currency} {sale.price} · {toDateInputValue(sale.startDate)} → {toDateInputValue(sale.endDate)}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await removeSalePrice(productId, sale.id);
                  invalidate();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="sale-price">Price</Label>
            <Input id="sale-price" type="number" step="0.01" value={saleForm.price} onChange={(event) => setSaleForm({ ...saleForm, price: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="sale-start">Start</Label>
            <Input id="sale-start" type="date" value={saleForm.startDate} onChange={(event) => setSaleForm({ ...saleForm, startDate: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="sale-end">End</Label>
            <Input id="sale-end" type="date" value={saleForm.endDate} onChange={(event) => setSaleForm({ ...saleForm, endDate: event.target.value })} />
          </div>
          <Button
            type="button"
            onClick={async () => {
              await upsertSalePrice(productId, { price: Number(saleForm.price), currency: saleForm.currency, startDate: saleForm.startDate, endDate: saleForm.endDate });
              setSaleForm({ price: "", currency: "LKR", startDate: "", endDate: "" });
              invalidate();
            }}
            disabled={!saleForm.price || !saleForm.startDate || !saleForm.endDate}
          >
            Add sale price
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-h4 font-heading text-charcoal">Campaign prices</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {product.campaignPrices.map((campaign: { id: string; campaignId: string; price: string; currency: string; startDate: string; endDate: string }) => (
            <li key={campaign.id} className="flex items-center gap-2 text-small text-charcoal/70">
              {campaign.campaignId}: {campaign.currency} {campaign.price} · {toDateInputValue(campaign.startDate)} → {toDateInputValue(campaign.endDate)}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await removeCampaignPrice(productId, campaign.id);
                  invalidate();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="campaign-id">Campaign</Label>
            <Input id="campaign-id" value={campaignForm.campaignId} onChange={(event) => setCampaignForm({ ...campaignForm, campaignId: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="campaign-price">Price</Label>
            <Input id="campaign-price" type="number" step="0.01" value={campaignForm.price} onChange={(event) => setCampaignForm({ ...campaignForm, price: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="campaign-start">Start</Label>
            <Input id="campaign-start" type="date" value={campaignForm.startDate} onChange={(event) => setCampaignForm({ ...campaignForm, startDate: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="campaign-end">End</Label>
            <Input id="campaign-end" type="date" value={campaignForm.endDate} onChange={(event) => setCampaignForm({ ...campaignForm, endDate: event.target.value })} />
          </div>
          <Button
            type="button"
            onClick={async () => {
              await upsertCampaignPrice(productId, {
                campaignId: campaignForm.campaignId,
                price: Number(campaignForm.price),
                currency: campaignForm.currency,
                startDate: campaignForm.startDate,
                endDate: campaignForm.endDate,
              });
              setCampaignForm({ campaignId: "", price: "", currency: "LKR", startDate: "", endDate: "" });
              invalidate();
            }}
            disabled={!campaignForm.campaignId || !campaignForm.price || !campaignForm.startDate || !campaignForm.endDate}
          >
            Add campaign price
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-h4 font-heading text-charcoal">Customer group prices</h2>
        <p className="text-small text-charcoal/70">Covers wholesale, distributor, export, and private-label pricing.</p>
        <div className="mt-2 flex flex-col gap-2">
          {CUSTOMER_GROUPS.map((group) => {
            const existing = product.customerGroupPrices.find((row: { customerGroup: string }) => row.customerGroup === group);
            return (
              <div key={group} className="flex items-center gap-2">
                <span className="w-32 text-small text-charcoal">{group}</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={existing ? `${existing.currency} ${existing.price}` : "Not set"}
                  value={groupPriceInputs[group] ?? ""}
                  onChange={(event) => setGroupPriceInputs({ ...groupPriceInputs, [group]: event.target.value })}
                  className="w-32"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    await setCustomerGroupPrice(productId, group, Number(groupPriceInputs[group]), "LKR");
                    setGroupPriceInputs({ ...groupPriceInputs, [group]: "" });
                    invalidate();
                  }}
                  disabled={!groupPriceInputs[group]}
                >
                  Save
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-h4 font-heading text-charcoal">Volume discount tiers</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {product.volumeDiscountTiers.map((tier: { id: string; minQuantity: number; discountPrice: string | null; discountPercent: string | null; currency: string }) => (
            <li key={tier.id} className="flex items-center gap-2 text-small text-charcoal/70">
              {tier.minQuantity}+ units: {tier.discountPrice ? `${tier.currency} ${tier.discountPrice}` : `${tier.discountPercent}% off`}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await removeVolumeDiscountTier(productId, tier.id);
                  invalidate();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="tier-min-qty">Min quantity</Label>
            <Input id="tier-min-qty" type="number" value={tierForm.minQuantity} onChange={(event) => setTierForm({ ...tierForm, minQuantity: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="tier-discount-price">Discount price</Label>
            <Input id="tier-discount-price" type="number" step="0.01" value={tierForm.discountPrice} onChange={(event) => setTierForm({ ...tierForm, discountPrice: event.target.value, discountPercent: "" })} />
          </div>
          <div>
            <Label htmlFor="tier-discount-percent">Or discount %</Label>
            <Input id="tier-discount-percent" type="number" step="0.01" value={tierForm.discountPercent} onChange={(event) => setTierForm({ ...tierForm, discountPercent: event.target.value, discountPrice: "" })} />
          </div>
          <Button
            type="button"
            onClick={async () => {
              await upsertVolumeDiscountTier(productId, {
                minQuantity: Number(tierForm.minQuantity),
                discountPrice: tierForm.discountPrice ? Number(tierForm.discountPrice) : undefined,
                discountPercent: tierForm.discountPercent ? Number(tierForm.discountPercent) : undefined,
                currency: tierForm.currency,
              });
              setTierForm({ minQuantity: "", discountPrice: "", discountPercent: "", currency: "LKR" });
              invalidate();
            }}
            disabled={!tierForm.minQuantity || (!tierForm.discountPrice && !tierForm.discountPercent)}
          >
            Add tier
          </Button>
        </div>
      </section>
    </div>
  );
}
