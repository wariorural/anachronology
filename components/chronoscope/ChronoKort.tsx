"use client";

// Chronoscope-tittelkortet: letterboxet ark med anakronisme-tallet som hero —
// det største på noen skjerm, for gapet ER produktet. Native <dialog> som
// papirutgavens kort (fokusfelle/Escape/backdrop gratis).

import { useEffect, useRef, useState } from "react";
import type { Verk } from "@/lib/typer";
import { temporalitet, sprang } from "@/lib/chrono";
import { fmtAar, foregaarTekst, mediumNavn, skaperLabel, wikiUrl } from "@/lib/format";

interface Props {
  verk: Verk | null;
  naa: number;
  onLukk: () => void;
}

function punchline(v: Verk, naa: number): { hero: string; merke: string; linje: string } {
  const t = temporalitet(v);
  const g = sprang(v);
  if (t === "profeti") {
    const igjen = v.foregaarFra - naa;
    return {
      hero: `+${fmtAar(g)}`,
      merke: "YEARS AHEAD OF ITS TIME",
      linje:
        igjen <= 0
          ? `Imagined ${fmtAar(g)} years ahead — reality has caught up.`
          : `Imagined ${fmtAar(g)} years ahead — still ${fmtAar(igjen)} to go.`,
    };
  }
  if (t === "minne") {
    return {
      hero: `−${fmtAar(-g)}`,
      merke: "YEARS OF LOOKING BACK",
      linje: `Looks back ${fmtAar(-g)} years.`,
    };
  }
  return { hero: "±0", merke: "SET IN ITS OWN TIME", linje: "Fiction in step with its present." };
}

export default function ChronoKort({ verk, naa, onLukk }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const [vist, setVist] = useState<Verk | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (verk) {
      setVist(verk);
      if (!d.open) {
        d.showModal();
        artRef.current?.focus();
      }
    } else if (d.open) {
      d.close();
    }
  }, [verk]);

  const v = verk ?? vist;
  const p = v ? punchline(v, naa) : null;
  const profeti = v ? temporalitet(v) === "profeti" : false;

  return (
    <dialog
      ref={ref}
      className="cs-kort"
      aria-labelledby="cs-kort-tittel"
      onClose={onLukk}
      onClick={(e) => {
        if (e.target === ref.current) onLukk();
      }}
    >
      {v && p && (
        <article ref={artRef} tabIndex={-1}>
          <button type="button" className="cs-kort-lukk" aria-label="Close" onClick={onLukk}>
            ×
          </button>
          <p className={`cs-kort-hero ${profeti ? "cs-hero-rav" : "cs-hero-nøytral"}`} data-caught={profeti && v.foregaarFra <= naa}>
            {p.hero}
          </p>
          <p className="cs-kort-merke">{p.merke}</p>
          <h2 id="cs-kort-tittel" className="cs-kort-tittel">
            {v.tittel}
          </h2>
          <p className="cs-kort-linje">{p.linje}</p>
          <p className="cs-kort-meta">
            {[
              v.skaper ? `${v.skaper.toUpperCase()}` : null,
              mediumNavn(v.medium).toUpperCase(),
              `MADE ${v.lagetAar != null ? fmtAar(v.lagetAar) : "?"}`,
              `SET ${foregaarTekst(v.foregaarFra, v.foregaarTil)}${v.usikker ? " (DISPUTED)" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {v.merknad && <p className="cs-kort-merknad">{v.merknad}</p>}
          <footer className="cs-kort-foot">
            <a href={wikiUrl(v.tittel, v.wiki)} target="_blank" rel="noopener noreferrer">
              Wikipedia {"\u2197\uFE0E"}
            </a>
            {v.kilde && <span>{v.kilde}</span>}
          </footer>
          <span className="sr-only">{skaperLabel(v.medium)}</span>
        </article>
      )}
    </dialog>
  );
}
