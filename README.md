# Anachronology

En tidslinje som plasserer fiksjon (film/bok/TV) etter **året den foregår i** —
mot virkelig historie. NÅ-linja skiller framtid virkeligheten har innhentet
(Blade Runner 2019, Akira 2019) fra uinnfridd framtid (Children of Men 2027,
Dune 20000). Horisontal på desktop, vertikal på mobil.

## Kjøre lokalt

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # enhetstester for skala.ts + dodge.ts
npm run build    # produksjonsbygg
```

## Legge til et nytt verk

All data ligger i **`data/seed.json`**. Et verk er ett objekt i `verk`-lista.
Kopier en eksisterende linje og endre verdiene:

```json
{
  "tittel": "Mad Max: Fury Road",
  "medium": "film",
  "lagetAar": 2015,
  "foregaarFra": 2070,
  "foregaarTil": 2070,
  "wiki": "https://en.wikipedia.org/wiki/Mad_Max:_Fury_Road"
}
```

Lagre fila — siden oppdaterer seg selv. **Ingen kodeendring trengs.**

### Felt

| Felt          | Påkrevd | Hva                                                                 |
|---------------|---------|---------------------------------------------------------------------|
| `tittel`      | ja      | Verkets navn.                                                        |
| `medium`      | ja      | `"film"`, `"bok"` eller `"tv"` — bestemmer markørformen.            |
| `foregaarFra` | ja      | Året handlingen **foregår** fra. Dette er akse-posisjonen.          |
| `foregaarTil` | ja      | Lik `foregaarFra` for et punkt; et senere år for et tidsspenn (strek). |
| `lagetAar`    | nei     | Når verket ble laget/skrevet. Vises **kun i kortet**, aldri på aksen. |
| `skaper`      | nei     | Regissør (film/TV) eller forfatter (bok). Vises i kortet.           |
| `usikker`     | nei     | `true` → stiplet kontur (omstridt årstall, f.eks. Metropolis).      |
| `merknad`     | nei     | Kort tekst i kortet.                                                 |
| `kilde`       | nei     | Kildehenvisning (vises i kortet).                                   |
| `wiki`        | nei     | Direktelenke. Mangler den, søkes det på tittelen på Wikipedia.      |

> **f.Kr.:** bruk negative år. Spartacus foregår i 73 f.Kr. → `"foregaarFra": -73`.

## Legge til en epoke eller hendelse

Bakgrunnen (ekte historie) ligger i `ankere`-lista i samme fil:

```json
{ "tittel": "Vikingtiden", "type": "epoke", "fra": 793, "til": 1066 }
```

- `type: "epoke"` → blekt bånd bak aksen (har et spenn `fra`–`til`). Samtidige epoker
  deles automatisk i vertikale kolonner.
- `type: "hendelse"` → linje + etikett på aksen (`til` lik `fra`).
- `type: "oppfinnelse"` → stjerne + prikket linje (når noe ble oppfunnet, `til` lik `fra`).
- `vekt` (valgfri) → prioritet når plassen er trang.

Epokene styrer **ikke** akse-tettheten — den drives av verkene. Epokene er
bakteppe fiksjonen sitter mot.

## Hvordan det er bygget

- `lib/skala.ts` — elastisk akse (tomme strekk kollapses ærlig). Ren + testet.
- `lib/dodge.ts` — kollisjonshåndtering (verk som deler periode vifter ut). Ren + testet.
- `components/` — `Tidslinje` (orkestrering), `AkseLag` (akse + epoker + NÅ),
  `Spor` (ett verk), `Kort` (detaljpopup).
- Ingen tunge biblioteker — håndrendret SVG. Tokens i `app/globals.css`.
