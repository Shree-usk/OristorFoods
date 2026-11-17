import Image from "next/image";

export interface ExportCertificationData {
  id: string;
  name: string;
  certificateImage: string | null;
}

/**
 * Real, admin-managed certifications (Certifications admin, the same
 * model already attached to individual products) — only ones with a
 * real logo image reach this strip; see
 * export-content.service.ts::getCertificationsForStorefront. Renders
 * nothing if none qualify yet, rather than falling back to invented
 * certification claims.
 */
export function ExportCertificationStrip({ certifications }: { certifications: ExportCertificationData[] }) {
  if (certifications.length === 0) return null;

  return (
    <div className="bg-charcoal px-4 py-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {certifications.map((certification) => (
          <div key={certification.id} className="flex items-center gap-2">
            {certification.certificateImage && (
              <span className="relative size-5 shrink-0">
                <Image src={certification.certificateImage} alt="" fill sizes="20px" className="object-contain" />
              </span>
            )}
            <span className="text-caption font-medium tracking-wide text-gold uppercase">{certification.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
