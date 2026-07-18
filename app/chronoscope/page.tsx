import type { Metadata } from "next";
import { Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import seed from "@/data/seed.json";
import type { Datasett } from "@/lib/typer";
import Chronoscope from "@/components/chronoscope/Chronoscope";

// Instrument-fontene lastes KUN på denne ruta — papirutgaven betaler ingenting.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--cs-serif-loaded",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--cs-mono-loaded",
});

export const metadata: Metadata = {
  title: "Chronoscope – Anachronology",
  description:
    "Every work of fiction drawn as a leap of light from the year it was made to the year it is set — sliced by the NOW line.",
};

const data = seed as Datasett;

export default function ChronoscopePage() {
  const naa = new Date().getFullYear();
  return (
    <div className={`${serif.variable} ${mono.variable} cs-rot`}>
      <Chronoscope verk={data.verk} ankere={data.ankere} naa={naa} />
    </div>
  );
}
