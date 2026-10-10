import Image from "next/image";

export function CertificationBadges({
  allergens,
  certifications,
}: {
  allergens: { name: string; icon: string | null }[];
  certifications: { name: string; certificateImage: string | null }[];
}) {
  if (allergens.length === 0 && certifications.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-4">
      {certifications.length > 0 && (
        <div>
          <h2 className="text-h4 font-heading text-charcoal">Certifications</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {certifications.map((certification) => (
              <div key={certification.name} className="flex items-center gap-2 rounded-lg border border-input px-3 py-2">
                {certification.certificateImage && (
                  <div className="relative size-8 shrink-0">
                    <Image src={certification.certificateImage} alt="" fill sizes="32px" className="object-contain" />
                  </div>
                )}
                <span className="text-small text-charcoal">{certification.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {allergens.length > 0 && (
        <div>
          <h2 className="text-h4 font-heading text-charcoal">Allergen Information</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {allergens.map((allergen) => (
              <div key={allergen.name} className="flex items-center gap-1.5 rounded-full bg-beige px-3 py-1">
                {allergen.icon && (
                  <div className="relative size-4 shrink-0">
                    <Image src={allergen.icon} alt="" fill sizes="16px" className="object-contain" />
                  </div>
                )}
                <span className="text-caption text-charcoal">{allergen.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
