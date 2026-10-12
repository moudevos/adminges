export type NormalizedCategory = {
  original: string;
  principal: string;
  sale: string | null;
  family: string | null;
  variant: string | null;
};

function cleanSegment(value: string) {
  return value
    .replace(/^RDU\s*-?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function principalFrom(value: string) {
  const upper = value.toUpperCase();

  if (upper.includes("MARCAS PROPIAS")) return "MARCAS PROPIAS";
  if (upper.includes("HHP")) return "HHP";
  if (upper.includes("ACCESORIOS") || /(^|\s)ACC($|\s)/.test(upper)) return "ACC";
  if (upper.includes("TAB")) return "TAB";
  if (upper.includes("WEAR") || /(^|\s)WEA($|\s)/.test(upper)) return "WEA";

  return cleanSegment(value).toUpperCase() || "SIN CATEGORIA";
}

export function normalizeCategory(value: string): NormalizedCategory {
  const original = value.replace(/\s+/g, " ").trim();
  const segments = original
    .split("/")
    .map((segment) => cleanSegment(segment))
    .filter(Boolean);

  return {
    original,
    principal: principalFrom(segments[0] ?? original),
    sale: segments[1]?.toUpperCase() ?? null,
    family: segments[2]?.toUpperCase() ?? null,
    variant:
      segments.length > 3
        ? segments.slice(3).join(" / ").toUpperCase()
        : null,
  };
}
