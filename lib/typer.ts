// Datakontrakten. Både data/seed.json og en evt. senere Sanity-fetch må
// returnere disse formene — da er bytte av datakilde et isolert bytte, ingen
// render-endring.

export type Medium = "film" | "bok" | "tv";

export interface Verk {
  tittel: string;
  medium: Medium;
  /** Når verket ble laget/skrevet. KUN metadata i kortet — aldri akse-posisjon. */
  lagetAar?: number;
  /** Regissør (film/TV) eller forfatter (bok). Vises i kortet. */
  skaper?: string;
  /** Året verket FOREGÅR fra. Påkrevd — dette er akse-posisjonen. */
  foregaarFra: number;
  /** Lik foregaarFra for et punkt; ulik for et tidsspenn (bånd). */
  foregaarTil: number;
  /** Omstridt/usikkert årstall → stiplet kontur (Metropolis, Gladiator). */
  usikker?: boolean;
  merknad?: string;
  kilde?: string;
  /** Valgfri presis lenke (Wikipedia o.l.). Mangler den, søkes på tittelen. */
  wiki?: string;
  /** Wikipedia-thumbnail (prefetchet). Brukes som markør på mobil + i kortet. */
  bilde?: string;
}

export interface Anker {
  tittel: string;
  /** epoke = bånd · hendelse = linje · oppfinnelse = stjerne · person = svakt livs-bånd (fra=født, til=død). */
  type: "epoke" | "hendelse" | "oppfinnelse" | "person";
  fra: number;
  /** Lik fra for hendelse/oppfinnelse; ulik for en epoke eller en persons levetid. */
  til: number;
  /** Prominens — styrer etikett-prioritet når plassen er trang. */
  vekt?: number;
  /** Én setning til anker-kortet (ankrene er trykkbare). */
  merknad?: string;
  /** Valgfri presis lenke (Wikipedia o.l.). Mangler den, søkes på tittelen. */
  wiki?: string;
}

export interface Datasett {
  verk: Verk[];
  ankere: Anker[];
}
