export function BulletList({
  heading,
  items,
  headingLevel: HeadingTag = "h3",
}: {
  heading: string;
  items: string[];
  headingLevel?: "h2" | "h3";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <HeadingTag className="text-h4 font-heading text-charcoal">{heading}</HeadingTag>
      <ul className="mt-2 list-inside list-disc space-y-1 text-small text-charcoal">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
