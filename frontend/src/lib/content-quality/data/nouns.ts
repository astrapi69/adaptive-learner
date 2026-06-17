/**
 * Noun-gender dictionaries for the CQV-02 article check (EXP-032).
 *
 * Per language, a map from a DIACRITIC-FOLDED, lowercased noun to its
 * grammatical gender. Only unambiguous, single-gender citation-form nouns
 * are listed (the doc's conservative rule), so a homonym like es
 * ``el/la capital`` never produces a false positive — it is simply absent.
 *
 * A representative subset of the most frequent nouns; meant to grow.
 * Spanish feminine nouns that take the masculine article for euphony
 * (``el agua``, ``el área``) are intentionally EXCLUDED, so the check
 * never flags the correct ``el agua``.
 */

import { foldToken } from "../normalize";

/** Grammatical gender. ``n`` (neuter) only occurs in German. */
export type Gender = "m" | "f" | "n";

/** Fold a {gender: [words]} spec into a folded-key gender map. */
function buildNouns(spec: Partial<Record<Gender, string[]>>): Record<string, Gender> {
  const map: Record<string, Gender> = {};
  for (const [gender, words] of Object.entries(spec) as [Gender, string[]][]) {
    for (const word of words) map[foldToken(word.toLowerCase())] = gender;
  }
  return map;
}

const ES = buildNouns({
  m: [
    "libro", "perro", "gato", "coche", "niño", "hombre", "día", "sol",
    "problema", "tema", "mapa", "sistema", "programa", "idioma", "clima",
    "planeta", "sofá", "café", "árbol", "papel", "lápiz", "reloj", "amor",
    "color", "dolor", "hotel", "hospital", "jardín", "parque", "restaurante",
    "teléfono", "ordenador", "número", "año", "mes", "minuto", "momento",
    "mundo", "país", "pueblo", "trabajo", "dinero", "tiempo", "lugar",
    "nombre", "grupo", "cuerpo", "ojo", "pelo", "pie", "diente", "brazo",
    "dedo", "vaso", "plato", "cuchillo", "tenedor", "queso", "pan", "vino",
    "huevo", "pollo", "pescado", "arroz", "postre", "desayuno", "almuerzo",
    "tren", "avión", "barco", "autobús", "camino", "banco", "mercado",
    "supermercado", "cine", "teatro", "museo", "colegio", "instituto",
  ],
  f: [
    "casa", "mesa", "silla", "puerta", "ventana", "cama", "cocina", "escuela",
    "universidad", "ciudad", "calle", "plaza", "tienda", "playa", "montaña",
    "isla", "flor", "planta", "comida", "bebida", "leche", "fruta", "manzana",
    "naranja", "pera", "patata", "cebolla", "zanahoria", "ensalada", "sopa",
    "carne", "mano", "cabeza", "cara", "boca", "nariz", "oreja", "pierna",
    "espalda", "familia", "madre", "hermana", "hija", "abuela", "tía",
    "mujer", "niña", "amiga", "persona", "gente", "vida", "muerte", "palabra",
    "pregunta", "respuesta", "lengua", "clase", "lección", "tarea", "prueba",
    "nota", "página", "carta", "película", "canción", "música", "foto",
    "hora", "semana", "noche", "tarde", "primavera", "estación", "fiesta",
    "boda", "salud", "suerte", "verdad", "mentira", "idea", "razón", "manera",
    "forma", "parte", "cosa", "moto",
  ],
});

const FR = buildNouns({
  m: [
    "livre", "chien", "chat", "garçon", "homme", "jour", "soleil", "problème",
    "système", "café", "arbre", "papier", "stylo", "amour", "hôtel", "hôpital",
    "jardin", "parc", "restaurant", "téléphone", "ordinateur", "numéro", "an",
    "mois", "monde", "pays", "travail", "argent", "temps", "lieu", "nom",
    "groupe", "corps", "pied", "bras", "doigt", "verre", "fromage", "pain",
    "vin", "œuf", "poulet", "poisson", "riz", "dessert", "train", "avion",
    "bateau", "bus", "chemin", "banc", "marché", "cinéma", "théâtre", "musée",
    "collège", "lycée", "fauteuil", "sac", "stade", "magasin",
  ],
  f: [
    "maison", "table", "chaise", "porte", "fenêtre", "cuisine", "école",
    "université", "ville", "rue", "place", "boutique", "plage", "montagne",
    "île", "fleur", "plante", "nourriture", "boisson", "pomme", "orange",
    "poire", "salade", "soupe", "viande", "main", "tête", "bouche", "jambe",
    "famille", "mère", "sœur", "fille", "femme", "personne", "vie", "mort",
    "question", "réponse", "langue", "classe", "leçon", "page", "lettre",
    "chanson", "musique", "photo", "heure", "semaine", "nuit", "journée",
    "fête", "santé", "vérité", "idée", "raison", "chose", "voiture", "robe",
    "table", "montre", "clé", "porte",
  ],
});

const DE = buildNouns({
  m: [
    "Hund", "Mann", "Tisch", "Stuhl", "Baum", "Tag", "Monat", "Apfel",
    "Wagen", "Garten", "Park", "Computer", "Name", "Beruf", "Freund",
    "Bruder", "Vater", "Sohn", "Kopf", "Arm", "Fuß", "Bauch", "Käse", "Wein",
    "Saft", "Zug", "Bus", "Weg", "Markt", "Bahnhof", "Brief", "Film", "Ball",
    "Schlüssel", "Löffel", "Teller", "Stift", "Kuchen", "Salat", "Stuhl",
  ],
  f: [
    "Frau", "Katze", "Tür", "Wand", "Lampe", "Küche", "Schule", "Universität",
    "Stadt", "Straße", "Blume", "Pflanze", "Milch", "Banane", "Orange",
    "Suppe", "Hand", "Nase", "Mutter", "Schwester", "Tochter", "Familie",
    "Frage", "Antwort", "Sprache", "Klasse", "Stunde", "Woche", "Nacht",
    "Zeitung", "Karte", "Tasche", "Uhr", "Gabel", "Brücke",
  ],
  n: [
    "Mädchen", "Kind", "Haus", "Buch", "Auto", "Wasser", "Brot", "Ei",
    "Bier", "Glas", "Messer", "Fenster", "Bett", "Zimmer", "Jahr", "Wort",
    "Bild", "Heft", "Telefon", "Land", "Gemüse", "Obst", "Fleisch", "Huhn",
    "Hähnchen", "Restaurant", "Hotel", "Kino", "Theater", "Museum", "Büro",
  ],
});

/** Folded-key noun-gender dictionaries by base language code. */
export const NOUN_DICTS: Record<string, Record<string, Gender>> = {
  es: ES,
  fr: FR,
  de: DE,
};
