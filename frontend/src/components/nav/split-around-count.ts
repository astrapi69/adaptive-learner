/**
 * Split a count-badge template such as ``"{n} due"`` or ``"Fällig: {n}"``
 * into the text before and after the ``{n}`` placeholder (#3123).
 *
 * The header badges render the count itself always and the surrounding
 * word only from the ``sm`` breakpoint up, so a phone bar carries "718"
 * next to the icon instead of "718 fällig"; splitting on the placeholder
 * keeps that working for every catalog's word order. A template without
 * the placeholder yields the whole text as the trailing part, so nothing
 * is lost when a catalog string is malformed.
 *
 * @example
 * splitAroundCount("{n} due"); // ["", " due"]
 * splitAroundCount("Fällig: {n}"); // ["Fällig: ", ""]
 */
export function splitAroundCount(template: string): [string, string] {
  const at = template.indexOf("{n}");
  if (at === -1) return ["", template];
  return [template.slice(0, at), template.slice(at + 3)];
}
