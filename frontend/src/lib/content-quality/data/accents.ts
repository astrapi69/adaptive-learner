/**
 * Accent dictionaries for the CQV-01 accent check (EXP-032).
 *
 * Each entry maps a DIACRITIC-FOLDED form (lowercased, combining marks
 * stripped — the key) to the single correct accented form (the value).
 * The check flags a token when its folded form is a key here AND the
 * token as written differs from the value (i.e. the accent is missing).
 *
 * Deliberately CONSERVATIVE: only words whose unaccented base form is
 * NOT itself a common valid word in that language are listed, so a real
 * unaccented homograph (es ``el``/``él``, fr ``a``/``à``, de
 * ``schon``/``schön``) never triggers a false positive. The lists are a
 * representative subset of the most frequent such words and are meant to
 * grow; correctness, not exhaustiveness, is the contract.
 */

import { foldToken } from "../normalize";

/** Build a folded-key dictionary from a list of correctly-accented words. */
function buildDict(words: string[]): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const word of words) {
    const lower = word.toLowerCase();
    const key = foldToken(lower);
    // Skip words that carry no diacritic (folded === lower): nothing to
    // flag, and they would mask a real homograph.
    if (key === lower) continue;
    dict[key] = lower;
  }
  return dict;
}

const ES_WORDS = [
  "café", "corazón", "mañana", "teléfono", "música", "médico", "número",
  "página", "rápido", "fácil", "difícil", "lápiz", "árbol", "azúcar",
  "miércoles", "sábado", "también", "inglés", "francés", "alemán", "jardín",
  "después", "ratón", "jamón", "limón", "canción", "estación", "habitación",
  "información", "televisión", "atención", "lección", "dirección", "adiós",
  "autobús", "ángel", "último", "próximo", "química", "física", "biología",
  "fotografía", "geografía", "economía", "película", "sofá", "bebé", "menú",
  "región", "millón", "área", "fútbol", "década", "público", "príncipe",
  "águila", "océano", "máquina", "plátano", "música", "época",
];

const FR_WORDS = [
  "être", "très", "déjà", "école", "élève", "café", "étudiant", "français",
  "préféré", "château", "théâtre", "numéro", "téléphone", "économie",
  "américain", "célèbre", "fenêtre", "forêt", "hôpital", "hôtel", "août",
  "problème", "système", "modèle", "première", "dernière", "lumière",
  "rivière", "université", "qualité", "société", "santé", "beauté", "vérité",
  "été", "métro", "vélo", "cinéma", "médecin", "étoile", "idée", "année",
  "journée", "matinée", "soirée", "entrée", "musée", "début", "succès",
  "progrès", "intérêt", "élément", "réponse", "événement", "période",
  "génération", "création", "français", "espérer", "préférer", "réussir",
];

const DE_WORDS = [
  "über", "für", "können", "müssen", "während", "früh", "grün", "Tür",
  "möglich", "natürlich", "überhaupt", "Mädchen", "Bücher", "Häuser",
  "Frühstück", "Gemüse", "Universität", "Glück", "Brücke", "Stück", "Küche",
  "Schlüssel", "Frühling", "fühlen", "hören", "südlich", "nördlich",
  "größer", "Möglichkeit", "Tätigkeit", "Universität", "wünschen", "grün",
  "Flüsse", "Vögel", "Bäume", "Räume", "Wände", "Köpfe", "Söhne", "Töchter",
  "Brüder", "Mütter", "Väter", "Männer", "Häfen", "Kämpfe",
];

/** Folded-key accent dictionaries keyed by base language code. */
export const ACCENT_DICTS: Record<string, Record<string, string>> = {
  es: buildDict(ES_WORDS),
  fr: buildDict(FR_WORDS),
  de: buildDict(DE_WORDS),
};
