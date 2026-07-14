import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Container } from "@/components/storefront/layout/container";

export const metadata: Metadata = {
  title: "Style Guide | Oristor",
  robots: { index: false, follow: false },
};

const colors: { name: string; token: string; hex: string; className: string }[] = [
  { name: "Ivory", token: "bg-ivory", hex: "#FAF7F2", className: "bg-ivory" },
  { name: "Charcoal", token: "bg-charcoal", hex: "#2F2B2A", className: "bg-charcoal" },
  { name: "Oristor Gold", token: "bg-gold", hex: "#CDAF52", className: "bg-gold" },
  { name: "Chilli Red", token: "bg-chilli", hex: "#B22222", className: "bg-chilli" },
  { name: "Leaf Green", token: "bg-leaf", hex: "#2E8B57", className: "bg-leaf" },
  { name: "Cream", token: "bg-cream", hex: "#FFFDF9", className: "bg-cream" },
  { name: "Warm Beige", token: "bg-beige", hex: "#F2ECE4", className: "bg-beige" },
  { name: "Light Gold", token: "bg-gold-light", hex: "#E8D9A8", className: "bg-gold-light" },
  { name: "Stone Grey", token: "bg-stone", hex: "#8A817C", className: "bg-stone" },
  { name: "Soft Border", token: "bg-border-soft", hex: "#E5DED5", className: "bg-border-soft" },
];

const typeScale: { name: string; className: string; px: string }[] = [
  { name: "Hero", className: "text-hero font-heading", px: "64px" },
  { name: "H1", className: "text-h1 font-heading", px: "48px" },
  { name: "H2", className: "text-h2 font-heading", px: "36px" },
  { name: "H3", className: "text-h3 font-heading", px: "30px" },
  { name: "H4", className: "text-h4 font-heading", px: "24px" },
  { name: "Body", className: "text-body font-body", px: "16px" },
  { name: "Small", className: "text-small font-body", px: "14px" },
  { name: "Caption", className: "text-caption font-body", px: "12px" },
];

export default function StyleGuidePage() {
  return (
    <Container size="default" className="max-w-5xl space-y-16 py-16">
      <header className="space-y-2">
        <h1 className="text-h1 font-heading text-charcoal">Oristor Style Guide</h1>
        <p className="text-body text-stone">
          Living reference for the design tokens defined in{" "}
          <code className="text-small">docs/blueprint.md</code> Section 2. Dev-only route —
          not linked from any customer-facing navigation.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-h3 font-heading text-charcoal">Colors</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {colors.map((color) => (
            <div key={color.name} className="space-y-2">
              <div className={`h-20 rounded-lg border border-border-soft ${color.className}`} />
              <div>
                <p className="text-small font-medium text-charcoal">{color.name}</p>
                <p className="text-caption text-stone">
                  {color.hex} · <code>{color.token}</code>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-heading text-charcoal">Typography</h2>
        <div className="space-y-4">
          {typeScale.map((step) => (
            <div key={step.name} className="flex items-baseline gap-4 border-b border-border-soft pb-3">
              <span className="w-16 shrink-0 text-caption text-stone">
                {step.name} / {step.px}
              </span>
              <span className={`${step.className} text-charcoal`}>Feel the Difference</span>
            </div>
          ))}
          <div className="flex items-baseline gap-4 pt-2">
            <span className="w-16 shrink-0 text-caption text-stone">Number</span>
            <span className="font-number text-h3 text-charcoal">Rs. 1,249.00</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-heading text-charcoal">Components</h2>
        <Card className="p-6">
          <CardHeader className="px-0">
            <CardTitle className="font-heading text-h4">Sample Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-0">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary CTA (Chilli)</Button>
              <Button variant="secondary">Secondary (Gold)</Button>
              <Button className="bg-leaf text-cream hover:bg-leaf/90">Success (Leaf)</Button>
              <Button variant="outline">Outline</Button>
              <Badge>Badge</Badge>
            </div>

            <div className="max-w-sm space-y-2">
              <Label htmlFor="style-guide-email">Email</Label>
              <Input id="style-guide-email" type="email" placeholder="you@example.com" />
            </div>
          </CardContent>
        </Card>
      </section>
    </Container>
  );
}
