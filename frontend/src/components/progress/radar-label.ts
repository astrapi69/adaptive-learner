/**
 * Axis-label layout for the profile radar (#3402).
 *
 * The six method labels sit outside the radar; on a phone a long label
 * ("KI-adaptiv", "Fehlerzentriert", "Παραγωγική (από γενικό)") ran past the
 * SVG edge and was clipped. A label is broken at spaces and after hyphens
 * into lines of at most ``maxChars``; a single word longer than that is cut
 * with an ellipsis (the full name stays in the tick's ``<title>`` and in the
 * chart's data table).
 *
 * @example
 * radarLabelLines("Παραγωγική (από γενικό)", 12); // ["Παραγωγική", "(από γενικό)"]
 */

const ELLIPSIS = "…";

function clip(word: string, maxChars: number): string {
  return word.length <= maxChars ? word : `${word.slice(0, maxChars - 1)}${ELLIPSIS}`;
}

/** Split a label into display lines of at most ``maxChars`` characters. */
export function radarLabelLines(label: string, maxChars: number): string[] {
  const words = label.split(/(?<=-)|\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const joiner = line === "" || line.endsWith("-") ? "" : " ";
    if (line !== "" && (line + joiner + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line + joiner + word;
    }
  }
  if (line !== "") lines.push(line);
  return lines.map((l) => clip(l, maxChars));
}
