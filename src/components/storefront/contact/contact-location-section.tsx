import { ScrollReveal } from "@/components/motion";

interface ContactLocationSectionProps {
  address: string;
  heading: string;
}

/** STORY-072. External map link, not an embedded map — avoids the performance cost per the brief's own instruction. */
export function ContactLocationSection({ address, heading }: ContactLocationSectionProps) {
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <ScrollReveal>
      <div className="text-center">
        <h2 className="text-h3 font-heading text-charcoal">{heading}</h2>
        <p className="mt-2 text-body text-charcoal/80">{address}</p>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-small font-medium text-chilli hover:underline">
          Get Directions →
        </a>
      </div>
    </ScrollReveal>
  );
}
