import seed from "@/data/seed.json";
import type { Datasett } from "@/lib/typer";
import Tidslinje from "@/components/Tidslinje";

const data = seed as Datasett;

export default function Home() {
  // NÅ-året bakes ved bygg. Rebuild oppdaterer NÅ-linja (godt nok for v1).
  const naa = new Date().getFullYear();
  return <Tidslinje verk={data.verk} ankere={data.ankere} naa={naa} />;
}
