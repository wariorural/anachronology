// Chronoscope-geometri: rene hjelpere for lysbue-viewet (/chronoscope).
// Hvert verk tegnes som en kvadratisk bue fra laget-året til foregår-året —
// selve anakronisme-spranget som geometri. Rent + testet (huskonvensjon).

import type { Verk } from "./typer";

/** Profeti = forestilt framover; minne = historisk fiksjon; samtid = ingen
 *  målbar avstand (eller ukjent laget-år) → glyf på selve aksen. */
export type Temporalitet = "profeti" | "minne" | "samtid";

export function temporalitet(v: Verk): Temporalitet {
  if (v.lagetAar == null) return "samtid";
  if (v.foregaarFra > v.lagetAar) return "profeti";
  if (v.foregaarTil < v.lagetAar) return "minne";
  return "samtid";
}

/** Anakronisme-gapet i år, med fortegn (+ = forestilt framover). */
export function sprang(v: Verk): number {
  if (v.lagetAar == null) return 0;
  const t = temporalitet(v);
  if (t === "profeti") return v.foregaarFra - v.lagetAar;
  if (t === "minne") return v.foregaarTil - v.lagetAar;
  return 0;
}

/** Buehøyde fra en NORMALISERT andel (0..1) av tilgjengelig tverr-plass,
 *  med gulv på 12 % så småsprang fortsatt leses som buer. Andelen kommer
 *  fra gapRang (persentil) — verken rå √gap (alt klumpet nær aksen) eller
 *  log-mot-maks (én 800 000-års-outlier knuste resten) brukte høyden. */
export function bueHoyde(andel: number, maks: number): number {
  return maks * (0.12 + 0.88 * Math.max(0, Math.min(1, andel)));
}

/** Persentil-rang for hvert gap: minste gap → 0, største → 1, like gap får
 *  samme rang. Fordelings-uavhengig — datasettet fyller ALLTID hele
 *  tverr-plassen jevnt, uansett outliere. */
export function gapRang(gaps: number[]): number[] {
  const abs = gaps.map(Math.abs);
  const sorterte = [...new Set(abs)].sort((a, b) => a - b);
  if (sorterte.length <= 1) return gaps.map(() => 1);
  const rang = new Map(sorterte.map((g, i) => [g, i / (sorterte.length - 1)]));
  return abs.map((g) => rang.get(g)!);
}

/** Kvadratisk bue-path langs en horisontal akse (akse-y = 0 i lokal ramme).
 *  over=true buer opp (negativ y). p0/p1 er akseposisjoner (px). */
export function buePath(p0: number, p1: number, hoyde: number, over: boolean): string {
  const cy = over ? -hoyde : hoyde;
  return `M ${p0} 0 Q ${(p0 + p1) / 2} ${cy} ${p1} 0`;
}

/** Hvor på buen (0–1, målt langs akse-projeksjonen) NÅ-linja skjærer.
 *  null = buen krysser ikke NÅ (helt i fortid eller helt i framtid). */
export function slicePunkt(p0: number, p1: number, pNaa: number): number | null {
  const lo = Math.min(p0, p1);
  const hi = Math.max(p0, p1);
  if (pNaa <= lo || pNaa >= hi) return null;
  return (pNaa - lo) / (hi - lo);
}

/** Tellere til NÅ-slissen og Meridian Ledger. Kun profetier telles —
 *  innhentet = framtida verket forestilte er nådd (foregaarFra ≤ nå). */
export function tellere(verk: Verk[], naa: number): { innhentet: number; gjenstaar: number } {
  let innhentet = 0;
  let gjenstaar = 0;
  for (const v of verk) {
    if (temporalitet(v) !== "profeti") continue;
    if (v.foregaarFra <= naa) innhentet++;
    else gjenstaar++;
  }
  return { innhentet, gjenstaar };
}
