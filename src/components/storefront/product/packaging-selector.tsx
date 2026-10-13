"use client";

import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { cn } from "@/lib/utils";
import type { ProductDetailPackagingOption } from "@/services/product.service";

/**
 * `optionId: ""` means "declared, but Standard packaging (no option)
 * selected" — distinct from `null`, which means nothing declared yet.
 */
export interface PackagingSelectionValue {
  optionId: string;
  declaredAvailability: "Local" | "Export";
}

interface PackagingSelectorProps {
  options: ProductDetailPackagingOption[];
  selectedVariantId: string | null;
  currency: string;
  value: PackagingSelectionValue | null;
  onChange: (value: PackagingSelectionValue | null) => void;
  acknowledged: boolean;
  onAcknowledgedChange: (checked: boolean) => void;
}

/** "Both" accepts either declaration; Local/Export must match it exactly. */
function isAvailabilityCompatible(optionAvailability: ProductDetailPackagingOption["availability"], declared: "Local" | "Export"): boolean {
  return optionAvailability === "Both" || optionAvailability === declared;
}

/**
 * Story 3 (Custom Packaging). Renders nothing when this product (filtered
 * to the currently selected variant, if any) has no eligible packaging
 * options — a plain product's PDP is byte-for-byte unchanged. Two steps:
 * a self-declaration (no address/country infrastructure exists on this
 * storefront — see the brief's confirmed scope decision), then the
 * declaration-filtered packaging chips themselves, including an implicit
 * "Standard packaging" chip for "declared, but no special packaging". The
 * PDP always adds a single unit at a time, so a minimum-quantity option is
 * shown but disabled rather than hidden — same "visible but disabled, not
 * hidden" precedent VariantSelector already uses for an out-of-stock size.
 */
export function PackagingSelector({ options, selectedVariantId, currency, value, onChange, acknowledged, onAcknowledgedChange }: PackagingSelectorProps) {
  const eligible = options.filter((option) => option.variantId === null || option.variantId === selectedVariantId);
  if (eligible.length === 0) return null;

  const declared = value?.declaredAvailability ?? null;
  const optionsForDeclaration = declared ? eligible.filter((option) => isAvailabilityCompatible(option.availability, declared)) : [];
  const selectedOption = value?.optionId ? eligible.find((option) => option.id === value.optionId) ?? null : null;

  function declare(declaredAvailability: "Local" | "Export") {
    onAcknowledgedChange(false);
    onChange(declared === declaredAvailability ? null : { optionId: "", declaredAvailability });
  }

  function selectOption(optionId: string) {
    if (!declared) return;
    onAcknowledgedChange(false);
    onChange({ optionId, declaredAvailability: declared });
  }

  return (
    <div className="mt-4">
      <p className="text-small font-medium text-charcoal">Packaging</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={declared === "Local"}
          onClick={() => declare("Local")}
          className={cn(
            "rounded-md border px-3 py-2 text-small transition-colors",
            declared === "Local" ? "border-chilli bg-chilli/10 text-chilli" : "border-input text-charcoal hover:border-charcoal/40",
          )}
        >
          For home use locally
        </button>
        <button
          type="button"
          aria-pressed={declared === "Export"}
          onClick={() => declare("Export")}
          className={cn(
            "rounded-md border px-3 py-2 text-small transition-colors",
            declared === "Export" ? "border-chilli bg-chilli/10 text-chilli" : "border-input text-charcoal hover:border-charcoal/40",
          )}
        >
          I&apos;m taking this abroad
        </button>
      </div>

      {declared && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={value?.optionId === ""}
            onClick={() => selectOption("")}
            className={cn(
              "rounded-md border px-3 py-2 text-small transition-colors",
              value?.optionId === "" ? "border-chilli bg-chilli/10 text-chilli" : "border-input text-charcoal hover:border-charcoal/40",
            )}
          >
            Standard packaging
          </button>
          {optionsForDeclaration.map((option) => {
            const belowMinimum = option.minQuantity != null && option.minQuantity > 1;
            const selected = value?.optionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={belowMinimum}
                aria-pressed={selected}
                onClick={() => selectOption(option.id)}
                className={cn(
                  "rounded-md border px-3 py-2 text-small transition-colors",
                  selected ? "border-chilli bg-chilli/10 text-chilli" : "border-input text-charcoal hover:border-charcoal/40",
                  belowMinimum && "cursor-not-allowed border-input bg-muted text-charcoal/40 hover:border-input",
                )}
              >
                {option.packagingMethodName} (+{currency} {option.charge.toLocaleString()})
                {belowMinimum && <span className="ml-1.5">(min {option.minQuantity})</span>}
              </button>
            );
          })}
        </div>
      )}

      {selectedOption && (
        <div className="mt-3 space-y-1 rounded-md border border-input bg-muted/40 p-3 text-small text-charcoal/80">
          {selectedOption.leadTimeDays !== null && <p>Lead time: {selectedOption.leadTimeDays} day(s)</p>}
          {selectedOption.shelfLifeText ? (
            <p>{selectedOption.shelfLifeText}</p>
          ) : (
            selectedOption.shelfLifeDays !== null && <p>Shelf life: {selectedOption.shelfLifeDays} day(s)</p>
          )}
          {selectedOption.customerInstructions && <p>{selectedOption.customerInstructions}</p>}
          <div className="pt-1">
            <CheckboxOption
              label="I understand this packaging's lead time and shelf life as described above."
              checked={acknowledged}
              onCheckedChange={onAcknowledgedChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
