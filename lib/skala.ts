// Elastisk tidsakse.
//
// Problemet: dataene spenner fra år -73 til 20000, men 90 % ligger i 1750–2030.
// En ren lineær akse kaster bort all plass på tomrom og lar outliere dominere.
//
// Løsningen: gi piksler der dataene faktisk er (tette "regioner" rendres lineært),
// og kollaps tomme strekk til en fast liten høyde — men ÆRLIG: hvert kollapset
// strekk blir et eget `segment` med `kollapset: true`, så render-laget kan tegne
// en gap-markør ("⋯ 340 år ⋯") i stedet for å skjule forvrengningen.
//
// Alt hviler på to funksjoner: yearToY (år → y) og yToYear (inversen). Inversen er
// kritisk — zoom-ankring og outlier-deteksjon spør "hvilket år ligger på denne y-en?".

export type Modus = "elastisk" | "lineaer";

export interface Segment {
  fra: number;
  til: number;
  /** true = tomt strekk komprimert til fast høyde (render tegner gap-markør). */
  kollapset: boolean;
  y0: number;
  y1: number;
}

export interface Skala {
  yearToY(year: number): number;
  yToYear(y: number): number;
  segmenter: Segment[];
  hoyde: number;
}

export interface SkalaOpts {
  modus: Modus;
  /** Basis piksler per år før zoom. */
  pxPerAar: number;
  zoom: number;
  /** Tomme strekk lengre enn dette (i år) kollapses. */
  kollapsTerskel: number;
  /** Fast høyde (px) et kollapset strekk får. */
  kollapsPx: number;
  /** Pust rundt hver okkupert region (år), så et enslig punkt ikke blir 0 høyt. */
  pad: number;
}

function clamp(v: number, lav: number, hoy: number): number {
  if (v < lav) return lav;
  if (v > hoy) return hoy;
  return v;
}

export function lagSkala(
  okkupert: { fra: number; til: number }[],
  opts: SkalaOpts,
): Skala {
  if (okkupert.length === 0) {
    throw new Error("lagSkala: tomt datasett — ingen okkuperte intervaller");
  }
  const pxEff = opts.pxPerAar * opts.zoom;

  // 1. Normaliser (tål omvendt fra/til), padd, og sorter på startår.
  const intervaller = okkupert
    .map((o) => ({
      fra: Math.min(o.fra, o.til) - opts.pad,
      til: Math.max(o.fra, o.til) + opts.pad,
    }))
    .sort((a, b) => a.fra - b.fra);

  // 2. Slå sammen overlappende (padda) intervaller til disjunkte regioner.
  const regioner: { fra: number; til: number }[] = [{ ...intervaller[0] }];
  for (let i = 1; i < intervaller.length; i++) {
    const siste = regioner[regioner.length - 1];
    const neste = intervaller[i];
    if (neste.fra <= siste.til) {
      siste.til = Math.max(siste.til, neste.til);
    } else {
      regioner.push({ ...neste });
    }
  }

  // 3. Bygg en sammenhengende segment-tabell: region-segment (lineært) vekslende
  //    med gap-segment (kollapset eller lineært). Hvert segments y1 == neste y0,
  //    så aksen aldri har hull i y.
  const segmenter: Segment[] = [];
  let y = 0;
  for (let i = 0; i < regioner.length; i++) {
    const r = regioner[i];
    if (i > 0) {
      const forrige = regioner[i - 1];
      const gapAar = r.fra - forrige.til;
      const kollaps = opts.modus === "elastisk" && gapAar > opts.kollapsTerskel;
      const h = kollaps ? opts.kollapsPx : gapAar * pxEff;
      segmenter.push({ fra: forrige.til, til: r.fra, kollapset: kollaps, y0: y, y1: y + h });
      y += h;
    }
    const h = (r.til - r.fra) * pxEff;
    segmenter.push({ fra: r.fra, til: r.til, kollapset: false, y0: y, y1: y + h });
    y += h;
  }
  const hoyde = y;
  const minAar = segmenter[0].fra;
  const maksAar = segmenter[segmenter.length - 1].til;

  // Binærsøk: segmentet som inneholder et gitt år (segmentene er sortert og
  // sammenhengende, så vi finner det første hvis `til` >= år).
  function segmentForAar(aar: number): Segment {
    let lo = 0;
    let hi = segmenter.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (aar <= segmenter[mid].til) hi = mid;
      else lo = mid + 1;
    }
    return segmenter[lo];
  }

  function segmentForY(yv: number): Segment {
    let lo = 0;
    let hi = segmenter.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (yv <= segmenter[mid].y1) hi = mid;
      else lo = mid + 1;
    }
    return segmenter[lo];
  }

  return {
    segmenter,
    hoyde,
    yearToY(year: number): number {
      const aar = clamp(year, minAar, maksAar);
      const seg = segmentForAar(aar);
      const spenn = seg.til - seg.fra;
      if (spenn === 0) return seg.y0;
      return seg.y0 + ((aar - seg.fra) / spenn) * (seg.y1 - seg.y0);
    },
    yToYear(yv: number): number {
      const y2 = clamp(yv, 0, hoyde);
      const seg = segmentForY(y2);
      const spenn = seg.y1 - seg.y0;
      if (spenn === 0) return seg.fra;
      return seg.fra + ((y2 - seg.y0) / spenn) * (seg.til - seg.fra);
    },
  };
}
