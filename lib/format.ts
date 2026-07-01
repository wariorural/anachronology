// Små, delte formatterere for render-laget.

export function fmtAar(aar: number): string {
  return aar < 0 ? `${Math.abs(aar)} BC` : String(aar);
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
