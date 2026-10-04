import { ScrollReveal } from "@/components/motion";

/** STORY-072. ~60-75vh editorial hero — large typography, generous whitespace, no stock-corporate imagery. */
export function ContactHero() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center bg-cream px-4 text-center">
      <ScrollReveal>
        <p className="text-small font-medium tracking-wide text-chilli uppercase">Contact Us</p>
        <h1 className="mt-3 text-h1 font-heading text-charcoal sm:text-[3.5rem]">Let&apos;s talk about good food.</h1>
        <p className="mx-auto mt-5 max-w-xl text-body text-charcoal/80">
          From authentic Sri Lankan flavours to international partnerships, we&apos;d love to hear from you.
        </p>
      </ScrollReveal>
    </div>
  );
}
