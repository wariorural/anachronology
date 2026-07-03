import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Selvhostet grotesk via next/font (ingen runtime-avhengighet, ingen FOUT-flash).
// Uten denne så de fleste (Windows/Android/Linux) hele appen i Arial — den
// redaksjonelle identiteten hviler på at grotesken faktisk lastes.
const grotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-grotesk-loaded",
});

const TITTEL = "Anachronology – when is fiction set?";
const BESKRIVELSE =
  "99 works of fiction placed by the year they're set in – against real history. " +
  "The NOW line splits futures reality has caught up with from the ones still ahead.";

// Kanonisk URL styres av miljøet (settes ved deploy); lokalt en trygg default.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITTEL,
  description: BESKRIVELSE,
  // og:image/twitter:image kobles automatisk fra app/opengraph-image.png
  // (Next-filkonvensjon) — ingen manuel wiring trengs her.
  openGraph: {
    title: TITTEL,
    description: BESKRIVELSE,
    type: "website",
    siteName: "Anachronology",
  },
  twitter: {
    card: "summary_large_image",
    title: TITTEL,
    description: BESKRIVELSE,
  },
};

// Side-zoom holdes ÅPEN (WCAG 1.4.4 — tekst skaleres ikke av appens egen zoom).
// Dobbelt-zoom-gesten styres i stedet lokalt: .tm-scroll har touch-action
// pan-x/pan-y, så nettleser-pinch er slått av akkurat der appens pinch bor.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={grotesk.variable}>
      <head>
        {/* Mobil-markørene er ~30 Wikipedia-thumbnails — betal DNS+TLS én gang, tidlig. */}
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
