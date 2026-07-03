import { useState } from "react";
import type { Verk } from "@/lib/typer";
import { fmtAar, mediumNavn, tittelKort } from "@/lib/format";

interface Props {
  verk: Verk;
  /** Markør-senter (skjerm). Orienteringen er allerede regnet ut i Tidslinje. */
  x: number;
  y: number;
  /** Den andre enden av tidsspennet (= markør-senter for et punkt). */
  x2: number;
  y2: number;
  /** foregår ≤ NÅ → virkeligheten har innhentet det → fylt markør. */
  innhentet: boolean;
  /** Skjules i tette klynger for å unngå tittel-kollisjon (declutter). */
  visTittel?: boolean;
  onVelg?: () => void;
  /** Kalles når markøren får fokus (Tab/klikk) — flytter roving-fokuset hit. */
  onFokus?: () => void;
  /** Roving tabindex: kun den aktive markøren er tabbbar (0), resten -1. */
  tabbar?: boolean;
  r?: number;
  /** Index i verk-lista — brukes til pil-tast-roving + unik clipPath-id. */
  dataI?: number;
  /** Valgt = åpent kort: oransje ring + (på mobil) horisontal tittel. */
  erValgt?: boolean;
  /** Smal skjerm (mobil/vertikal): markør = bilde-thumbnail, navn horisontalt. */
  kompakt?: boolean;
  /** Full lerretsbredde — avgjør hvilken side den valgte labelen legges på. */
  W?: number;
  /** Wikipedia-thumbnail (mobil-markør). Mangler den → form-markør. */
  bilde?: string;
  /** Mobil: vis horisontalt navn (høyreste i raden får plass). */
  visNavn?: boolean;
  /** Bilde-side i px på mobil. */
  bildeStr?: number;
  /** Desktop: skjerm-x for lagetAar — tegner «tidshopp»-linja (laget → foregår)
   *  ved hover/valg. Anakronismen blir synlig på selve lerretet. */
  lagetX?: number;
}

function Markor({
  verk,
  x,
  y,
  innhentet,
  r,
}: {
  verk: Verk;
  x: number;
  y: number;
  innhentet: boolean;
  r: number;
}) {
  const fill = innhentet ? "var(--ink)" : "var(--paper)";
  // Hule (framtids-)markører får oransje kontur: «fiksjon som ennå ikke er innhentet».
  const stroke = innhentet ? "var(--ink)" : "var(--accent)";
  const sw = 1.3;
  const dash = verk.usikker ? "2 2" : undefined;
  const felles = { fill, stroke, strokeWidth: sw, strokeDasharray: dash };

  switch (verk.medium) {
    case "bok":
      return <circle cx={x} cy={y} r={r} {...felles} />;
    case "tv":
      return (
        <g>
          <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...felles} />
          {/* Delelinja er hele TV-koden — 1.3px forsvant på 14px. 2.6px leses. */}
          <line
            x1={x - r}
            y1={y}
            x2={x + r}
            y2={y}
            stroke={innhentet ? "var(--paper)" : "var(--ink)"}
            strokeWidth={2.6}
          />
        </g>
      );
    default: // film
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...felles} />;
  }
}

// Ett verk: tidsspenn-strek + markør + tittel.
// Mobil (vertikal): Wikipedia-bilde + horisontalt navn. Desktop (horisontal): form + tittel over.
export default function Spor({
  verk,
  x,
  y,
  x2,
  y2,
  innhentet,
  visTittel = true,
  onVelg,
  onFokus,
  tabbar = true,
  r = 6,
  dataI,
  erValgt = false,
  kompakt = false,
  W = 1000,
  bilde,
  visNavn = false,
  bildeStr = 30,
  lagetX,
}: Props) {
  const spennLen = Math.hypot(x2 - x, y2 - y);
  const spenn = spennLen > 1;
  const label = `${verk.tittel}, ${mediumNavn(verk.medium)}. Made ${
    verk.lagetAar ?? "unknown"
  }, set in ${fmtAar(verk.foregaarFra)}. Tap for details.`;

  // Mobil-markør = bilde når vi har en thumbnail; ellers form (de få uten bilde).
  // Feilet lasting (fjernet Commons-fil, blokkering, offline) ruter til form-
  // fallbacken som allerede finnes — aldri nettleserens knekte-bilde-glyf.
  const [bildeFeil, setBildeFeil] = useState(false);
  const brukBilde = kompakt && !!bilde && !bildeFeil;
  const s = bildeStr;
  const x0 = x - s / 2;
  const y0 = y - s / 2;
  const klippId = `klipp-${dataI}`;
  const kant = innhentet ? "var(--ink)" : "var(--accent)";
  const rFallback = Math.round(bildeStr * 0.36);
  const tilHoyre = x < W * 0.5; // mobil: legg valgt-navn på siden med mest plass

  return (
    <g
      role="button"
      aria-label={label}
      aria-haspopup="dialog"
      tabIndex={tabbar ? 0 : -1}
      className="spor"
      data-i={dataI}
      onClick={onVelg}
      onFocus={onFokus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onVelg?.();
        }
      }}
    >
      <title>{label}</title>
      {/* usynlig treffområde ≥44px (WCAG target size) — lett å treffe på touch */}
      <circle cx={(x + x2) / 2} cy={(y + y2) / 2} r={Math.max(22, spennLen / 2 + 14)} fill="transparent" />
      {spenn && (
        /* oransje strek med runde ender = tidsspennet (fiksjon = oransje).
           4px: spennene skal aldri rope høyere enn NÅ-linja. */
        <line
          x1={x}
          y1={y}
          x2={x2}
          y2={y2}
          stroke="var(--accent)"
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}

      {/* «Tidshopp»-linja (desktop, hover/valg): laget-året → foregår-året.
          Anakronismen — produktets tittel-innsikt — tegnet der den hører hjemme. */}
      {!kompakt && lagetX != null && verk.lagetAar != null && Math.abs(lagetX - x) > 12 && (
        <g className="tm-leap" data-valgt={erValgt} pointerEvents="none">
          <line
            x1={lagetX}
            y1={y}
            x2={x}
            y2={y}
            stroke="var(--ink-soft)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <line x1={lagetX} y1={y - 4} x2={lagetX} y2={y + 4} stroke="var(--ink-soft)" strokeWidth={1.4} />
          <text
            x={lagetX < x ? lagetX - 5 : lagetX + 5}
            y={y + 3}
            textAnchor={lagetX < x ? "end" : "start"}
            fontSize={9}
            fontWeight={500}
            fill="var(--ink-soft)"
            stroke="var(--paper)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {`made ${fmtAar(verk.lagetAar)}`}
          </text>
        </g>
      )}

      {brukBilde ? (
        <g>
          <clipPath id={klippId}>
            <rect x={x0} y={y0} width={s} height={s} rx={6} />
          </clipPath>
          <image
            href={bilde}
            x={x0}
            y={y0}
            width={s}
            height={s}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${klippId})`}
            onError={() => setBildeFeil(true)}
          />
          <rect x={x0} y={y0} width={s} height={s} rx={6} fill="none" stroke={kant} strokeWidth={1.3} />
          <rect
            className="tm-ring"
            data-valgt={erValgt}
            x={x0 - 3}
            y={y0 - 3}
            width={s + 6}
            height={s + 6}
            rx={9}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            pointerEvents="none"
          />
        </g>
      ) : (
        <g>
          <Markor verk={verk} x={x} y={y} innhentet={innhentet} r={kompakt ? rFallback : r} />
          {/* oransje prikk — gir fiksjons-fargen også til punkt-verk uten spenn.
              TV: prikken flyttes ned så den ikke visker ut delelinja (TV-koden). */}
          <circle
            cx={x}
            cy={verk.medium === "tv" ? y + (kompakt ? rFallback : r) * 0.55 : y}
            r={2.4}
            fill="var(--accent)"
          />
          <circle
            className="tm-ring"
            data-valgt={erValgt}
            cx={x}
            cy={y}
            r={(kompakt ? rFallback : r) + 5}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            pointerEvents="none"
          />
        </g>
      )}

      {kompakt ? (
        // Mobil: horisontalt navn til siden for markøren (paper-halo over linjene)
        (visNavn || erValgt) && (
          <text
            className="tm-tittel-valgt"
            x={tilHoyre ? x + s / 2 + 6 : x - s / 2 - 6}
            y={y + 4}
            textAnchor={tilHoyre ? "start" : "end"}
            fontSize={11}
            fontWeight={600}
            fill="var(--ink)"
            stroke="var(--paper)"
            strokeWidth={3}
            paintOrder="stroke"
            pointerEvents="none"
          >
            {tittelKort(verk.tittel, 22)}
          </text>
        )
      ) : (
        // Desktop (horisontal): tittel horisontalt over markøren, declutter via
        // visTittel. Papir-halo: figuren vinner alltid der strataene overlapper.
        <text
          className={visTittel ? "tm-tittel" : "tm-tittel tm-tittel-skjult"}
          x={x}
          y={y - r - 6}
          fontSize={10}
          fontWeight={500}
          letterSpacing=".01em"
          fill="var(--ink)"
          stroke="var(--paper)"
          strokeWidth={3}
          paintOrder="stroke"
          textAnchor="middle"
        >
          {tittelKort(verk.tittel, 30)}
        </text>
      )}
    </g>
  );
}
