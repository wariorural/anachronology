// Små, delte formatterere for render-laget.

// Siffergruppering KUN fra 10 000 (grupperte vanlige årstall som «2,001» ser
// feil ut) — akkurat der datasettet er mest forbløffende (802,701) og rå
// sifferstrenger er minst lesbare.
export function fmtAar(aar: number): string {
  const abs = Math.abs(aar);
  const s = abs >= 10000 ? abs.toLocaleString("en-US") : String(abs);
  return aar < 0 ? `${s} BC` : s;
}

// Gap-etikett for kollapsede akse-strekk. Store gap avrundes (to gjeldende
// sifre, «≈»-prefiks) — «17179 years» er falsk presisjon for et komprimert hopp.
export function fmtGap(aar: number): string {
  if (aar < 1000) return `${aar} yrs`;
  const mag = 10 ** (Math.floor(Math.log10(aar)) - 1);
  return `≈ ${(Math.round(aar / mag) * mag).toLocaleString("en-US")} yrs`;
}

export function tittelKort(tittel: string, maks = 26): string {
  return tittel.length > maks ? tittel.slice(0, maks - 1) + "…" : tittel;
}

const MEDIUM_NAVN: Record<string, string> = {
  film: "Film",
  bok: "Book",
  tv: "TV series",
};

export function mediumNavn(medium: string): string {
  return MEDIUM_NAVN[medium] ?? medium;
}

// Label for the creator field, matched to the medium (director ≠ author).
export function skaperLabel(medium: string): string {
  if (medium === "bok") return "Author";
  return "Director"; // film, tv
}

// Presis lenke om den finnes, ellers et Wikipedia-søk på tittelen (robust mot
// at "1984" ≠ artikkelen "Nineteen Eighty-Four").
export function wikiUrl(tittel: string, wiki?: string): string {
  if (wiki) return wiki;
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(tittel)}`;
}

// "1984" / "1805–1812" / "73 f.Kr.–71 f.Kr."
export function foregaarTekst(fra: number, til: number): string {
  return fra === til ? fmtAar(fra) : `${fmtAar(fra)}–${fmtAar(til)}`;
}

// "Nice" tick-intervall ut fra piksler-per-år, slik at årsetiketter sitter
// ~64px fra hverandre uansett zoom. Løftet fra prototypens tickStep.
export function tickSteg(pxPerAar: number): number {
  const maal = 64;
  const raa = maal / pxPerAar;
  const steg = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  return steg.find((s) => s >= raa) ?? 10000;
}
