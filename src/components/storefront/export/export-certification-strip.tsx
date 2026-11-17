import Image from "next/image";

export interface ExportCertificationStripItemData {
  id: string;
  imageUrl: string | null;
  label: string;
}

/**
 * The strip's own admin-managed content — deliberately separate from the
 * Certification master data (the footer's badges still use that; see
 * export-content.service.ts::getCertificationStripForStorefront and its
 * doc comment). Renders nothing if the admin hasn't added any items yet,
 * rather than falling back to invented claims.
 */
export function ExportCertificationStrip({ items }: { items: ExportCertificationStripItemData[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-charcoal px-4 py-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            {item.imageUrl && (
              <span className="relative size-5 shrink-0">
                <Image src={item.imageUrl} alt="" fill sizes="20px" className="object-contain" />
              </span>
            )}
            <span className="text-caption font-medium tracking-wide text-gold uppercase">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
