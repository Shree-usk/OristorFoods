"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { AdminPerfectMatchPageHeader } from "@/components/admin/perfect-match/admin-perfect-match-page-header";
import { PerfectMatchPairingsReorderPanel } from "@/components/admin/perfect-match/perfect-match-pairings-reorder-panel";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchPerfectMatchProduct, updatePerfectMatchProduct, type PerfectMatchProductInput } from "@/lib/api/admin-perfect-match-client";

type FormValues = Omit<PerfectMatchProductInput, "productId">;

/** The admin's per-product editorial overlay (kicker, promo description override, default-featured, publish status) plus that product's meal pairings — /admin/perfect-match/products/[id]. */
export function AdminPerfectMatchProductDetailView({ productLinkId }: { productLinkId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin-perfect-match-product", productLinkId];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchPerfectMatchProduct(productLinkId) });
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: { kicker: "", promoDescriptionOverride: "", isDefaultFeatured: false, status: "Draft" },
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    reset({ kicker: data.kicker ?? "", promoDescriptionOverride: data.promoDescriptionOverride ?? "", isDefaultFeatured: data.isDefaultFeatured, status: data.status });
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (form: FormValues) => {
      if (!data) throw new Error("Product not loaded yet.");
      return updatePerfectMatchProduct(productLinkId, { productId: data.productId, ...form });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["admin-perfect-match-products"] });
      setSaved(true);
    },
  });

  function onSubmit(form: FormValues) {
    setSaved(false);
    mutation.mutate(form);
  }

  if (isLoading || !data) return <p className="text-small text-muted-foreground">Loading…</p>;

  const image = data.product.images[0];

  return (
    <div className="max-w-4xl">
      <AdminPerfectMatchPageHeader />

      <div className="mb-6 flex items-center gap-3 rounded-md border border-border p-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- small fixed-size admin preview.
          <img src={image.url} alt={image.altText ?? ""} className="size-14 shrink-0 rounded object-cover" />
        ) : (
          <div className="size-14 shrink-0 rounded bg-muted" />
        )}
        <div className="min-w-0">
          <p className="text-body font-medium text-charcoal">{data.product.name}</p>
          <Link href={`/admin/products/${data.productId}`} className="text-small text-chilli hover:underline">
            Edit the underlying product
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mb-10 grid gap-4">
        <div>
          <Label htmlFor="pm-product-kicker">Kicker</Label>
          <Input id="pm-product-kicker" {...register("kicker")} placeholder="A traditional favourite" />
          <p className="mt-1 text-caption text-charcoal/60">Short editorial label shown above the product name — not the product&apos;s real category.</p>
        </div>
        <div>
          <Label htmlFor="pm-product-promo-description">Promotional description</Label>
          <Textarea id="pm-product-promo-description" {...register("promoDescriptionOverride")} placeholder={data.product.shortDescription ?? "Leave blank to use the product's own short description."} />
          <p className="mt-1 text-caption text-charcoal/60">Optional — leave blank to use the product&apos;s own short description.</p>
        </div>
        <div className="flex items-center justify-between">
          <CheckboxOption label="Default featured product" checked={watch("isDefaultFeatured")} onCheckedChange={(checked) => setValue("isDefaultFeatured", checked)} />
          <div className="flex items-center gap-2">
            <Label htmlFor="pm-product-status">Status</Label>
            <Select value={watch("status")} onValueChange={(value) => value && setValue("status", value as FormValues["status"])}>
              <SelectTrigger id="pm-product-status" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mutation.isError && <p className="text-small text-chilli">{mutation.error instanceof Error ? mutation.error.message : "Failed to save."}</p>}
        {saved && !mutation.isPending && <p className="text-small text-green-700">Saved.</p>}

        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </form>

      <PerfectMatchPairingsReorderPanel productLinkId={productLinkId} />
    </div>
  );
}
