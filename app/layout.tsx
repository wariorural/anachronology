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
// Ingen hardkodet verk-antall her — datasettet vokser, metadata skal ikke drifte.
const BESKRIVELSE =
  "Fiction placed by the year it's set in – against real history. " +
  "The NOW line splits futures reality has caught up with from the ones still ahead.";

// Kanonisk URL: eksplisitt env vinner; ellers Vercels produksjonsdomene ved
// deploy; lokalt en trygg default. (Uten dette pekte og:image på localhost.)
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

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
  // Nettleser-kromen farges som papiret, og appen tegner inn i safe-area
  // (hjem-indikator/notch) — kantene håndteres med env(safe-area-inset-*).
  themeColor: "#e7e4dd",
  viewportFit: "cover",
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
