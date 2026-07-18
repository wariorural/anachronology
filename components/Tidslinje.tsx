"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Verk, Anker, Medium } from "@/lib/typer";
import { lagSkala } from "@/lib/skala";
import { dodge } from "@/lib/dodge";
import { tikk } from "@/lib/haptikk";
import AkseLag from "./AkseLag";
import Spor from "./Spor";
import Kort from "./Kort";
import AarHud from "./AarHud";
import { fmtAar } from "@/lib/format";

interface Props {
  verk: Verk[];
  ankere: Anker[];
  /** NÅ-året fra bygget (SSR-startverdi) — friskes opp klientside ved mount. */
  naa: number;
}

// URL-slug av tittel — deep-link til ett verk (#blade-runner) så aha-øyeblikket
// kan deles. Diakritika strippes (Salò → salo).
function slugAv(tittel: string): string {
  return tittel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Layout-konstanter (px). Tett sone får pxPerAar·zoom; tomme strekk kollapses.
const PX_PER_AAR = 1;
const KOLLAPS_TERSKEL = 80;
const KOLLAPS_PX = 34;
const PAD_AAR = 8;

const VENSTRE = 44; // gutter for årsetiketter
const LANE0_X = VENSTRE + 20; // vertikal (mobil): der markør-banen starter (tvers = X)
const HOYRE_MARG = 28; // vertikal: hold banen klar av høyre marg (dekoblet fra VENSTRE)
const LANE_MAX = 320; // dodge-parameter (anti-overlapp langs tidsaksen)
const TOPP = 72; // vertikal: langs-akse start-pad (y)
const BUNN = 56; // vertikal: langs-akse slutt-pad
const MARKOR_R = 7;

// Horisontal (desktop): tidsaksen løper langs X. Langs-pad og tverr-gutters (Y).
const STARTX = 72; // langs-akse start-pad (x)
const SLUTT = 64; // langs-akse slutt-pad
const TOPP_CROSS = 86; // tverr-gutter over banene (NÅ + 3+3 rader kontekst-etiketter)
const BUNN_CROSS = 50; // tverr-gutter under banene (årstall)
// Desktop: klaring under etikett-båndet før markørbanen — så den ØVERSTE banens tittel
// (tegnes over markøren) ikke legger seg oppå oppfinnelse-etikettene.
const MARKOR_KLARING = 22;
const LANE0_Y = TOPP_CROSS + MARKOR_KLARING; // horisontal: der markør-banen starter (tvers = Y)

// Mobil: markør = liten Wikipedia-thumbnail. Bilder er brede → en y-rad rommer bare
// noen få før de overlapper; resten foldes til ett «+N»-merke (trykk = zoom inn).
const IMG_MOBIL = 30; // bilde-side (px)
const ROW_BUCKET = 32; // langs-bøtte: verk i samme bøtte = «samme rad»

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 12;
// CSS-mobilblokken er @media (max-width:430px) — mobil t.o.m. 430. JS må matche: mobil for
// W<431 (≤430), desktop for W≥431. Ellers gir W=430 (iPhone Pro Max/Plus) desktop-layout i JS
// men mobil-chrome i CSS = horisontal tidslinje uten titler.
const MOBIL_TERSKEL = 431;
const DESK_PITCH = 46; // desktop: ønsket avstand mellom baner (fyller høyden)

// Desktop-spredning: tverr-aksen bærer ingen mening (bare anti-overlapp), så vi sprer
// verkene over HELE høyden i stedet for å stable dem øverst. Hvert verk får en stabil
// «stjerne»-bane fra en hash av id-en, og nudges til nærmeste ledige bane så nabo-i-tid
// ikke overlapper. Deterministisk (ingen Math.random → stabil mellom renders).
function spreUtover(
  items: { id: string; y0: number; y1: number }[],
  baner: number,
  gap: number,
): Map<string, number> {
  const N = Math.max(1, baner);
  const sisteSlutt = new Array(N).fill(-Infinity); // siste y1 lagt i hver bane
  const ut = new Map<string, number>();
  for (const it of [...items].sort((a, b) => a.y0 - b.y0)) {
    let h = 2166136261; // FNV-1a
    for (let k = 0; k < it.id.length; k++) {
      h ^= it.id.charCodeAt(k);
      h = Math.imul(h, 16777619);
    }
    const mål = (h >>> 0) % N;
    let valgt = -1;
    for (let d = 0; d < N && valgt < 0; d++) {
      for (const bane of d === 0 ? [mål] : [mål + d, mål - d]) {
        if (bane >= 0 && bane < N && it.y0 - sisteSlutt[bane] >= gap) {
          valgt = bane;
          break;
        }
      }
    }
    if (valgt < 0) {
      // Alt opptatt (svært tett) → banen som ble ledig først.
      valgt = 0;
      for (let l = 1; l < N; l++) if (sisteSlutt[l] < sisteSlutt[valgt]) valgt = l;
    }
    ut.set(it.id, valgt);
    sisteSlutt[valgt] = it.y1;
  }
  return ut;
}

export default function Tidslinje({ verk, ankere, naa: naaBygg }: Props) {
  const [zoom, setZoom] = useState(2);
  const [modus, setModus] = useState<"elastisk" | "lineaer">("elastisk");
  const [valgt, setValgt] = useState<number | null>(null);
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);
  // NÅ friskes opp klientside: bygge-verdien blir ellers stående feil hver
  // 1. januar til noen tilfeldigvis redeployer — og NÅ-linja ER premisset.
  const [naa, setNaa] = useState(naaBygg);
  useEffect(() => {
    setNaa(new Date().getFullYear());
  }, []);
  // Mobil-FAB: peker mot NÅ relativt til viewport-sentrum (↑/↓), ikke en løgn.
  const [naaRetning, setNaaRetning] = useState<1 | -1>(1);
  // Engangs konsept-stripe (mobil) — setningen som bærer ideen, avvisbar.
  const [visIntro, setVisIntro] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("tm-intro-vekk")) setVisIntro(true);
    } catch {
      setVisIntro(true);
    }
  }, []);
  const lukkIntro = () => {
    setVisIntro(false);
    try {
      localStorage.setItem("tm-intro-vekk", "1");
    } catch {
      /* privat modus e.l. — stripa kommer bare igjen neste besøk */
    }
  };
  // Filtre: hvilke medier vises, og om virkeligheten (ankrene) vises. Aksen
  // bygges på nytt fra de synlige verkene, så filtrering omformer tidslinja.
  const [medier, setMedier] = useState<Record<Medium, boolean>>({
    film: true,
    bok: true,
    tv: true,
  });
  // Reality-lagene (ankere) filtreres hver for seg — mange faktorer, granulær kontroll.
  const [kat, setKat] = useState<Record<Anker["type"], boolean>>({
    hendelse: true,
    oppfinnelse: true,
    person: true,
    epoke: true,
  });
  // Mobil: legende + filtre + zoom ligger i en sammenleggbar skuff.
  const [skuffÅpen, setSkuffÅpen] = useState(false);
  // Skuffen legger seg over innhold → lukk med Escape (klikk-utenfor via backdrop).
  useEffect(() => {
    if (!skuffÅpen) return;
    const påTast = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSkuffÅpen(false);
    };
    document.addEventListener("keydown", påTast);
    return () => document.removeEventListener("keydown", påTast);
  }, [skuffÅpen]);
  // Roving tabindex: hvilken markør er tabbbar nå (null = bruk default, nærmest NÅ).
  const [fokusIdx, setFokusIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Settes når vi har scrollet til NÅ ved oppstart (kun én gang).
  const startetRef = useRef(false);
  // Ankring: ved zoom låser vi ett år til et viewport-punkt langs tidsaksen, og
  // gjenoppretter scroll etter re-render slik at året står stille (pinch/wheel naturlig).
  const ankerRef = useRef<{ aar: number; v: number } | null>(null);
  // Zoom-gester (pinch/wheel) coalesces til én oppdatering per frame → jevnere.
  const zoomRafRef = useRef<number | null>(null);
  const venterZoom = useRef<{ z: number; v: number } | null>(null);
  // Sentrum-året (oppdateres ved scroll) → gjenopprettes ved rotasjon/resize.
  const sentrumAarRef = useRef<number | null>(null);
  // Siste målte container-mål → skiller ekte resize fra no-op (unngår stale anker).
  const dimRef = useRef({ w: 0, h: 0 });
  // Årstall-HUD (mobil): oppdateres imperativt fra påScroll — se AarHud.tsx.
  const hudRef = useRef<HTMLDivElement>(null);
  const hudAarRef = useRef<HTMLSpanElement>(null);
  const hudKontekstRef = useRef<HTMLSpanElement>(null);
  const hudIdleRef = useRef<number | null>(null);

  // Mål container-størrelsen klientside (holdes klientside for å unngå hydration-sprik).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const oppdater = () => {
      const nyW = el.clientWidth;
      const nyH = el.clientHeight;
      if (nyW === dimRef.current.w && nyH === dimRef.current.h) return;
      const ekteEndring = dimRef.current.w !== 0;
      dimRef.current = { w: nyW, h: nyH };
      // Bevar året i sentrum når aksen bytter retning (rotasjon) eller containeren
      // endrer størrelse — uten dette blir gammel scrollTop meningsløs på ny akse.
      if (ekteEndring && startetRef.current && sentrumAarRef.current != null) {
        const nyVannrett = nyW >= MOBIL_TERSKEL;
        const nySyns = nyVannrett ? nyW : nyH;
        ankerRef.current = { aar: sentrumAarRef.current, v: nySyns / 2 };
      }
      setW(nyW);
      setH(nyH);
    };
    oppdater();
    const ro = new ResizeObserver(oppdater);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Orientering: mobil (smal) = vertikal tidslinje; desktop = horisontal.
  const kompakt = W > 0 && W < MOBIL_TERSKEL;
  const vannrett = W > 0 && W >= MOBIL_TERSKEL;
  // Start-pad langs tidsaksen (y vertikalt / x horisontalt).
  const OFFSET = vannrett ? STARTX : TOPP;

  // Landskap-telefon (lav høyde): de faste tverr-gutterne (108 topp + 50 bunn) spiser ~40 %
  // av høyden. Kontekst-etikettene fordeles egentlig nedover HELE kroppen, ikke i toppen — så
  // toppmargen holder bare NÅ-hodet og kan krympes. Gir markørbanene mer luft. Desktop uendret.
  const kortHoyde = vannrett && H > 0 && H < 500;
  const toppCross = kortHoyde ? 46 : LANE0_Y;
  const bunnCross = kortHoyde ? 40 : BUNN_CROSS;

  // Scroll/peker langs tidsaksen — abstrahert så samme logikk gjelder begge orienteringer.
  const lesScroll = (el: HTMLDivElement) => (vannrett ? el.scrollLeft : el.scrollTop);
  const settScroll = (el: HTMLDivElement, v: number) => {
    if (vannrett) el.scrollLeft = v;
    else el.scrollTop = v;
  };
  const synsLangs = (el: HTMLDivElement) => (vannrett ? el.clientWidth : el.clientHeight);
  const midtLangs = () => {
    const el = scrollRef.current;
    return el ? synsLangs(el) / 2 : 0;
  };

  const layout = useMemo(() => {
    // Bare synlige medier teller. Vi beholder ORIGINAL-indeksen (i) så kort-valg
    // og roving fortsatt peker rett inn i verk-lista.
    const vis = verk
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => medier[v.medium]);

    const erKompakt = W > 0 && W < MOBIL_TERSKEL;
    const erVannrett = W > 0 && W >= MOBIL_TERSKEL;

    // Aksen drives av FIKSJONEN — der verkene klumper seg får plass. Ankrene
    // (epoker) er bakteppe og holdes UTE av okkupert; ellers ville en lang epoke
    // som Romerriket blåst opp aksen lineært og drept komprimeringen. NÅ tas alltid
    // med så NÅ-linja sitter riktig selv om alle samtidsverk er filtrert bort.
    const okkupert = [
      { fra: naa, til: naa },
      ...vis.map(({ v }) => ({ fra: v.foregaarFra, til: v.foregaarTil })),
    ];
    const skala = lagSkala(okkupert, {
      modus,
      pxPerAar: PX_PER_AAR,
      zoom,
      kollapsTerskel: KOLLAPS_TERSKEL,
      kollapsPx: KOLLAPS_PX,
      pad: PAD_AAR,
    });

    // Anti-overlapp langs tidsaksen. Dodge gir MINIMALE baner — brukes på mobil (kolonne-
    // folding) og til å vite hvor mange baner en tett klynge trenger (dimensjonerer
    // desktop-spredningen så den aldri lager overlapp).
    const plassering = dodge(
      vis.map(({ v, i }) => ({
        id: String(i),
        y0: skala.yearToY(v.foregaarFra),
        y1: skala.yearToY(v.foregaarTil),
      })),
      // Større radius på mobil → bildene får egen bane og overlapper ikke.
      { radius: erKompakt ? 16 : MARKOR_R + 2, laneBredde: LANE_MAX, maxLanes: 40 },
    );

    let maxLane = 0;
    for (const p of plassering.values()) maxLane = Math.max(maxLane, p.lane);

    // Tverr-extent: horisontalt = høyden (minus gutters); vertikalt = bredden.
    const tverrEkst = erVannrett
      ? Math.max(0, (H || 700) - toppCross - bunnCross)
      : Math.max(0, (W || 1000) - LANE0_X - HOYRE_MARG);
    const baseTvers = erVannrett ? toppCross : LANE0_X;

    // Mobil: hold bildene IMG-store → fast antall kolonner; lanes utover foldes til «+N».
    const maxKol = erKompakt ? Math.max(1, Math.floor(tverrEkst / IMG_MOBIL)) : Infinity;
    // Desktop: spre verkene over hele høyden. Antall baner = nok til å fylle høyden, men
    // aldri færre enn en tett klynge krever (maxLane+1).
    const antBaner = Math.max(maxLane + 1, Math.floor(tverrEkst / DESK_PITCH) || 1);
    const spredning = erVannrett
      ? spreUtover(
          vis.map(({ v, i }) => ({
            id: String(i),
            y0: skala.yearToY(v.foregaarFra),
            y1: skala.yearToY(v.foregaarTil),
          })),
          antBaner,
          MARKOR_R * 2 + 6,
        )
      : null;
    const laneBredde = erKompakt
      ? tverrEkst / maxKol
      : tverrEkst / Math.max(antBaner - 1, 1);

    const langsTotal =
      (erVannrett ? STARTX : TOPP) + skala.hoyde + (erVannrett ? SLUTT : BUNN);

    const spor = vis.map(({ v, i }) => {
      // Desktop: spredt bane (fyller høyden); mobil: dodge-bane (kompakt, for folding).
      const lane = erVannrett
        ? spredning!.get(String(i))!
        : plassering.get(String(i))!.lane;
      const lng0 = skala.yearToY(v.foregaarFra); // posisjon langs tidsaksen
      const lng1 = skala.yearToY(v.foregaarTil);
      const tvers = baseTvers + lane * laneBredde;
      return {
        idx: i,
        verk: v,
        lane,
        lng0,
        // Skjerm-koordinater: langs-aksen mappes til X (horisontal) eller Y (vertikal).
        x: erVannrett ? lng0 : tvers,
        y: erVannrett ? tvers : lng0,
        x2: erVannrett ? lng1 : tvers,
        y2: erVannrett ? tvers : lng1,
        // Desktop: laget-årets akseposisjon → «tidshopp»-linja i Spor (hover/valg).
        lagetX:
          erVannrett && v.lagetAar != null
            ? skala.yearToY(v.lagetAar)
            : undefined,
        innhentet: v.foregaarFra <= naa,
        visTittel: true,
        bilde: v.bilde,
        visNavn: false, // mobil: horisontalt navn på den høyreste i raden (settes under)
        skjult: false, // mobil: foldet bak et «+N» (rendres ikke enkeltvis)
      };
    });

    // Tittel-declutter (langs tidsaksen, per bane): i tette klynger kolliderer titler.
    // Vis bare den som får plass i sin bane — resten hentes via hover/kort.
    const sistVistLangs = new Map<number, number>();
    for (const s of [...spor].sort((a, b) => a.lng0 - b.lng0)) {
      const len = Math.min(s.verk.tittel.length, 30) * 6 + 8; // px tittelen tar langs aksen
      const forrige = sistVistLangs.get(s.lane);
      if (forrige === undefined || s.lng0 - forrige >= len) {
        sistVistLangs.set(s.lane, s.lng0);
      } else {
        s.visTittel = false;
      }
    }

    // Mobil: gruppér verkene i rader (langs-bøtter), behold opptil maxKol bilder per rad
    // og fold resten til ETT «+N»-merke (trykk = zoom inn så raden sprer seg).
    type Pluss = { x: number; y: number; aar: number; n: number };
    const pluss: Pluss[] = [];
    if (erKompakt) {
      const rader = new Map<number, typeof spor>();
      for (const s of spor) {
        const b = Math.floor(s.lng0 / ROW_BUCKET);
        const arr = rader.get(b);
        if (arr) arr.push(s);
        else rader.set(b, [s]);
      }
      const kandidater: typeof spor = [];
      for (const medlemmer of rader.values()) {
        medlemmer.sort((a, b) => a.lane - b.lane);
        const foldet = medlemmer.filter((s) => s.lane >= maxKol);
        for (const s of foldet) s.skjult = true;
        const beholdt = medlemmer.filter((s) => s.lane < maxKol);
        const siste = beholdt[beholdt.length - 1];
        if (foldet.length && siste) {
          const lng = medlemmer.reduce((a, s) => a + s.lng0, 0) / medlemmer.length;
          pluss.push({
            x: Math.min(siste.x + laneBredde, W - HOYRE_MARG),
            y: lng,
            aar: skala.yToYear(lng),
            n: foldet.length,
          });
        }
        if (siste) kandidater.push(siste); // høyreste i raden = navne-kandidat
      }

      // Navn vises bare der det IKKE kolliderer med et annet bilde (cross-lane-sjekk).
      const synligeBilder = spor.filter((s) => !s.skjult);
      for (const k of kandidater) {
        const navnW = Math.min(k.verk.tittel.length, 22) * 6.3;
        const v0 = k.x + IMG_MOBIL / 2 + 6;
        const v1 = v0 + navnW;
        if (v1 > W - 6) continue; // ut over høyre kant
        const koll = synligeBilder.some(
          (o) =>
            o !== k &&
            o.x + IMG_MOBIL / 2 > v0 &&
            o.x - IMG_MOBIL / 2 < v1 &&
            Math.abs(o.lng0 - k.lng0) < IMG_MOBIL / 2 + 9,
        );
        if (!koll) k.visNavn = true;
      }
    }

    // Tidsorden for pil-tast-roving: nabo i tid blant SYNLIGE verk, via original-idx.
    const synlige = erKompakt ? spor.filter((s) => !s.skjult) : spor;
    const tidsorden = [...synlige].sort((a, b) => a.lng0 - b.lng0).map((s) => s.idx);
    const nabo = new Map<number, { opp: number; ned: number }>();
    tidsorden.forEach((idx, pos) => {
      nabo.set(idx, {
        opp: tidsorden[Math.max(0, pos - 1)],
        ned: tidsorden[Math.min(tidsorden.length - 1, pos + 1)],
      });
    });

    // Roving tabindex: ÉN markør er tabbbar av gangen (default = nærmest NÅ, der viewet
    // starter). Uten dette ville alle ~99 markørene ligget i tab-sekvensen samtidig.
    const yNaaLangs = skala.yearToY(naa);
    let naaIdx: number | null = null;
    let beste = Infinity;
    for (const s of synlige) {
      const d = Math.abs(s.lng0 - yNaaLangs);
      if (d < beste) {
        beste = d;
        naaIdx = s.idx;
      }
    }

    return { skala, langsTotal, spor, nabo, pluss, naaIdx };
  }, [zoom, modus, verk, naa, W, H, medier, toppCross, bunnCross]);

  // Den ENE tabbbare markøren: fokusIdx hvis fortsatt synlig, ellers default (nærmest NÅ).
  const synligeIdx = useMemo(
    () => new Set(layout.spor.filter((s) => !s.skjult).map((s) => s.idx)),
    [layout],
  );
  const tabbarIdx =
    fokusIdx != null && synligeIdx.has(fokusIdx) ? fokusIdx : layout.naaIdx;

  // Reality-lag: bare påslåtte kategorier. Memo → referanse-stabil for memo(AkseLag).
  const synligeAnkere = useMemo(
    () => ankere.filter((a) => kat[a.type]),
    [ankere, kat],
  );

  // Epoker sortert for HUD-ens kontekstlinje (~20 stk → lineært søk per frame er gratis).
  const epoker = useMemo(
    () =>
      ankere
        .filter((a) => a.type === "epoke")
        .sort((a, b) => a.fra - b.fra),
    [ankere],
  );

  // "Sann avstand" (lineær) kollapser IKKE tomrom, så hele spennet (−80000→20000)
  // blir fysisk lerret. Ticks per segment er kappet i AkseLag, så taket her handler
  // om total px-lengde (scroll-ytelse/presisjon) — budsjettet gir levende zoom i
  // lineær modus i stedet for en død slider (min == maks med gamle tick-formelen).
  const spennAar = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of verk) {
      min = Math.min(min, v.foregaarFra);
      max = Math.max(max, v.foregaarTil);
    }
    return max - min + 2 * PAD_AAR;
  }, [verk]);
  const MAKS_PX_LINEAER = 2_000_000;
  const zoomMaksLineaer = Math.max(
    ZOOM_MIN,
    Math.min(ZOOM_MAX, MAKS_PX_LINEAER / (spennAar * PX_PER_AAR)),
  );
  const zoomMaks = modus === "lineaer" ? zoomMaksLineaer : ZOOM_MAX;

  // Gjenopprett ankret år etter zoom-re-render (året står stille under finger/peker).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = ankerRef.current;
    if (!el || !a) return;
    ankerRef.current = null;
    settScroll(el, OFFSET + layout.skala.yearToY(a.aar) - a.v);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start scrollet ved NÅ (én gang, når størrelsen er kjent) — brukeren møter straks
  // juxtaposisjonen: noen framtider er innhentet, andre ikke. Oppdagelse > forklaring.
  // Deep-link (#blade-runner) overstyrer: sentrer verkets år og åpne kortet.
  useLayoutEffect(() => {
    if (startetRef.current || W === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    startetRef.current = true;
    let startAar = naa;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      const idx = verk.findIndex((v) => slugAv(v.tittel) === hash);
      if (idx >= 0) {
        startAar = verk[idx].foregaarFra;
        setValgt(idx);
      }
    }
    settScroll(el, OFFSET + layout.skala.yearToY(startAar) - synsLangs(el) / 2);
  }, [W, H, layout, naa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Speil valgt verk i URL-hash (replaceState — ingen history-spam) så et funn
  // («Metropolis er satt i 2026 — i år!») kan sendes som lenke.
  useEffect(() => {
    if (!startetRef.current) return;
    const url =
      valgt != null
        ? `#${slugAv(verk[valgt].tittel)}`
        : window.location.pathname + window.location.search;
    history.replaceState(null, "", url);
  }, [valgt, verk]);

  // HUD-en (mobil) skrives rett i DOM — scroll skal aldri re-rendre SVG-treet.
  const oppdaterHud = useCallback(
    (sentrum: number) => {
      const aarEl = hudAarRef.current;
      const kontekstEl = hudKontekstRef.current;
      if (!aarEl || !kontekstEl) return;
      const rundet = Math.round(sentrum);
      aarEl.textContent = fmtAar(rundet);
      const epoke = epoker.find((e) => rundet >= e.fra && rundet <= e.til);
      if (epoke) kontekstEl.textContent = epoke.tittel;
      else {
        const diff = rundet - naa;
        kontekstEl.textContent =
          diff === 0
            ? "Now"
            : diff > 0
              ? `Now +${fmtAar(diff)} yrs`
              : `Now −${fmtAar(-diff)} yrs`;
      }
      // Våkn ved scroll; dimmes etter 900 ms ro (CSS-transition tar resten).
      const hud = hudRef.current;
      if (hud) {
        hud.removeAttribute("data-idle");
        if (hudIdleRef.current != null) window.clearTimeout(hudIdleRef.current);
        hudIdleRef.current = window.setTimeout(() => {
          hud.setAttribute("data-idle", "true");
        }, 900);
      }
    },
    [epoker, naa],
  );

  // Startverdi + oppdatering ved layout-endring (zoom/filter/rotasjon) — scroll-
  // eventet fyrer ikke nødvendigvis da, men sentrum-året kan ha fått ny kontekst.
  useEffect(() => {
    if (kompakt && startetRef.current) {
      oppdaterHud(sentrumAarRef.current ?? naa);
    }
  }, [kompakt, layout, naa, oppdaterHud]);

  // Spor sentrum-året kontinuerlig så rotasjon/resize kan re-sentrere det (over).
  const påScroll = () => {
    const el = scrollRef.current;
    if (!el || !startetRef.current) return;
    const sentrum = layout.skala.yToYear(
      lesScroll(el) + synsLangs(el) / 2 - OFFSET,
    );
    sentrumAarRef.current = sentrum;
    if (kompakt) oppdaterHud(sentrum);
    // FAB-pila: NÅ ligger mot framtida (ned/høyre) når sentrum er i fortida.
    const retning = sentrum <= naa ? 1 : -1;
    if (retning !== naaRetning) setNaaRetning(retning);
  };

  // Zoom ankret i et viewport-punkt langs tidsaksen (vLangs = px fra start-kanten).
  const zoomTil = useCallback(
    (nyZoom: number, vLangs: number) => {
      const el = scrollRef.current;
      const z = Math.max(ZOOM_MIN, Math.min(zoomMaks, +nyZoom.toFixed(3)));
      // Kun når zoom FAKTISK endres — ellers bailer setZoom(z) (ingen re-render), effekten
      // som forbruker+nullstiller ankeret kjører ikke, og et stale anker ville gitt et
      // scroll-hopp ved neste layout-endring (f.eks. filter-toggle).
      if (el && z !== zoom) {
        const scrollPos = vannrett ? el.scrollLeft : el.scrollTop;
        const innhold = scrollPos + vLangs - OFFSET;
        ankerRef.current = { aar: layout.skala.yToYear(innhold), v: vLangs };
      }
      setZoom(z);
    },
    [layout, zoomMaks, vannrett, OFFSET, zoom],
  );

  // Coalesce zoom-oppdateringer: én setZoom per animasjonsramme uansett hvor ofte
  // pointermove/wheel fyrer (ProMotion = 120 Hz) → re-render følger skjermens takt.
  const planleggZoom = useCallback(
    (z: number, v: number) => {
      venterZoom.current = { z, v };
      if (zoomRafRef.current == null) {
        zoomRafRef.current = requestAnimationFrame(() => {
          zoomRafRef.current = null;
          const p = venterZoom.current;
          if (p) zoomTil(p.z, p.v);
        });
      }
    },
    [zoomTil],
  );

  useEffect(
    () => () => {
      if (zoomRafRef.current != null) cancelAnimationFrame(zoomRafRef.current);
    },
    [],
  );

  // Bytt modus; klem zoom under lineær-taket først så vi aldri rendrer for mange streker.
  // Anker sentrum-året i BEGGE retninger — uten det lander viewporten på et
  // vilkårlig år og modusbyttet føles som havari, ikke innsikt.
  const byttModus = () => {
    const el = scrollRef.current;
    if (el) {
      const midt = synsLangs(el) / 2;
      ankerRef.current = {
        aar: layout.skala.yToYear(lesScroll(el) + midt - OFFSET),
        v: midt,
      };
    }
    const ny = modus === "elastisk" ? "lineaer" : "elastisk";
    if (ny === "lineaer" && zoom > zoomMaksLineaer) {
      zoomTil(zoomMaksLineaer, midtLangs());
    }
    setModus(ny);
  };

  // Les zoom + planleggZoom via refs i wheel-listeneren. Begge skifter identitet hver
  // zoom-frame (layout rebuildes), så uten refs ville listeneren blitt revet ned og satt
  // opp på nytt 60–120 ganger/sek under pinch/hjul-zoom.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const planleggZoomRef = useRef(planleggZoom);
  planleggZoomRef.current = planleggZoom;

  // Trackpad-pinch sender wheel med ctrlKey → zoom. Desktop: vanlig hjul → horisontal scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey) {
        e.preventDefault();
        const vLangs = vannrett ? e.clientX - rect.left : e.clientY - rect.top;
        planleggZoomRef.current(zoomRef.current * Math.exp(-e.deltaY * 0.01), vLangs);
        return;
      }
      // Horisontal tidslinje: la vanlig (vertikalt) hjul rulle langs aksen.
      if (vannrett && e.deltaX === 0 && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [vannrett]);

  // Touch-pinch: to fingre → forhold mellom avstandene skalerer zoom, ankret i midtpunktet.
  const pekere = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const pekerNed = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pekere.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pekere.current.size === 2) {
      const [a, b] = [...pekere.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const pekerFlytt = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || !pekere.current.has(e.pointerId)) return;
    pekere.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pekere.current.size === 2 && pinch.current) {
      const el = scrollRef.current!;
      const rect = el.getBoundingClientRect();
      const [a, b] = [...pekere.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midt = vannrett
        ? (a.x + b.x) / 2 - rect.left
        : (a.y + b.y) / 2 - rect.top;
      planleggZoom(pinch.current.zoom * (dist / pinch.current.dist), midt);
    }
  };
  const pekerOpp = (e: React.PointerEvent) => {
    pekere.current.delete(e.pointerId);
    if (pekere.current.size < 2) pinch.current = null;
  };

  // Hopp til NÅ — orientering når man har scrollet langt.
  const hoppTilNaa = () => {
    const el = scrollRef.current;
    if (!el) return;
    tikk();
    const mål = OFFSET + layout.skala.yearToY(naa) - synsLangs(el) / 2;
    const glatt = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const opts: ScrollToOptions = { behavior: glatt ? "smooth" : "auto" };
    if (vannrett) el.scrollTo({ left: mål, ...opts });
    else el.scrollTo({ top: mål, ...opts });
  };

  // «+N» (mobil): zoom inn og sentrer båndets år, så de foldede verkene sprer seg.
  const spreUt = (aar: number) => {
    const el = scrollRef.current;
    if (!el) return;
    tikk();
    ankerRef.current = { aar, v: synsLangs(el) / 2 };
    setZoom((z) => Math.min(zoomMaks, +(z * 2.2).toFixed(3)));
  };

  // Piltaster flytter fokus til forrige/neste markør i tid (roving): ←/→ desktop, ↑/↓ mobil.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const forrigeTast = vannrett ? "ArrowLeft" : "ArrowUp";
    const nesteTast = vannrett ? "ArrowRight" : "ArrowDown";
    if (e.key !== forrigeTast && e.key !== nesteTast) return;
    const akt = document.activeElement as HTMLElement | null;
    if (!akt?.classList.contains("spor")) return;
    const i = Number(akt.getAttribute("data-i"));
    const n = layout.nabo.get(i);
    if (!n) return;
    e.preventDefault();
    const mål = e.key === forrigeTast ? n.opp : n.ned;
    setFokusIdx(mål); // flytt roving-fokuset (tabIndex følger med)
    scrollRef.current
      ?.querySelector<SVGGElement>(`.spor[data-i="${mål}"]`)
      ?.focus();
  };

  // Lukk kortet og returner fokus til markøren som åpnet det (ikke bryt roving).
  const lukkKort = () => {
    const forrige = valgt;
    setValgt(null);
    if (forrige != null) {
      requestAnimationFrame(() =>
        scrollRef.current
          ?.querySelector<SVGGElement>(`.spor[data-i="${forrige}"]`)
          ?.focus(),
      );
    }
  };

  const toggleMedium = (m: Medium) =>
    setMedier((s) => ({ ...s, [m]: !s[m] }));
  const toggleKat = (k: Anker["type"]) =>
    setKat((s) => ({ ...s, [k]: !s[k] }));

  // Liten form-glyf per medium (samme språk som markørene), farget av currentColor
  // så chippen kan dempes når mediet er skrudd av.
  const formIkon = (m: Medium) => {
    switch (m) {
      case "bok":
        return <circle cx="6.5" cy="6.5" r="4.5" fill="currentColor" />;
      case "tv":
        return (
          <g>
            <rect x="2" y="2" width="9" height="9" fill="currentColor" />
            {/* --chip-bg: delelinja må kontrastere fyllet også på PÅ-chip (blekk) */}
            <line x1="2" y1="6.5" x2="11" y2="6.5" stroke="var(--chip-bg)" strokeWidth="1.8" />
          </g>
        );
      default: // film
        return <rect x="2" y="2" width="9" height="9" fill="currentColor" />;
    }
  };
  const medieNavn: [Medium, string][] = [
    ["film", "film"],
    ["bok", "book"],
    ["tv", "TV"],
  ];
  // Kategori-glyf (reality-lagene), farget av currentColor → dempes når av.
  const katIkon = (k: Anker["type"]) => {
    switch (k) {
      case "hendelse":
        return <line x1="7.5" y1="1" x2="7.5" y2="12" stroke="currentColor" strokeWidth="1.6" />;
      case "oppfinnelse":
        return <text x="7.5" y="11" textAnchor="middle" fontSize="12" fill="currentColor">★</text>;
      case "person":
        return <rect x="1" y="4" width="13" height="5" rx="2.5" fill="currentColor" opacity="0.55" />;
      default: // epoke
        return <rect x="1" y="2.5" width="13" height="8" rx="2" fill="currentColor" opacity="0.35" />;
    }
  };
  const katNavn: [Anker["type"], string][] = [
    ["hendelse", "events"],
    ["oppfinnelse", "inventions"],
    ["person", "people"],
    ["epoke", "eras"],
  ];

  // SVG-dimensjoner: tidsaksen er X (horisontal) eller Y (vertikal).
  const svgW = vannrett ? layout.langsTotal : W;
  const svgH = vannrett ? H : layout.langsTotal;
  const wrap = vannrett ? `translate(${STARTX}, 0)` : `translate(0, ${TOPP})`;
  const klar = W > 0 && (!vannrett || H > 0);

  return (
    <div className="tm-app" data-vannrett={vannrett}>
      <header className="tm-header">
        <div className="tm-bar">
          <div className="tm-brand">
            <h1>Anachronology</h1>
            <span className="tm-dek">
              {modus === "lineaer"
                ? "True distances — empty centuries no longer compressed"
                : "Fiction placed by the year it's set in, against real history"}
            </span>
            <span className="tm-count">{verk.length} works</span>
          </div>
          <div className="tm-controls">
            <button type="button" className="tm-naa" onClick={hoppTilNaa}>
              Jump to NOW
            </button>
            <span className="tm-zoom-merke">Zoom</span>
            <button
              type="button"
              className="tm-zoom-btn"
              aria-label="Zoom out"
              onClick={() => zoomTil(zoom / 1.4, midtLangs())}
            >
              −
            </button>
            <input
              className="tm-zoom-slider"
              type="range"
              min={ZOOM_MIN}
              max={zoomMaks}
              step={0.1}
              value={zoom}
              aria-label="Zoom"
              aria-valuetext={`${zoom.toFixed(1)}× zoom`}
              onChange={(e) => zoomTil(+e.target.value, midtLangs())}
            />
            <button
              type="button"
              className="tm-zoom-btn"
              aria-label="Zoom in"
              onClick={() => zoomTil(zoom * 1.4, midtLangs())}
            >
              +
            </button>
            <button
              type="button"
              className="tm-toggle"
              aria-pressed={modus === "lineaer"}
              onClick={byttModus}
              title="Show true distances in time (outliers dominate)"
            >
              True time
              <span className="sr-only">
                {" "}
                — linear scale; empty stretches of time are no longer compressed
              </span>
            </button>
            <button
              type="button"
              className="tm-skuff-knapp"
              aria-expanded={skuffÅpen}
              aria-controls="tm-skuff"
              aria-label="Legend & filters"
              onClick={() => setSkuffÅpen((o) => !o)}
            >
              <svg width="17" height="15" aria-hidden="true">
                <circle cx="3" cy="4" r="2" fill="currentColor" />
                <line x1="7" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.6" />
                <rect x="1" y="9" width="4" height="4" fill="currentColor" />
                <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span aria-hidden="true">{skuffÅpen ? "▴" : "▾"}</span>
            </button>
          </div>
        </div>
        <div id="tm-skuff" className="tm-skuff" data-open={skuffÅpen}>
        <ul className="tm-legend" aria-label="Legend">
          <li>
            <svg width="13" height="13" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" fill="var(--ink)" />
            </svg>
            book
          </li>
          <li>
            <svg width="13" height="13" aria-hidden="true">
              <rect x="2" y="2" width="9" height="9" fill="var(--ink)" />
            </svg>
            film
          </li>
          {kompakt ? (
            // Mobil-markører er thumbnails — før/etter NÅ bæres av rammefargen,
            // så legenden må lære bort koden som faktisk brukes på denne skjermen.
            <li>
              <svg width="13" height="13" aria-hidden="true">
                <rect x="2.5" y="2.5" width="8" height="8" rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
              </svg>
              orange frame = set after NOW
            </li>
          ) : (
            <li>
              <svg width="13" height="13" aria-hidden="true">
                <rect x="2.5" y="2.5" width="8" height="8" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
              </svg>
              filled = before NOW · hollow = after NOW
            </li>
          )}
          <li>
            <svg width="13" height="13" aria-hidden="true">
              <line x1="6.5" y1="1.5" x2="6.5" y2="11.5" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            line = time span
          </li>
          <li>
            <svg width="15" height="13" aria-hidden="true">
              <line x1="0" y1="6.5" x2="15" y2="6.5" stroke="var(--accent)" strokeWidth="2.5" />
            </svg>
            NOW
          </li>
          <li>
            <svg width="15" height="13" aria-hidden="true">
              <rect x="0" y="4" width="15" height="5" rx="2.5" fill="var(--ink-soft)" opacity="0.28" />
            </svg>
            person = lifespan
          </li>
        </ul>
        <div className="tm-filter" role="group" aria-label="Filter">
          <span className="tm-filter-merke">Show</span>
          {medieNavn.map(([m, navn]) => (
            <button
              key={m}
              type="button"
              className="tm-chip"
              aria-pressed={medier[m]}
              onClick={() => toggleMedium(m)}
            >
              <svg width="13" height="13" aria-hidden="true">
                {formIkon(m)}
              </svg>
              {navn}
            </button>
          ))}
          {katNavn.map(([k, navn]) => (
            <button
              key={k}
              type="button"
              className="tm-chip"
              aria-pressed={kat[k]}
              onClick={() => toggleKat(k)}
            >
              <svg width="15" height="13" aria-hidden="true">
                {katIkon(k)}
              </svg>
              {navn}
            </button>
          ))}
        </div>
        </div>
      </header>

      {skuffÅpen && (
        <div
          className="tm-skuff-backdrop"
          aria-hidden="true"
          onClick={() => setSkuffÅpen(false)}
        />
      )}

      {/* Mobil: undertittel + antall er skjult i header — men konseptet MÅ sies
          der discovery-trafikken lander. Én setning, avvises én gang. */}
      {kompakt && visIntro && (
        <div className="tm-intro" role="note">
          <span>
            Fiction placed by the year it&apos;s <em>set</em> in — not when it
            was made.
          </span>
          <button type="button" aria-label="Dismiss" onClick={lukkIntro}>
            ×
          </button>
        </div>
      )}

      {/* Tidslinjas tekstlige sammendrag — SVG-en er ellers geometri uten
          fortelling for skjermlesere. */}
      <p className="sr-only">
        {`${verk.length} works of fiction placed by the year they are set in, `}
        {`against real history. The NOW line is ${naa}: `}
        {`${verk.filter((v) => v.foregaarFra <= naa).length} works are set in years reality has reached, `}
        {`${verk.filter((v) => v.foregaarFra > naa).length} in futures still ahead. `}
        Tab moves into the timeline; arrow keys step between works in time
        order; Enter opens details.
      </p>

      <div
        className="tm-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Timeline (scrollable)"
        onScroll={påScroll}
        onPointerDown={pekerNed}
        onPointerMove={pekerFlytt}
        onPointerUp={pekerOpp}
        onPointerCancel={pekerOpp}
        onKeyDown={onKeyDown}
      >
        {/* SSR/første maling: W===0 på server → skjelettet ligger i HTML-en og
            maler papir + akse + NÅ-linje umiddelbart, til målingen er klar. */}
        {!klar && (
          <div className="tm-skjelett" aria-hidden="true">
            <div className="tm-skjelett-akse" />
            <div className="tm-skjelett-tick" style={{ top: "18%" }} />
            <div className="tm-skjelett-tick" style={{ top: "38%" }} />
            <div className="tm-skjelett-tick" style={{ top: "62%" }} />
            <div className="tm-skjelett-tick" style={{ top: "82%" }} />
            <div className="tm-skjelett-naa">
              <span>NOW</span>
            </div>
          </div>
        )}
        {klar && (
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            role="group"
            aria-label="Timeline: fiction placed by the year it's set in, against real history and a NOW line."
          >
            <g transform={wrap}>
              <AkseLag
                skala={layout.skala}
                ankere={synligeAnkere}
                venstreX={VENSTRE}
                W={W}
                H={H}
                naa={naa}
                toppCross={toppCross}
                bunnCross={bunnCross}
                kompakt={kompakt}
                vannrett={vannrett}
              />
              {/* Valgt spor rendres SIST → ring + tittel havner øverst. */}
              {(valgt == null
                ? layout.spor
                : [...layout.spor].sort(
                    (a, b) =>
                      (a.idx === valgt ? 1 : 0) - (b.idx === valgt ? 1 : 0),
                  )
              )
                .filter((s) => !s.skjult || s.idx === valgt)
                .map(({ lane: _lane, skjult: _skjult, lng0: _lng0, idx, ...s }) => (
                  <Spor
                    key={idx}
                    {...s}
                    r={MARKOR_R}
                    bildeStr={IMG_MOBIL}
                    dataI={idx}
                    W={W}
                    kompakt={kompakt}
                    erValgt={idx === valgt}
                    tabbar={idx === tabbarIdx}
                    onFokus={() => setFokusIdx(idx)}
                    onVelg={() => {
                      tikk();
                      setValgt(idx);
                    }}
                  />
                ))}
              {/* «+N» (mobil): foldede verk i en tett rad — trykk zoomer inn og sprer dem */}
              {kompakt &&
                layout.pluss.map((p, i) => (
                  <g
                    key={`pluss-${i}`}
                    className="tm-plus"
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.n} more works here – tap to zoom in`}
                    onClick={() => spreUt(p.aar)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        spreUt(p.aar);
                      }
                    }}
                  >
                    {/* usynlig ≥24px treffområde (WCAG target size) */}
                    <rect x={p.x - 16} y={p.y - 14} width={32} height={28} fill="transparent" />
                    <rect x={p.x - 13} y={p.y - 9} width={26} height={18} rx={9} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle">
                      +{p.n}
                    </text>
                  </g>
                ))}
            </g>
          </svg>
        )}
        {W > 0 && layout.spor.length === 0 && (
          <p className="tm-tom" role="status">
            Nothing to show — turn film, book or TV back on.
          </p>
        )}
      </div>

      <AarHud hudRef={hudRef} aarRef={hudAarRef} kontekstRef={hudKontekstRef} />

      <button
        type="button"
        className="tm-fab"
        onClick={hoppTilNaa}
        aria-label="Jump to NOW"
      >
        NOW {naaRetning === 1 ? "↓" : "↑"}
      </button>

      <Kort
        verk={valgt != null ? verk[valgt] : null}
        naa={naa}
        onLukk={lukkKort}
      />
    </div>
  );
}
