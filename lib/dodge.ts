// Kollisjonshåndtering (beeswarm/dodge).
//
// Mange verk deler periode (2. verdenskrig, nær framtid). Punkter på samme y må
// vifte ut horisontalt i "lanes" uten å overlappe. Vi gjør det GREEDY og
// DETERMINISTISK — sorter på y, plasser hvert verk i laveste ledige lane — i
// stedet for en fysikk-simulering (d3-force), som ville vært ikke-deterministisk
// og dermed umulig å unit-teste.
//
// x-posisjon i render = akseX + lane * laneBredde.

export interface DodgeItem {
  id: string;
  /** y-utstrekning: punkt har y0 == y1, et bånd (tidsspenn) har y0 < y1. */
  y0: number;
  y1: number;
}

export interface DodgeOpts {
  /** Markørradius (px). To markører i samme lane holdes ≥ 2·radius fra hverandre. */
  radius: number;
  laneBredde: number;
  /** Maks antall lanes. Nås den, stables resten i siste lane (degraderer pent). */
  maxLanes: number;
}

export interface DodgePlassering {
  lane: number;
}

export function dodge(
  items: DodgeItem[],
  opts: DodgeOpts,
): Map<string, DodgePlassering> {
  // Sorter på y0, så på id — gjør output bit-identisk for samme input.
  const sortert = [...items].sort((a, b) => {
    if (a.y0 !== b.y0) return a.y0 - b.y0;
    return a.id < b.id ? -1 : 1;
  });

  // Per lane: liste av opptatte [lo, hi]-intervaller (utvidet med radius hver side).
  const lanes: { lo: number; hi: number }[][] = [];
  const resultat = new Map<string, DodgePlassering>();

  function overlapper(lane: number, lo: number, hi: number): boolean {
    const opptatt = lanes[lane];
    if (!opptatt) return false;
    return opptatt.some((iv) => lo < iv.hi && hi > iv.lo);
  }

  for (const it of sortert) {
    const lo = Math.min(it.y0, it.y1) - opts.radius;
    const hi = Math.max(it.y0, it.y1) + opts.radius;

    // Klatre oppover lanes til en uten overlapp — eller til siste lane (cap).
    let lane = 0;
    while (lane < opts.maxLanes - 1 && overlapper(lane, lo, hi)) {
      lane++;
    }

    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push({ lo, hi });
    resultat.set(it.id, { lane });
  }

  return resultat;
}
