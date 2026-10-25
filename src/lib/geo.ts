/* Países y regiones de los datos de ejemplo → códigos ISO 3166-1 numéricos (los mismos del mapa).
   Una región se pinta entera: "Europa" colorea todos los países europeos; "Mercados emergentes" colorea
   exactamente los países de la lista EMERGING. Lo que no es un país ni una región conocida (p. ej. "Global",
   "Otros") no se pinta. */

export const COUNTRY_ISO: Record<string, string> = {
  "Estados Unidos": "840", "Canadá": "124", "México": "484", "Brasil": "076", "Argentina": "032", "Chile": "152",
  "Colombia": "170", "Perú": "604", "Reino Unido": "826", "Irlanda": "372", "Francia": "250", "Alemania": "276",
  "España": "724", "Italia": "380", "Portugal": "620", "Países Bajos": "528", "Bélgica": "056", "Suiza": "756",
  "Austria": "040", "Suecia": "752", "Noruega": "578", "Dinamarca": "208", "Finlandia": "246", "Polonia": "616",
  "Grecia": "300", "Hungría": "348", "Chequia": "203", "Rumanía": "642", "Turquía": "792", "Rusia": "643",
  "Japón": "392", "China": "156", "Taiwán": "158", "Corea del Sur": "410", "India": "356", "Indonesia": "360",
  "Malasia": "458", "Tailandia": "764", "Filipinas": "608", "Singapur": "702", "Australia": "036", "Nueva Zelanda": "554",
  "Arabia Saudí": "682", "Emiratos Árabes Unidos": "784", "Catar": "634", "Sudáfrica": "710", "Egipto": "818",
};

/** Todos los países de Europa geográfica (incluye Rusia, Ucrania, Bielorrusia y Turquía queda fuera) */
const EUROPE = [
  "008", "020", "040", "056", "070", "100", "112", "191", "196", "203", "208", "233", "246", "250", "276", "300",
  "336", "348", "352", "372", "380", "428", "438", "440", "442", "470", "492", "498", "499", "528", "578", "616",
  "620", "642", "643", "674", "688", "703", "705", "724", "752", "756", "804", "807", "826",
];
/** Eurozona: 20 miembros */
const EURO_ZONE = ["040", "056", "191", "196", "233", "246", "250", "276", "300", "372", "380", "428", "440", "442", "470", "528", "620", "703", "705", "724"];
/** Mercados emergentes (índice MSCI Emerging Markets, aproximado) */
const EMERGING = [
  "076", "484", "152", "170", "604", "156", "158", "410", "356", "360", "458", "764", "608", "710", "682", "784",
  "634", "792", "616", "300", "348", "203", "818",
];
const LATAM = ["032", "076", "152", "170", "188", "214", "218", "068", "591", "484", "604", "600", "858", "862"];
const NORTH_AMERICA = ["124", "840", "484"];

export const REGION_ISO: Record<string, string[]> = {
  "Europa": EUROPE,
  "Europa (sin España)": EUROPE.filter((iso) => iso !== "724"),
  "Zona euro": EURO_ZONE,
  "Mercados emergentes": EMERGING,
  "Latinoamérica": LATAM,
  "Norteamérica": NORTH_AMERICA,
};

/** Códigos ISO que corresponden a una etiqueta (país o región). Vacío si no se puede situar en el mapa. */
export function isosFor(name: string): string[] {
  if (REGION_ISO[name]) return REGION_ISO[name];
  const iso = COUNTRY_ISO[name];
  return iso ? [iso] : [];
}
