"use client";

// CHRONOSCOPE — «The Observatory»: hvert verk er en lysbue fra året det ble
// laget til året det foregår. Profetier buer over aksen, minner under; den
// hvite NÅ-slissen skjærer hver bue i rav (fortid) og fosfor-cyan (framtid).
// Ekstra view på /chronoscope — papirutgaven på / er urørt og fullverdig.
// Geometrien bor i lib/chrono.ts (ren + testet); dette er render + interaksjon.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Verk, Anker } from "@/lib/typer";
import { lagSkala } from "@/lib/skala";
import { temporalitet, sprang, bueHoyde, slicePunkt, tellere } from "@/lib/chrono";
import { fmtAar, fmtGap } from "@/lib/format";
import { tikk } from "@/lib/haptikk";
import ChronoKort from "./ChronoKort";

interface Props {
  verk: Verk[];
  ankere: Anker[];
  naa: number;
}

const MOBIL_TERSKEL = 431;
const PX_PER_AAR = 1.1;
const KOLLAPS_TERSKEL = 80;
const KOLLAPS_PX = 40;

// Deterministisk 0..1 per tittel (FNV-1a) — sprer buer som ellers klemmes mot
// samme makshøyde, så tette klynger vifter ut i stedet for å tvinne seg.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export default function Chronoscope({ verk, ankere, naa: naaBygg }: Props) {
  const [naa, setNaa] = useState(naaBygg);
  useEffect(() => setNaa(new Date().getFullYear()), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);
  const [zoom, setZoom] = useState(2.4);
  const [valgt, setValgt] = useState<number | null>(null);
  const [fokusIdx, setFokusIdx] = useState<number | null>(null);
  const [naaRetning, setNaaRetning] = useState<1 | -1>(1);
  const startetRef = useRef(false);
  // Zoom-ankring (samme mønster som paper-utgaven): lås ett ÅR til et
  // viewport-punkt før zoom, gjenopprett scroll etter re-layout — uten dette
  // står scroll-posisjonen i px mens innholdet vokser, og man drifter mot
  // scenens start (dyp fortid).
  const ankerRef = useRef<{ aar: number; v: number } | null>(null);
  // Pinch/wheel coalesces til én oppdatering per frame.
  const pekere = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ avstand: number; zoom: number } | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  const venterZoom = useRef<{ z: number; v: number } | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const oppdater = () => {
      setW(el.clientWidth);
      setH(el.clientHeight);
    };
    oppdater();
    const ro = new ResizeObserver(oppdater);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vannrett = W >= MOBIL_TERSKEL;
  const klar = W > 0 && H > 0;

  // Aksen må romme BEGGE bue-endene (laget + foregår), ellers lander buer
  // utenfor kartet. NÅ ankres alltid.
  const layout = useMemo(() => {
    const okkupert: { fra: number; til: number }[] = [{ fra: naa, til: naa }];
    for (const v of verk) {
      const lo = Math.min(v.foregaarFra, v.lagetAar ?? v.foregaarFra);
      const hi = Math.max(v.foregaarTil, v.lagetAar ?? v.foregaarTil);
      okkupert.push({ fra: lo, til: hi });
    }
    const skala = lagSkala(okkupert, {
      modus: "elastisk",
      pxPerAar: PX_PER_AAR,
      zoom,
      kollapsTerskel: KOLLAPS_TERSKEL,
      kollapsPx: KOLLAPS_PX,
      pad: 10,
    });

    const OFFSET = vannrett ? 90 : 80;
    const SLUTT = vannrett ? 80 : 90;
    const L = (aar: number) => OFFSET + skala.yearToY(aar);
    const pNaa = L(naa);
    const total = OFFSET + skala.hoyde + SLUTT;

    // Tverr-geometri: desktop har to halvdeler (profeti over / minne under);
    // mobil bøyer alt mot høyre fra en venstre-spine.
    const akse = vannrett ? Math.round(H * 0.6) : 74;
    const maksOver = vannrett ? akse - 92 : Math.max(120, W - akse - 46);
    const maksUnder = vannrett ? H - akse - 64 : maksOver;

    type Bue = {
      idx: number;
      v: Verk;
      t: ReturnType<typeof temporalitet>;
      p0: number; // laget-årets akseposisjon
      p1: number; // foregår-endens akseposisjon (nærmeste spennkant)
      s0: number; // spennets start
      s1: number; // spennets slutt
      d: string; // path (kun buer)
      cut: number | null; // NÅ-slice 0..1 langs lo→hi
      framtid: boolean; // hele buen etter NÅ
      gap: number;
      h: number; // buehøyde (m/viftespredning) — også etikettposisjon
    };
    const buer: Bue[] = verk.map((v, idx) => {
      const t = temporalitet(v);
      const s0 = L(v.foregaarFra);
      const s1 = L(v.foregaarTil);
      const land = t === "minne" ? v.foregaarTil : v.foregaarFra;
      const p0 = L(v.lagetAar ?? land);
      const p1 = L(land);
      const gap = sprang(v);
      let d = "";
      let h = 0;
      if (t !== "samtid") {
        const maks = t === "profeti" || !vannrett ? maksOver : maksUnder;
        // Egenhøyde: viftespredning for klyngene som ellers deler klemt maks.
        h = bueHoyde(gap, maks * (0.55 + 0.45 * hash01(v.tittel)));
        const over = t === "profeti";
        d = vannrett
          ? `M ${p0} ${akse} Q ${(p0 + p1) / 2} ${akse + (over ? -h : h)} ${p1} ${akse}`
          : `M ${akse} ${p0} Q ${akse + h} ${(p0 + p1) / 2} ${akse} ${p1}`;
      }
      const lo = Math.min(p0, s0);
      const hi = Math.max(p1, s1, p0);
      return {
        idx,
        v,
        t,
        p0,
        p1,
        s0,
        s1,
        d,
        cut: slicePunkt(lo, hi, pNaa),
        framtid: Math.min(v.foregaarFra, v.lagetAar ?? v.foregaarFra) > naa,
        gap,
        h,
      };
    });

    // Tidsorden for pil-tast-roving + default fokus nærmest NÅ.
    const orden = [...buer].sort((a, b) => a.p1 - b.p1).map((b) => b.idx);
    let naaIdx = orden[0] ?? null;
    let beste = Infinity;
    for (const b of buer) {
      const dd = Math.abs(b.p1 - pNaa);
      if (dd < beste) {
        beste = dd;
        naaIdx = b.idx;
      }
    }

    return { skala, L, pNaa, total, akse, buer, orden, naaIdx, offset: OFFSET };
  }, [verk, naa, zoom, W, H, vannrett]);

  // Orienterings-abstraksjon for scroll langs tidsaksen.
  const lesScroll = (el: HTMLElement) => (vannrett ? el.scrollLeft : el.scrollTop);
  const settScroll = (el: HTMLElement, p: number) => {
    if (vannrett) el.scrollLeft = p;
    else el.scrollTop = p;
  };
  const synsLangs = (el: HTMLElement) => (vannrett ? el.clientWidth : el.clientHeight);

  // Ankret zoom: året i vLangs (px fra viewport-start) skal stå stille.
  const zoomTil = (nyZoom: number, vLangs: number) => {
    const el = scrollRef.current;
    const z = Math.max(0.5, Math.min(10, +nyZoom.toFixed(3)));
    if (el && z !== zoom) {
      const innhold = lesScroll(el) + vLangs - layout.offset;
      ankerRef.current = { aar: layout.skala.yToYear(innhold), v: vLangs };
    }
    setZoom(z);
  };

  const planleggZoom = (z: number, v: number) => {
    venterZoom.current = { z, v };
    if (zoomRafRef.current == null) {
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = null;
        const p = venterZoom.current;
        if (p) zoomTil(p.z, p.v);
      });
    }
  };

  // Gjenopprett anker-året etter re-layout (zoom endret skalaen).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anker = ankerRef.current;
    if (!el || !anker) return;
    ankerRef.current = null;
    settScroll(el, layout.offset + layout.skala.yearToY(anker.aar) - anker.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Start sentrert på NÅ.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !klar || startetRef.current) return;
    startetRef.current = true;
    const mål = layout.pNaa - (vannrett ? W : H) / 2;
    if (vannrett) el.scrollLeft = mål;
    else el.scrollTop = mål;
  }, [klar, layout, vannrett, W, H]);

  const { innhentet, gjenstaar } = useMemo(() => tellere(verk, naa), [verk, naa]);

  // Roving: én tabbbar bue; piler vandrer i foregår-års-orden.
  const tabbar = fokusIdx ?? layout.naaIdx;
  const onKeyDown = (e: React.KeyboardEvent) => {
    const frem = vannrett ? "ArrowRight" : "ArrowDown";
    const bak = vannrett ? "ArrowLeft" : "ArrowUp";
    if (e.key !== frem && e.key !== bak) return;
    const akt = document.activeElement as HTMLElement | null;
    if (!akt?.classList.contains("cs-bue")) return;
    e.preventDefault();
    const i = Number(akt.getAttribute("data-i"));
    const pos = layout.orden.indexOf(i);
    const ny =
      layout.orden[
        Math.max(0, Math.min(layout.orden.length - 1, pos + (e.key === frem ? 1 : -1)))
      ];
    setFokusIdx(ny);
    scrollRef.current
      ?.querySelector<SVGGElement>(`.cs-bue[data-i="${ny}"]`)
      ?.focus();
  };

  const velg = (idx: number) => {
    tikk();
    setValgt(idx);
  };

  // NÅ-orientering: FAB-pila peker mot NÅ relativt til viewport-senteret.
  const påScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const sentrum = lesScroll(el) + synsLangs(el) / 2;
    const retning = sentrum <= layout.pNaa ? 1 : -1;
    if (retning !== naaRetning) setNaaRetning(retning);
  };

  const hoppTilNaa = () => {
    const el = scrollRef.current;
    if (!el) return;
    tikk();
    const mål = layout.pNaa - synsLangs(el) / 2;
    const glatt = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (vannrett) el.scrollTo({ left: mål, behavior: glatt ? "smooth" : "auto" });
    else el.scrollTo({ top: mål, behavior: glatt ? "smooth" : "auto" });
  };

  // Pinch-zoom (mobil) — ankret i midtpunktet mellom fingrene, coalesced per
  // frame. Samme mekanikk som paper-utgaven.
  const pekerNed = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pekere.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pekere.current.size === 2) {
      const [a, b] = [...pekere.current.values()];
      pinch.current = { avstand: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const pekerFlytt = (e: React.PointerEvent) => {
    if (!pekere.current.has(e.pointerId)) return;
    pekere.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pekere.current.size === 2 && pinch.current) {
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      const [a, b] = [...pekere.current.values()];
      const avstand = Math.hypot(a.x - b.x, a.y - b.y);
      const rekt = el.getBoundingClientRect();
      const midt = vannrett
        ? (a.x + b.x) / 2 - rekt.left
        : (a.y + b.y) / 2 - rekt.top;
      planleggZoom(pinch.current.zoom * (avstand / pinch.current.avstand), midt);
    }
  };
  const pekerOpp = (e: React.PointerEvent) => {
    pekere.current.delete(e.pointerId);
    if (pekere.current.size < 2) pinch.current = null;
  };

  // Trackpad-pinch / ctrl+wheel (desktop) — zoom ankret under peker.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const påWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rekt = el.getBoundingClientRect();
      const v = vannrett ? e.clientX - rekt.left : e.clientY - rekt.top;
      venterZoom.current = {
        z: (venterZoom.current?.z ?? zoom) * Math.exp(-e.deltaY / 220),
        v,
      };
      planleggZoom(venterZoom.current.z, v);
    };
    el.addEventListener("wheel", påWheel, { passive: false });
    return () => el.removeEventListener("wheel", påWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vannrett, zoom, layout]);

  const lukk = () => {
    const forrige = valgt;
    setValgt(null);
    if (forrige != null) {
      requestAnimationFrame(() =>
        scrollRef.current
          ?.querySelector<SVGGElement>(`.cs-bue[data-i="${forrige}"]`)
          ?.focus(),
      );
    }
  };

  // Gravert virkelighets-band: epoker som matte toner + hendelses-/oppfinnelses-ticks.
  const epoker = useMemo(() => ankere.filter((a) => a.type === "epoke"), [ankere]);
  const ticks = useMemo(
    () => ankere.filter((a) => a.type === "hendelse" || a.type === "oppfinnelse"),
    [ankere],
  );

  const svgW = vannrett ? layout.total : W;
  const svgH = vannrett ? H : layout.total;
  const p0naa = layout.pNaa;

  // Overtyre: buer tegnes i laget-års-orden — forsinkelse mappes 0→1.4s.
  const lagetMin = useMemo(
    () => Math.min(...verk.map((v) => v.lagetAar ?? v.foregaarFra)),
    [verk],
  );
  const lagetMax = useMemo(
    () => Math.max(...verk.map((v) => v.lagetAar ?? v.foregaarFra)),
    [verk],
  );
  const forsink = (v: Verk) =>
    ((((v.lagetAar ?? v.foregaarFra) - lagetMin) / Math.max(1, lagetMax - lagetMin)) * 1.4).toFixed(2);

  return (
    <div className="cs-app" data-vannrett={vannrett}>
      <header className="cs-header">
        <div>
          <span className="cs-wordmark">Anachronology</span>
          <span className="cs-under">Chronoscope · every work is a leap</span>
        </div>
        <nav className="cs-nav">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomTil(zoom / 1.4, scrollRef.current ? synsLangs(scrollRef.current) / 2 : 0)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomTil(zoom * 1.4, scrollRef.current ? synsLangs(scrollRef.current) / 2 : 0)}
          >
            +
          </button>
          <a href="/">{"←︎ Paper view"}</a>
        </nav>
      </header>

      <p className="sr-only">
        {`Chronoscope view: ${verk.length} works of fiction drawn as arcs from the year they
        were made to the year they are set, against a shared time axis. ${innhentet} imagined
        futures have been caught up by reality; ${gjenstaar} remain ahead. Arrow keys step
        between works in time order; Enter opens details. The paper view on the front page
        offers the same data as an accessible catalogue.`}
      </p>

      <div
        className="cs-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Chronoscope (scrollable)"
        onKeyDown={onKeyDown}
        onScroll={påScroll}
        onPointerDown={pekerNed}
        onPointerMove={pekerFlytt}
        onPointerUp={pekerOpp}
        onPointerCancel={pekerOpp}
      >
        {klar && (
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} role="group" aria-label="Works as light arcs sliced by the NOW line.">
            <defs>
              <linearGradient
                id="cs-bloom"
                x1={vannrett ? 0 : 0}
                x2={vannrett ? 1 : 0}
                y1={0}
                y2={vannrett ? 0 : 1}
              >
                <stop offset="0" stopColor="#FFE9C4" stopOpacity="0" />
                <stop offset="0.5" stopColor="#FFE9C4" stopOpacity="0.13" />
                <stop offset="1" stopColor="#FFE9C4" stopOpacity="0" />
              </linearGradient>
              {/* NÅ-slicede strøk: én gradient per bue som krysser linja */}
              {layout.buer
                .filter((b) => b.cut != null)
                .map((b) => {
                  const lo = Math.min(b.p0, b.s0);
                  const hi = Math.max(b.p1, b.s1, b.p0);
                  return (
                    <linearGradient
                      key={`g${b.idx}`}
                      id={`cs-s${b.idx}`}
                      gradientUnits="userSpaceOnUse"
                      x1={vannrett ? lo : 0}
                      x2={vannrett ? hi : 0}
                      y1={vannrett ? 0 : lo}
                      y2={vannrett ? 0 : hi}
                    >
                      <stop offset="0" stopColor="var(--cs-past)" />
                      <stop offset={b.cut!} stopColor="var(--cs-past)" />
                      <stop offset={b.cut!} stopColor="var(--cs-future)" />
                      <stop offset="1" stopColor="var(--cs-future)" />
                    </linearGradient>
                  );
                })}
            </defs>

            {/* Gravert akse + virkelighets-band. Virkeligheten gløder aldri. */}
            <g aria-hidden="true">
              {vannrett ? (
                <line x1={0} y1={layout.akse} x2={svgW} y2={svgH && layout.akse} stroke="var(--cs-ink-2)" strokeWidth={1.2} />
              ) : (
                <line x1={layout.akse} y1={0} x2={layout.akse} y2={svgH} stroke="var(--cs-ink-2)" strokeWidth={1.2} />
              )}
              {epoker.map((a, i) => {
                const f = layout.L(a.fra);
                const t = layout.L(a.til);
                const midt = (f + t) / 2;
                const vis = t - f > a.tittel.length * 6.5 + 8;
                return (
                  <g key={`e${i}`}>
                    {vannrett ? (
                      <rect x={f} y={layout.akse - 11} width={t - f} height={22} fill="#E8E6DF" opacity={0.05} />
                    ) : (
                      <rect x={layout.akse - 11} y={f} width={22} height={t - f} fill="#E8E6DF" opacity={0.05} />
                    )}
                    {vis && (
                      <text
                        x={vannrett ? midt : layout.akse - 18}
                        y={vannrett ? layout.akse - 18 : midt}
                        textAnchor="middle"
                        transform={vannrett ? undefined : `rotate(90 ${layout.akse - 18} ${midt})`}
                        className="cs-etikett"
                      >
                        {a.tittel.toUpperCase()}
                      </text>
                    )}
                  </g>
                );
              })}
              {ticks.map((a, i) => {
                const p = layout.L(a.fra);
                return (
                  <g key={`t${i}`}>
                    {vannrett ? (
                      <line x1={p} y1={layout.akse - 8} x2={p} y2={layout.akse + 8} stroke="var(--cs-ink-3)" strokeWidth={1} />
                    ) : (
                      <line x1={layout.akse - 8} y1={p} x2={layout.akse + 8} y2={p} stroke="var(--cs-ink-3)" strokeWidth={1} />
                    )}
                  </g>
                );
              })}
              {/* århundre-graduasjoner + kollapsede strekk */}
              {layout.skala.segmenter.map((seg, i) => {
                const ut: React.ReactNode[] = [];
                if (seg.kollapset) {
                  const midt = 90 - 10 + (seg.y0 + seg.y1) / 2; // OFFSET-justert under
                  const m = layout.L(seg.fra) + (layout.L(seg.til) - layout.L(seg.fra)) / 2;
                  void midt;
                  ut.push(
                    vannrett ? (
                      <g key={`k${i}`}>
                        <rect x={layout.L(seg.fra)} y={0} width={layout.L(seg.til) - layout.L(seg.fra)} height={svgH} fill="#E8E6DF" opacity={0.03} />
                        <text x={m} y={layout.akse + 34} textAnchor="middle" className="cs-etikett">
                          {`≈ ${fmtGap(seg.til - seg.fra).replace("≈ ", "")} SKIPPED`}
                        </text>
                      </g>
                    ) : (
                      <g key={`k${i}`}>
                        <rect x={0} y={layout.L(seg.fra)} width={svgW} height={layout.L(seg.til) - layout.L(seg.fra)} fill="#E8E6DF" opacity={0.03} />
                        <text x={layout.akse + 14} y={m + 3} className="cs-etikett">
                          {`≈ ${fmtGap(seg.til - seg.fra).replace("≈ ", "")} SKIPPED`}
                        </text>
                      </g>
                    ),
                  );
                } else {
                  const steg = seg.til - seg.fra > 600 ? 200 : 100;
                  for (let aar = Math.ceil(seg.fra / steg) * steg; aar <= seg.til; aar += steg) {
                    const p = layout.L(aar);
                    ut.push(
                      vannrett ? (
                        <g key={`aa${i}-${aar}`}>
                          <line x1={p} y1={layout.akse - 6} x2={p} y2={layout.akse + 6} stroke="var(--cs-ink-3)" strokeWidth={1} />
                          <text x={p} y={layout.akse + 24} textAnchor="middle" className="cs-aar">{fmtAar(aar)}</text>
                        </g>
                      ) : (
                        <g key={`aa${i}-${aar}`}>
                          <line x1={layout.akse - 6} y1={p} x2={layout.akse + 6} y2={p} stroke="var(--cs-ink-3)" strokeWidth={1} />
                          <text x={layout.akse - 12} y={p + 4} textAnchor="end" className="cs-aar">{fmtAar(aar)}</text>
                        </g>
                      ),
                    );
                  }
                }
                return ut;
              })}
            </g>

            {/* Buene — valgt/fokusert rendres sist (øverst) */}
            {[...layout.buer]
              .sort((a, b) => (a.idx === valgt ? 1 : 0) - (b.idx === valgt ? 1 : 0))
              .map((b) => {
                const stroke =
                  b.cut != null
                    ? `url(#cs-s${b.idx})`
                    : b.framtid
                      ? "var(--cs-future)"
                      : Math.max(b.v.foregaarTil, b.v.lagetAar ?? 0) <= naa
                        ? "var(--cs-past)"
                        : "var(--cs-future)";
                const dash = b.v.usikker ? "5 4" : undefined;
                const erValgt = b.idx === valgt;
                const glyfP = b.p1;
                const spennBredde = Math.abs(b.s1 - b.s0);
                return (
                  <g
                    key={b.idx}
                    className={`cs-bue${erValgt ? " cs-valgt" : ""}`}
                    data-i={b.idx}
                    role="button"
                    aria-haspopup="dialog"
                    aria-label={`${b.v.tittel}. Made ${b.v.lagetAar ?? "unknown"}, set ${fmtAar(b.v.foregaarFra)}${b.v.foregaarTil !== b.v.foregaarFra ? `–${fmtAar(b.v.foregaarTil)}` : ""}.`}
                    tabIndex={b.idx === tabbar ? 0 : -1}
                    onClick={() => velg(b.idx)}
                    onFocus={() => setFokusIdx(b.idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        velg(b.idx);
                      }
                    }}
                  >
                    <title>{`${b.v.tittel} — made ${b.v.lagetAar ?? "?"}, set ${fmtAar(b.v.foregaarFra)}`}</title>
                    {b.d && (
                      <>
                        {/* usynlig fet treff-path + halo + kjerne (lagdelte strøk, ingen filter) */}
                        <path d={b.d} fill="none" stroke="transparent" strokeWidth={16} />
                        <path d={b.d} fill="none" stroke={stroke} strokeWidth={5} opacity={0.13} className="cs-halo" />
                        <path
                          d={b.d}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={1.4}
                          strokeDasharray={dash}
                          className="cs-kjerne"
                          pathLength={100}
                          style={{ animationDelay: `${forsink(b.v)}s` }}
                        />
                      </>
                    )}
                    {/* tidsspenn på selve aksen (og samtidsverk = kun dette) */}
                    {(spennBredde > 1 || !b.d) &&
                      (vannrett ? (
                        <line x1={b.s0} y1={layout.akse} x2={Math.max(b.s1, b.s0 + 2)} y2={layout.akse} stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeDasharray={dash} opacity={0.9} />
                      ) : (
                        <line x1={layout.akse} y1={b.s0} x2={layout.akse} y2={Math.max(b.s1, b.s0 + 2)} stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeDasharray={dash} opacity={0.9} />
                      ))}
                    {/* endepunkt-glyf ved foregår-året */}
                    {vannrett ? (
                      <circle cx={glyfP} cy={layout.akse} r={erValgt ? 4.5 : 2.6} fill={b.v.foregaarFra <= naa ? "var(--cs-past)" : "var(--cs-future)"} className="cs-glyf" />
                    ) : (
                      <circle cx={layout.akse} cy={glyfP} r={erValgt ? 4.5 : 2.6} fill={b.v.foregaarFra <= naa ? "var(--cs-past)" : "var(--cs-future)"} className="cs-glyf" />
                    )}
                    {/* flytende tittel (hover/fokus/valgt via CSS) */}
                    <text
                      x={vannrett ? (b.p0 + b.p1) / 2 : layout.akse + 20}
                      y={vannrett ? layout.akse + (b.t === "profeti" ? -b.h - 10 : b.h + 20) : (b.p0 + b.p1) / 2}
                      textAnchor={vannrett ? "middle" : "start"}
                      className="cs-tittel"
                    >
                      {b.v.tittel}
                    </text>
                  </g>
                );
              })}

            {/* NÅ — produktets eneste bloom */}
            <g aria-hidden="true">
              {vannrett ? (
                <>
                  <rect x={p0naa - 28} y={0} width={56} height={svgH} fill="url(#cs-bloom)" />
                  <line x1={p0naa} y1={16} x2={p0naa} y2={svgH - 14} stroke="var(--cs-now)" strokeWidth={2} />
                  <text x={p0naa - 10} y={40} textAnchor="end" className="cs-teller cs-teller-rav">{`CAUGHT UP · ${innhentet}`}</text>
                  <text x={p0naa + 10} y={40} className="cs-teller cs-teller-cyan">{`STILL AHEAD · ${gjenstaar}`}</text>
                  <text x={p0naa} y={svgH - 2} textAnchor="middle" className="cs-teller">{`NOW ${naa}`}</text>
                </>
              ) : (
                <>
                  <rect x={0} y={p0naa - 28} width={svgW} height={56} fill="url(#cs-bloom)" />
                  <line x1={10} y1={p0naa} x2={svgW - 10} y2={p0naa} stroke="var(--cs-now)" strokeWidth={2} />
                  <text x={svgW - 12} y={p0naa - 10} textAnchor="end" className="cs-teller cs-teller-rav">{`CAUGHT UP · ${innhentet}`}</text>
                  <text x={svgW - 12} y={p0naa + 20} textAnchor="end" className="cs-teller cs-teller-cyan">{`STILL AHEAD · ${gjenstaar}`}</text>
                  <text x={16} y={p0naa + 20} className="cs-teller">{`NOW ${naa}`}</text>
                </>
              )}
            </g>
          </svg>
        )}
      </div>

      {/* NÅ-FAB: veien hjem — pila peker mot NÅ relativt til der du står */}
      <button type="button" className="cs-fab" onClick={hoppTilNaa} aria-label="Jump to NOW">
        {`NOW ${naaRetning === 1 ? (vannrett ? "→︎" : "↓︎") : vannrett ? "←︎" : "↑︎"}`}
      </button>

      <ChronoKort verk={valgt != null ? verk[valgt] : null} naa={naa} onLukk={lukk} />
    </div>
  );
}
