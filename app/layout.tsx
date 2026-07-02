import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anachronology – when is fiction set?",
  description:
    "A timeline placing fiction by the year it's set in – against real history.",
};

// Pinch driver tidslinjas EGEN zoom (pointer-events). Uten dette zoomer nettleseren
// også hele siden samtidig → et synlig «hopp». Slå av side-zoom så gesten kun treffer
// tidslinja. (App-en har egen zoom-UI: +/− og slider, så ingen zoom-vei går tapt.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
