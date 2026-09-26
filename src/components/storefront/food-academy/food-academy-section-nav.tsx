"use client";

interface FoodAcademySectionNavProps {
  sections: { sectionNumber: number; title: string }[];
}

/**
 * Plain anchor-link table of contents, sticky-positioned via CSS. No
 * active-section scroll-spy highlighting in v1 — that needs scroll
 * listeners/IntersectionObserver for a nice-to-have the AC doesn't
 * require (the actual bar is "keyboard-operable," which plain anchor
 * links satisfy for free).
 */
export function FoodAcademySectionNav({ sections }: FoodAcademySectionNavProps) {
  if (sections.length === 0) return null;

  return (
    <nav aria-label="Course sections" className="sticky top-24 hidden w-56 shrink-0 lg:block">
      <ol className="flex flex-col gap-2 border-l border-input pl-4 text-small">
        {sections.map((section) => (
          <li key={section.sectionNumber}>
            <a href={`#section-${section.sectionNumber}`} className="text-charcoal/70 hover:text-chilli">
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
