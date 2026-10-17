const STEPS = [
  { title: "Explore collections", description: "Browse our export-ready collections to find products suited to your market." },
  { title: "Select products of interest", description: "Add the products you'd like to source to your selection." },
  { title: "Submit an enquiry", description: "Tell us about your business, destination market, and estimated requirements." },
  {
    title: "Discuss the details",
    description: "Our export team will follow up to discuss quantities, packaging, destination-market requirements, and commercial terms.",
  },
  { title: "Confirm and proceed", description: "Agree on specifications and finalise the supply arrangement together." },
] as const;

export function ExportBuyerJourney() {
  return (
    <div>
      <h2 className="text-h2 font-heading text-charcoal">How It Works</h2>
      <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-lg border border-charcoal/10 bg-ivory p-5">
            <span className="text-small font-medium text-chilli">Step {index + 1}</span>
            <p className="mt-1 text-body font-heading text-charcoal">{step.title}</p>
            <p className="mt-2 text-small text-charcoal/70">{step.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
