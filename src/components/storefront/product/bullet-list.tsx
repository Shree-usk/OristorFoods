export function BulletList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-h4 font-heading text-charcoal">{heading}</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-small text-charcoal">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
