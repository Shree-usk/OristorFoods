import type { Metadata } from "next";
import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  // The canonical *public* site URL (for resolving relative OG/twitter
  // image URLs etc.) is intentionally NOT NEXTAUTH_URL — that's the auth
  // callback base and must track whatever environment is actually
  // running (localhost in dev). metadataBase should always resolve to
  // the real production domain regardless of environment.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com"),
  title: {
    default: "Oristor | Feel the Difference",
    template: "%s | Oristor",
  },
  description:
    "Premium Sri Lankan food — authentic heritage, delivered with an enterprise-grade digital experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(cormorantGaramond.variable, inter.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
