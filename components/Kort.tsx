import { useEffect, useRef, useState } from "react";
import type { Verk } from "@/lib/typer";
import { fmtAar, foregaarTekst, mediumNavn, skaperLabel, wikiUrl } from "@/lib/format";
import { tikk } from "@/lib/haptikk";

// Håndbakt fjær-easing (WAAPI linear()) — huset ruller sitt eget, ingen bibliotek.
const FJAER = "linear(0, 0.677 12.5%, 1.036 25%, 1.07 31%, 1.007 50%, 0.996 62%, 1)";

const erMobil = () => window.matchMedia("(max-width: 430px)").matches;
const foretrekkerRo = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tre presise statuser i stedet for det tvetydige "innhentet". Bruker lagetÅr vs
// foregår-år: en historisk film (lagt til fortid da den ble laget) er noe annet enn
// sci-fi som forestilte en framtid vi nå har passert.
function status(v: Verk, naa: number): string {
  if (v.foregaarFra > naa) return "Unfulfilled future";
  if (v.lagetAar != null && v.lagetAar < v.foregaarFra) return "Overtaken future";
  return "Historical";
}

// Kortets punchline: selve anakronismen, ferdig regnet ut. «Made 1927 / Set in
// 2026» krevde hoderegning — dette ER innsikten produktet finnes for.
function anakronisme(
  v: Verk,
  naa: number,
): { hoved: string; under: string | null } | null {
  if (v.lagetAar == null) return null;
  const frem = v.foregaarFra - v.lagetAar;
  if (frem > 0) {
    const igjen = v.foregaarFra - naa;
    return {
      hoved: `Imagined ${fmtAar(frem)} year${frem === 1 ? "" : "s"} ahead`,
      under:
        igjen <= 0
          ? "Reality has caught up."
          : `Still ${fmtAar(igjen)} year${igjen === 1 ? "" : "s"} away.`,
    };
  }
  const tilbake = v.lagetAar - v.foregaarTil;
  if (tilbake > 0) {
    return {
      hoved: `Looks back ${fmtAar(tilbake)} year${tilbake === 1 ? "" : "s"}`,
      under: null,
    };
  }
  return null; // samtidsverk — ingen anakronisme å fortelle
}

interface Props {
  verk: Verk | null;
  naa: number;
  onLukk: () => void;
  /** Relieff (desktop): kortet match-cuttes UT FRA nålens viewport-punkt. */
  fraPunkt?: { x: number; y: number } | null;
  relieff?: boolean;
}

// Klikk på en markør åpner dette. Her — og bare her — bor "når det ble laget".
export default function Kort({ verk, naa, onLukk, fraPunkt, relieff }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  // Behold forrige innhold mens kortet toner UT, ellers blir panelet tomt.
  const [vist, setVist] = useState<Verk | null>(null);
  // Mobil: arket åpner i «peek» (tittel + punchline; tidslinja bak forblir
  // synlig) og kan dras til «full». Desktop/landskap ignorerer attributtet.
  const [snap, setSnap] = useState<"peek" | "full">("peek");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (verk) {
      setVist(verk);
      setSnap("peek");
      if (!d.open) {
        d.showModal();
        // showModal() autofokuserer lukkeknappen → synlig fokus-ring ved åpning.
        // Flytt fokus til selve arket (fokuserbart, men uten ring) i stedet.
        artRef.current?.focus();
        // Match-cut (relieff, desktop): kortet VOKSER ut fra nålen som åpnet
        // det — cinema-grammatikk i stedet for generisk ark-gli. WAAPI over-
        // styrer CSS-transisjonen kun mens den kjører.
        if (fraPunkt && relieff && !erMobil() && !foretrekkerRo()) {
          const r = d.getBoundingClientRect();
          d.style.transformOrigin = `${fraPunkt.x - r.left}px ${fraPunkt.y - r.top}px`;
          d.animate(
            [
              { transform: "scale(0.22)", opacity: 0.2 },
              { transform: "scale(1)", opacity: 1 },
            ],
            { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
          );
        }
      }
    } else if (d.open) {
      d.close();
    }
  }, [verk, fraPunkt, relieff]);

  // Drag-sesjon (mobil): fra gripe-sonen alltid; fra innholdet kun i peek
  // (der er arket uansett uscrollbart). Full-tilstand scroller normalt —
  // dismiss derfra går via gripa, ×, backdrop eller Escape.
  const drag = useRef<{
    y0: number;
    yPrev: number;
    tPrev: number;
    vy: number;
    aktiv: boolean;
    fraGripe: boolean;
  } | null>(null);

  const pekerNed = (e: React.PointerEvent) => {
    const d = ref.current;
    if (!d || !erMobil()) return;
    if (e.target === d) return; // backdrop-klikk håndteres som lukking, ikke drag
    const fraGripe =
      (e.target as HTMLElement).closest?.(".tm-kort-gripe") != null;
    drag.current = {
      y0: e.clientY,
      yPrev: e.clientY,
      tPrev: performance.now(),
      vy: 0,
      aktiv: false,
      fraGripe,
    };
  };

  const pekerFlytt = (e: React.PointerEvent) => {
    const d = ref.current;
    const p = drag.current;
    if (!d || !p) return;
    const dy = e.clientY - p.y0;
    if (!p.aktiv) {
      if (p.fraGripe && Math.abs(dy) > 4) p.aktiv = true;
      else if (snap === "peek" && Math.abs(dy) > 6) p.aktiv = true;
      else if (Math.abs(dy) > 14) {
        drag.current = null; // indre scroll (full-tilstand) — gi fra oss gesten
        return;
      }
      if (p.aktiv) d.setPointerCapture(e.pointerId);
    }
    if (!p.aktiv) return;
    const nå = performance.now();
    p.vy = (e.clientY - p.yPrev) / Math.max(1, nå - p.tPrev);
    p.yPrev = e.clientY;
    p.tPrev = nå;
    // Nedover følger fingeren; oppover rubber-bander (forbi «mer» finnes ikke).
    const t = dy > 0 ? dy : dy / (1 + -dy / 80);
    d.style.transform = `translateY(${t}px)`;
  };

  const pekerOpp = (e: React.PointerEvent) => {
    const d = ref.current;
    const p = drag.current;
    drag.current = null;
    if (!d || !p || !p.aktiv) return;
    const dy = e.clientY - p.y0;
    d.style.transform = "";
    const terskel = snap === "peek" ? 90 : 150;
    if (dy > terskel || p.vy > 0.6) {
      // Forbi terskelen (eller kastet): gli ut og lukk.
      tikk(6);
      if (foretrekkerRo()) {
        d.close();
        return;
      }
      d.style.transform = `translateY(${Math.max(dy, 0)}px)`;
      const anim = d.animate(
        [
          { transform: `translateY(${Math.max(dy, 0)}px)` },
          { transform: "translateY(110%)" },
        ],
        { duration: 200, easing: "ease-in" },
      );
      anim.onfinish = () => {
        d.style.transform = "";
        d.close();
      };
    } else if (dy < -40 && snap === "peek") {
      tikk(6);
      setSnap("full");
    } else if (dy > 0 && !foretrekkerRo()) {
      // Under terskelen: fjær tilbake på plass.
      d.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration: 320, easing: FJAER },
      );
    }
  };

  const v = verk ?? vist;
  const gap = v ? anakronisme(v, naa) : null;

  return (
    <dialog
      ref={ref}
      className="tm-kort"
      data-snap={snap}
      aria-labelledby="tm-kort-tittel"
      onClose={onLukk}
      onClick={(e) => {
        if (e.target === ref.current) onLukk(); // klikk på backdrop
      }}
      onPointerDown={pekerNed}
      onPointerMove={pekerFlytt}
      onPointerUp={pekerOpp}
      onPointerCancel={() => {
        drag.current = null;
        const d = ref.current;
        if (d) d.style.transform = "";
      }}
    >
      {v && (
        <article ref={artRef} tabIndex={-1}>
          {/* Gripe-sone: dekorativ (aria-hidden) — lukking er fortsatt fullt
              tastatur-tilgjengelig via × og Escape. Tap veksler peek/full. */}
          <div
            className="tm-kort-gripe"
            aria-hidden="true"
            onClick={() => {
              if (!erMobil()) return;
              tikk(6);
              setSnap((s) => (s === "peek" ? "full" : "peek"));
            }}
          />
          <button
            type="button"
            className="tm-kort-lukk"
            aria-label="Close"
            onClick={onLukk}
          >
            ×
          </button>

          <p className="tm-kort-medium">
            {mediumNavn(v.medium)}
            {v.foregaarFra > naa && <span className="tm-kort-tag">future</span>}
          </p>

          {v.bilde && (
            <img
              className="tm-kort-bilde"
              src={v.bilde}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              // Knekt thumbnail skal ikke etterlate en eierløs rammestripe.
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}

          <h2 id="tm-kort-tittel" className="tm-kort-tittel">{v.tittel}</h2>

          {/* Punchline FØR faktagrida: dette er innsikten — og i peek-høyde på
              mobil er den dét som skal være synlig sammen med leap-linja bak. */}
          {gap && (
            <p className="tm-kort-gap">
              {gap.hoved}
              {gap.under && <small>{gap.under}</small>}
            </p>
          )}

          <dl className="tm-kort-fakta">
            {v.skaper && (
              <div>
                <dt>{skaperLabel(v.medium)}</dt>
                <dd>{v.skaper}</dd>
              </div>
            )}
            <div>
              <dt>Made</dt>
              <dd>{v.lagetAar != null ? fmtAar(v.lagetAar) : "unknown"}</dd>
            </div>
            <div>
              <dt>Set in</dt>
              <dd>
                {foregaarTekst(v.foregaarFra, v.foregaarTil)}
                {v.usikker && <span className="tm-kort-usikker"> (disputed)</span>}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status(v, naa)}</dd>
            </div>
          </dl>

          {v.merknad && <p className="tm-kort-merknad">{v.merknad}</p>}

          <footer className="tm-kort-foot">
            <a href={wikiUrl(v.tittel, v.wiki)} target="_blank" rel="noopener noreferrer">
              Wikipedia ↗
            </a>
            {v.kilde && <span className="tm-kort-kilde">{v.kilde}</span>}
          </footer>
        </article>
      )}
    </dialog>
  );
}
