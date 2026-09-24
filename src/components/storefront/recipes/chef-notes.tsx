export function ChefNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;
  return (
    <div className="rounded-lg border-l-4 border-gold bg-cream/60 p-4">
      <h2 className="text-h4 font-heading text-charcoal">Chef&apos;s Notes</h2>
      <p className="mt-2 text-body text-charcoal/90">{notes}</p>
    </div>
  );
}
