export function BulletList({
  heading,
  items,
  headingLevel: HeadingTag = "h3",
  hideHeading = false,
}: {
  heading: string;
  items: string[];
  headingLevel?: "h2" | "h3";
  /** The heading is already rendered elsewhere (e.g. a Collapsible's own trigger) — render only the list. */
  hideHeading?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      {!hideHeading && <HeadingTag className="text-h4 font-heading text-charcoal">{heading}</HeadingTag>}
      <ul className="mt-2 list-inside list-disc space-y-1 text-small text-charcoal">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
