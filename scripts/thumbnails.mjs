// Vedlikehold av thumbnails i data/seed.json.
//
//   npm run thumbs
//
// To pass: (1) HEAD-sjekk alle eksisterende `bilde`-URL-er og fjern de som er
// døde (Commons-filer omdøpes/slettes rutinemessig); (2) hent thumbnail via
// Wikipedias pageimages-API for alle verk som mangler `bilde` men har `wiki`.
// Appen tåler døde URL-er (form-markør-fallback), men datasettet bør være rent.
//
// Kjøres LOKALT — enkelte sandkasser/proxier blokkerer Wikimedia.

import { readFileSync, writeFileSync } from "node:fs";

const FIL = new URL("../data/seed.json", import.meta.url);
const UA = "AnachronologyThumbs/1.0 (vedlikeholdsskript; se README)";
const BREDDE = 330;

const data = JSON.parse(readFileSync(FIL, "utf8"));

const tittelFraWiki = (url) =>
  decodeURIComponent(new URL(url).pathname.replace("/wiki/", "")).replace(/_/g, " ");

// --- Pass 1: verifiser eksisterende bilder ---
let fjernet = 0;
for (const v of data.verk) {
  if (!v.bilde) continue;
  try {
    const r = await fetch(v.bilde, { method: "HEAD", redirect: "follow", headers: { "user-agent": UA } });
    if (!r.ok) {
      console.log(`✗ dødt bilde (${r.status}): ${v.tittel}`);
      delete v.bilde;
      fjernet++;
    }
  } catch (e) {
    console.log(`? kunne ikke sjekke ${v.tittel}: ${e.message} (beholder)`);
  }
}

// --- Pass 2: hent manglende via pageimages-API (batcher på 50) ---
const mangler = data.verk.filter((v) => !v.bilde && v.wiki);
let hentet = 0;
for (let i = 0; i < mangler.length; i += 50) {
  const batch = mangler.slice(i, i + 50);
  const titles = batch.map((v) => tittelFraWiki(v.wiki)).join("|");
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=${BREDDE}&redirects=1&titles=${encodeURIComponent(titles)}`;
  const res = await fetch(api, { headers: { "user-agent": UA } });
  if (!res.ok) {
    console.error(`API-feil ${res.status} — er Wikimedia tilgjengelig herfra?`);
    process.exit(1);
  }
  const json = await res.json();
  // redirects/normalized: API-tittel → tittelen vi spurte med
  const tilbake = new Map();
  for (const r of [...(json.query.redirects ?? []), ...(json.query.normalized ?? [])]) {
    tilbake.set(r.to, tilbake.get(r.from) ?? r.from);
  }
  for (const side of Object.values(json.query.pages ?? {})) {
    const spurt = tilbake.get(side.title) ?? side.title;
    const verk = batch.find((v) => tittelFraWiki(v.wiki) === spurt);
    if (!verk) continue;
    if (side.thumbnail?.source) {
      verk.bilde = side.thumbnail.source;
      console.log(`✓ ${verk.tittel}`);
      hentet++;
    } else {
      console.log(`– ingen pageimage: ${verk.tittel}`);
    }
  }
}

// --- Skriv tilbake i samme kompakte format (én linje per objekt) ---
const linjer = (arr) => arr.map((o) => "    " + JSON.stringify(o)).join(",\n");
writeFileSync(
  FIL,
  `{\n  "verk": [\n${linjer(data.verk)}\n  ],\n  "ankere": [\n${linjer(data.ankere)}\n  ]\n}\n`,
);
console.log(`\nFerdig: ${fjernet} døde fjernet, ${hentet} hentet.`);
