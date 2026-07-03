import seed from "@/data/seed.json";
import type { Datasett } from "@/lib/typer";
import Tidslinje from "@/components/Tidslinje";

const data = seed as Datasett;

export default function Home() {
  // NÅ-året bakes ved bygg som SSR-startverdi; Tidslinje frisker det opp
  // klientside ved mount (ellers står linja feil hver 1. januar til redeploy).
  const naa = new Date().getFullYear();
  return <Tidslinje verk={data.verk} ankere={data.ankere} naa={naa} />;
}
