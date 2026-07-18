import { memo } from "react";
import type { Skala } from "@/lib/skala";
import type { Anker } from "@/lib/typer";
import { fmtAar, fmtGap, tickSteg } from "@/lib/format";

interface Props {
  skala: Skala;
  ankere: Anker[];
  /** Bredden på venstre årsmarg (vertikal/mobil). */
  venstreX: number;
  /** Container-bredde (cross-extent vertikalt, langs-extent regnes fra skala). */
  W: number;
  /** Container-høyde (cross-extent horisontalt). */
  H: number;
  naa: number;
  /** Desktop: der markørbanen (og epoke-båndene) starter langs tverr-aksen. */
  toppCross?: number;
  /** Desktop: tverr-gutter under banene (årstall). */
  bunnCross?: number;
  /** Smal skjerm (vertikal/mobil): declutter bakteppe-etiketter, venstre-ankret. */
  kompakt?: boolean;
  /** true = horisontal tidslinje (desktop): tidsaksen løper langs X. */
  vannrett?: boolean;
}

// Spre punkt-etiketter (oppfinnelser/mat) NED i kroppen i stedet for å stable dem øverst:
// hver får en stabil lane fra en hash av tittelen (deterministisk), nudget til nærmeste
// ledige lane så to etiketter med overlappende langs-intervall [p−w/2, p+w/2] ikke kolliderer.
// Samme idé som verkenes spreUtover — de flyter inn ved sitt eget år, blandet med resten.
function spreEtiketter(
  items: { key: Anker; p: number; w: number }[],
  baner: number,
  gap: number,
): Map<Anker, number> {
  const N = Math.max(1, baner);
  const sisteSlutt = new Array(N).fill(-Infinity);
  const ut = new Map<Anker, number>();
  for (const it of [...items].sort((a, b) => a.p - b.p)) {
    let h = 2166136261; // FNV-1a
    for (let k = 0; k < it.key.tittel.length; k++) {
      h ^= it.key.tittel.charCodeAt(k);
      h = Math.imul(h, 16777619);
    }
    const mål = (h >>> 0) % N;
    const venstre = it.p - it.w / 2;
    let valgt = -1;
    for (let d = 0; d < N && valgt < 0; d++) {
      for (const bane of d === 0 ? [mål] : [mål + d, mål - d]) {
        if (bane >= 0 && bane < N && venstre - sisteSlutt[bane] >= gap) {
          valgt = bane;
          break;
        }
      }
    }
    if (valgt < 0) {
      valgt = 0;
      for (let l = 1; l < N; l++) if (sisteSlutt[l] < sisteSlutt[valgt]) valgt = l;
    }
    ut.set(it.key, valgt);
    sisteSlutt[valgt] = it.p + it.w / 2;
  }
  return ut;
}

// Bakgrunnen fiksjonen sitter mot: framtidssone, epoke-bånd, årsgrid, gap-markører,
// hendelse-/oppfinnelse-etiketter og NÅ-hodet. Orienterings-bevisst: tidsaksen er
// X (vannrett/desktop) eller Y (mobil). `L(år)` = posisjon langs tidsaksen.
function AkseLag({ skala, ankere, venstreX, W, H, naa, toppCross = 108, bunnCross = 50, kompakt, vannrett }: Props) {
  const L = (aar: number) => skala.yearToY(aar);
  const langsEnd = skala.hoyde; // siste posisjon langs aksen (innenfor gruppa)
  const yNaa = L(naa);

  // En tverr-linje står vinkelrett på tidsaksen og spenner hele cross-extent.
  const tverrLinje = (
    p: number,
    key: string,
    stroke: string,
    sw: number,
    dash?: string,
  ) =>
    vannrett ? (
      <line key={key} x1={p} y1={0} x2={p} y2={H} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
    ) : (
      <line key={key} x1={0} y1={p} x2={W} y2={p} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
    );

  // --- Epoke-bånd (bakerst): samtidige epoker deles i parallelle baner ---
  const epoker = ankere
    .filter((a) => a.type === "epoke")
    .slice()
    .sort((p, q) => p.fra - q.fra);

  const laneTil: number[] = [];
  const lane: number[] = [];
  const comp: number[] = [];
  let compId = -1;
  let runMaxTil = -Infinity;
  for (const a of epoker) {
    let k = 0;
    while (k < laneTil.length && laneTil[k] > a.fra) k++;
    lane.push(k);
    laneTil[k] = a.til;
    if (a.fra >= runMaxTil) {
      compId++;
      runMaxTil = a.til;
    } else {
      runMaxTil = Math.max(runMaxTil, a.til);
    }
    comp.push(compId);
  }
  const kolonner = new Map<number, number>();
  epoker.forEach((_, i) =>
    kolonner.set(comp[i], Math.max(kolonner.get(comp[i]) ?? 0, lane[i] + 1)),
  );


  // Cross-extent epoke-banene deler: horisontalt = høyden mellom gutters; vertikalt = bredden.
  const epokeStart = vannrett ? toppCross : 6; // tverr-start (markørbandets topp / venstre 6)
  const epokeBrukbar = vannrett ? Math.max(0, H - toppCross - bunnCross) : W - 12;
  const baand = epoker.map((a, i) => {
    const antall = kolonner.get(comp[i])!;
    const kolBredde = epokeBrukbar / antall;
    const bx = epokeStart + lane[i] * kolBredde; // cross-start
    const bw = kolBredde - (antall > 1 ? 4 : 0); // cross-størrelse
    const l0 = L(a.fra);
    const l1 = L(a.til);
    const langsLen = Math.max(l1 - l0, 1);
    const rekt = vannrett
      ? { x: l0, y: bx, width: langsLen, height: bw }
      : { x: bx, y: l0, width: bw, height: langsLen };
    // Etikett vises bare når båndet er langt nok (langs tidsaksen) til å romme teksten →
    // disjunkte slabs kan aldri kollidere. Desktop: horisontalt, sentrert i båndet.
    // Mobil: tida løper vertikalt, så navnet står LANGS båndet (rotert 90°, leser nedover)
    // — da krysser det aldri kontekst-etikettene på tvers slik horisontal tekst gjorde.
    const caps = a.tittel.toUpperCase();
    const labelBredde = caps.length * 6.2 + 8;
    const visLabel = langsLen >= labelBredde;
    const lx = vannrett ? l0 + langsLen / 2 : bx + bw / 2;
    const ly = vannrett ? bx + 13 : l0 + 6;
    return (
      <g key={`epoke-${i}`}>
        <rect {...rekt} rx={10} fill="var(--bg-baand)" />
        {visLabel && (
          <text
            x={lx}
            y={ly}
            transform={vannrett ? undefined : `rotate(90 ${lx} ${ly})`}
            textAnchor={vannrett ? "middle" : "start"}
            fontSize={vannrett ? 10 : 9}
            fontWeight={600}
            letterSpacing=".08em"
            fill="var(--bg-etikett)"
          >
            {caps}
          </text>
        )}
      </g>
    );
  });

  // --- Person-livsbånd: svake pill-bånd over levetiden (fra=født, til=død) ---
  // Samtidige liv lane-pakkes (interval-graf) så de ikke overlapper, og spres over hele
  // tverr-extent som verkene → et rolig stratum bak fiksjonen, ikke en stripe øverst.
  const personer = ankere
    .filter((a) => a.type === "person")
    .slice()
    .sort((p, q) => p.fra - q.fra);
  const pLaneTil: number[] = [];
  const pLane = personer.map((a) => {
    let k = 0;
    while (k < pLaneTil.length && pLaneTil[k] > a.fra) k++;
    pLaneTil[k] = a.til;
    return k;
  });
  // Navnet kan flyte forbi eget bånd, men ikke inn i NESTE person i samme lane. Mål
  // avstanden dit; er den for kort (Joan of Arc → Columbus) skjules navnet. Så en kort
  // levetid med god luft etter (Leonardo) beholder navnet, ulikt en ren bånd-bredde-regel.
  const nesteFra = new Array(personer.length).fill(Infinity);
  const sistILane = new Map<number, number>();
  personer.forEach((a, i) => {
    const forrige = sistILane.get(pLane[i]);
    if (forrige !== undefined) nesteFra[forrige] = a.fra;
    sistILane.set(pLane[i], i);
  });
  const pPitch = epokeBrukbar / Math.max(1, pLaneTil.length);
  const pTykk = Math.min(Math.max(pPitch - 4, 8), 18);
  const personBaand = personer.map((a, i) => {
    const off = epokeStart + pLane[i] * pPitch + (pPitch - pTykk) / 2;
    const l0 = L(a.fra);
    const langsLen = Math.max(L(a.til) - l0, 1);
    const rekt = vannrett
      ? { x: l0, y: off, width: langsLen, height: pTykk }
      : { x: off, y: l0, width: pTykk, height: langsLen };
    const plassTilNavn =
      nesteFra[i] === Infinity ? Infinity : L(nesteFra[i]) - l0;
    const visNavn = plassTilNavn >= a.tittel.length * 4.8 + 10;
    return (
      <g key={`person-${i}`}>
        <rect {...rekt} rx={pTykk / 2} fill="var(--bg-person)" />
        {/* Navn kun på desktop — mobil holdes ren (bare det svake båndet bak bildene). */}
        {vannrett && visNavn && (
          <text
            x={l0 + 5}
            y={off + pTykk / 2 + 3}
            fontSize={9}
            fontWeight={600}
            letterSpacing=".02em"
            fill="var(--bg-person-tekst)"
          >
            {a.tittel}
          </text>
        )}
      </g>
    );
  });

  // --- Årsgrid + gap-markører ---
  const linjer: React.ReactNode[] = [];
  for (let i = 0; i < skala.segmenter.length; i++) {
    const seg = skala.segmenter[i];

    if (seg.kollapset) {
      // «Revet akse»: kant-linjer + svak flate gjør komprimeringen synlig i selve
      // kroppen — før så et kollapset 340-årsgap ut som 34px vanlig tid, og
      // etiketten delte baseline med årstallene (bokstavgrøt nederst til høyre).
      const midt = (seg.y0 + seg.y1) / 2;
      const etikett = `${fmtGap(seg.til - seg.fra)} skipped`;
      const flate = vannrett
        ? { x: seg.y0, y: 0, width: seg.y1 - seg.y0, height: H }
        : { x: 0, y: seg.y0, width: W, height: seg.y1 - seg.y0 };
      const senterTvers = vannrett
        ? toppCross + (H - toppCross - bunnCross) / 2
        : venstreX + 8;
      linjer.push(
        <g key={`gap-${i}`}>
          <rect {...flate} fill="var(--ink)" fillOpacity={0.03} />
          {tverrLinje(seg.y0, `gk0-${i}`, "var(--rule)", 1, "3 3")}
          {tverrLinje(seg.y1, `gk1-${i}`, "var(--rule)", 1, "3 3")}
          {vannrett ? (
            <text
              x={midt}
              y={senterTvers}
              textAnchor="middle"
              transform={`rotate(-45 ${midt} ${senterTvers})`}
              fontSize={9}
              letterSpacing=".06em"
              fill="var(--bg-etikett)"
              stroke="var(--paper)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {etikett}
            </text>
          ) : (
            <text
              x={senterTvers}
              y={midt + 3}
              fontSize={11}
              letterSpacing=".08em"
              fill="var(--bg-etikett)"
              stroke="var(--paper)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {etikett}
            </text>
          )}
        </g>,
      );
      continue;
    }

    const pxPerAar = (seg.y1 - seg.y0) / (seg.til - seg.fra);
    let steg = tickSteg(pxPerAar);
    // Tak per segment: lineær modus kan gi enorme år-spenn i ETT segment —
    // dobling holder «nice» intervaller og antall streker begrenset.
    while ((seg.til - seg.fra) / steg > 80) steg *= 2;
    const forste = Math.ceil(seg.fra / steg) * steg;
    for (let yr = forste; yr <= seg.til; yr += steg) {
      const p = L(yr);
      linjer.push(
        <g key={`tick-${i}-${yr}`}>
          {tverrLinje(p, `tl-${i}-${yr}`, "var(--rule)", 1)}
          {/* Årstall rotert −45°. Full opacity = navigasjon. */}
          {vannrett ? (
            // textAnchor=start + rotate(-45) → teksten stiger OPP-høyre i renna (med «end»
            // svingte den ned under bunnkanten og ble klippet).
            <text
              x={p}
              y={H - 8}
              textAnchor="start"
              transform={`rotate(-45 ${p} ${H - 8})`}
              fontSize={11}
              fontWeight={600}
              letterSpacing=".02em"
              fill="var(--ink-soft)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmtAar(yr)}
            </text>
          ) : (
            <text
              x={venstreX - 6}
              y={p}
              textAnchor="end"
              transform={`rotate(-45 ${venstreX - 6} ${p})`}
              fontSize={12}
              fontWeight={600}
              letterSpacing=".02em"
              fill="var(--ink-soft)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmtAar(yr)}
            </text>
          )}
        </g>,
      );
    }
  }

  // Kontekst-etiketter (hendelser + oppfinnelser/mat) spres NED i kroppen ved sitt eget år,
  // blandet med verk og personer — ÉN felles spredning så event og oppfinnelse aldri
  // kolliderer. Orienterings-bevisst: desktop sprer over HØYDEN (labels horisontale → kolliderer
  // i X, w=tekstbredde ~5.8px/tegn); mobil sprer over BREDDEN i kolonner (labels stables langs
  // Y → w≈tekst-høyde, kolonnene fordeles på tvers). Ingen droppes lenger.
  const hendAnk = ankere.filter((a) => a.type === "hendelse");
  const oppfAnk = ankere.filter((a) => a.type === "oppfinnelse");
  // Etikett-tekst: desktop m/år; mobil KUN tittel (året leses fra akse-tallene) → smalere,
  // så smal skjerm får plass til 3 kolonner i stedet for 2 og tette klynger ikke hoper seg.
  const ktxTekst = (a: Anker, stjerne: boolean) => {
    const t = stjerne ? `★ ${a.tittel}` : a.tittel;
    return vannrett ? `${t} ${fmtAar(a.fra)}` : t;
  };
  const MOB_RESERVE = 120; // px holdt av til høyre så mobil-etiketten ikke klippes
  const ktxAvail = vannrett
    ? Math.max(0, H - toppCross - bunnCross)
    : Math.max(0, W - venstreX - 6);
  const ktxBaner = vannrett
    ? Math.max(1, Math.floor(ktxAvail / 30)) // Y-rader
    : Math.max(2, Math.min(3, Math.floor(ktxAvail / 120))); // X-kolonner (2 på 360–390, 3 først på ~430+)
  const ktxPitch = vannrett
    ? ktxAvail / ktxBaner
    : (W - 6 - MOB_RESERVE - venstreX) / Math.max(1, ktxBaner - 1);
  const ktxBredde = (s: string) => (vannrett ? s.length * 5.8 + 6 : 15);
  // (lane, år-posisjon) → skjerm-plass. Desktop: sentrert på tverrlinja, nedover i høyden.
  // Mobil: venstre-ankret kolonne over bredden, ved sitt eget år.
  const ktxPos = (lane: number, p: number) =>
    vannrett
      ? { x: p, y: toppCross + lane * ktxPitch + 6, anchor: "middle" as const }
      : { x: venstreX + lane * ktxPitch, y: p + 3, anchor: "start" as const };
  const kontekstLane = spreEtiketter(
    [
      ...hendAnk.map((a) => ({ key: a, p: L(a.fra), w: ktxBredde(ktxTekst(a, false)) })),
      ...oppfAnk.map((a) => ({ key: a, p: L(a.fra), w: ktxBredde(ktxTekst(a, true)) })),
    ],
    ktxBaner,
    vannrett ? 14 : 8,
  );

  // --- Hendelser: tverrlinje + etikett spredt inn i kroppen ---
  // Vekt 400 + papir-halo: grå+lett = bakgrunn, blekk+medium = figur — og der
  // strataene likevel krysser forblir begge lesbare i stedet for bokstavgrøt.
  const hendelser = hendAnk.map((a, i) => {
    const p = L(a.fra);
    const pos = ktxPos(kontekstLane.get(a)!, p);
    return (
      <g key={`hendelse-${i}`}>
        {tverrLinje(p, `hl-${i}`, "var(--rule)", 1)}
        <text x={pos.x} y={pos.y} textAnchor={pos.anchor} fontSize={10} fontWeight={400} letterSpacing=".04em" fill="var(--bg-etikett)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
          {ktxTekst(a, false)}
        </text>
      </g>
    );
  });

  // --- Oppfinnelser/mat: stiplet tverrlinje + ★-etikett spredt inn i kroppen ---
  const oppfinnelser = oppfAnk.map((a, i) => {
    const p = L(a.fra);
    const pos = ktxPos(kontekstLane.get(a)!, p);
    return (
      <g key={`oppf-${i}`}>
        {tverrLinje(p, `ol-${i}`, "var(--rule)", 1, "1 5")}
        <text x={pos.x} y={pos.y} textAnchor={pos.anchor} fontSize={10} fontWeight={400} letterSpacing=".04em" fill="var(--bg-etikett)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
          {ktxTekst(a, true)}
        </text>
      </g>
    );
  });

  // Orientering: fortid → framtid langs tidsaksen.
  const orientering = vannrett ? (
    <g fill="var(--ink-soft)" fontSize={10} fontWeight={600} letterSpacing=".14em">
      <text x={2} y={H - 30}>← PAST</text>
      <text x={langsEnd - 2} y={H - 30} textAnchor="end">FUTURE →</text>
    </g>
  ) : (
    <g fill="var(--ink-soft)" fontSize={10} fontWeight={600} letterSpacing=".14em">
      <text x={venstreX - 8} y={-34}>↑ PAST</text>
      <text x={venstreX - 8} y={skala.hoyde + 30}>FUTURE ↓</text>
    </g>
  );

  // Framtidssone — varm oransje hint på framtids-siden av NÅ (gjør NÅ til en horisont).
  const framtid = vannrett
    ? { x: yNaa, y: 0, width: Math.max(0, langsEnd - yNaa), height: H }
    : { x: 0, y: yNaa, width: W, height: Math.max(0, langsEnd - yNaa) };

  return (
    <g>
      <rect {...framtid} fill="var(--accent)" fillOpacity={0.03} />
      {/* Rent navigasjonelt (retning, årstall, gap) — støy i skjermleser-strømmen;
          sr-sammendraget i Tidslinje bærer samme informasjon som tekst. */}
      <g aria-hidden="true">{orientering}</g>
      {baand}
      {personBaand}
      <g aria-hidden="true">{linjer}</g>
      {hendelser}
      {oppfinnelser}
      {/* NÅ — den ene fete tverrlinja, kant-til-kant (ref: kalenderplakaten).
          Flankert av tesen i klartekst: fylt/hul-koden forklares VED linja,
          ikke bare i en fjern legende. */}
      <g>
        {tverrLinje(yNaa, "naa-linje", "var(--accent)", 2.5)}
        {vannrett ? (
          <>
            <path d={`M ${yNaa - 7} 2 L ${yNaa + 7} 2 L ${yNaa} 13 Z`} fill="var(--accent)" />
            <text x={yNaa + 8} y={18} textAnchor="start" fontSize={13} fontWeight={700} letterSpacing=".10em" fill="var(--accent-text)">
              {`NOW ${naa}`}
            </text>
            <text x={yNaa - 10} y={17} textAnchor="end" fontSize={9} fontWeight={600} letterSpacing=".1em" fill="var(--ink-soft)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
              ALREADY HAPPENED
            </text>
            <text x={yNaa + 8} y={32} textAnchor="start" fontSize={9} fontWeight={600} letterSpacing=".1em" fill="var(--ink-soft)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
              STILL FICTION
            </text>
          </>
        ) : (
          <>
            <path d={`M 0 ${yNaa - 7} L 11 ${yNaa} L 0 ${yNaa + 7} Z`} fill="var(--accent)" />
            <text x={W - venstreX} y={yNaa - 7} textAnchor="end" fontSize={13} fontWeight={700} letterSpacing=".12em" fill="var(--accent-text)">
              {`NOW ${naa}`}
            </text>
            <text x={W - venstreX} y={yNaa - 21} textAnchor="end" fontSize={9} fontWeight={600} letterSpacing=".1em" fill="var(--ink-soft)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
              ALREADY HAPPENED
            </text>
            <text x={W - venstreX} y={yNaa + 17} textAnchor="end" fontSize={9} fontWeight={600} letterSpacing=".1em" fill="var(--ink-soft)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
              STILL FICTION
            </text>
          </>
        )}
      </g>
    </g>
  );
}

// memo: props er referanse-stabile mellom layout-cache-treff, så AkseLag slipper å
// gjenoppbygge alle ticks/epoker/ankere ved valgt/skuff/kort-toggles.
export default memo(AkseLag);
