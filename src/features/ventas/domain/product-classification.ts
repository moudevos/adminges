import type { SalesProductGroup } from "@/features/ventas/domain/types";

export type ProductClassificationInput = {
  sku?: string | null;
  name?: string | null;
  category?: string | null;
  primaryCategory?: string | null;
  saleCategory?: string | null;
  family?: string | null;
  variant?: string | null;
  nombre?: string | null;
  categoria?: string | null;
  categoria_principal?: string | null;
  categoria_venta?: string | null;
  familia?: string | null;
  variante?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function containsToken(value: string, token: string) {
  return new RegExp("(^|\\s|/)" + token + "($|\\s|/)").test(value);
}

function isAccessoryPrincipal(value: string) {
  return (
    containsToken(value, "ACC") ||
    value.includes("ACCESORIO") ||
    value.includes("ACCESSOR")
  );
}

function isHhpPrincipal(value: string) {
  return containsToken(value, "HHP") || value.includes("EXHIBICIONES HHP");
}

function isTabletPrincipal(value: string) {
  return (
    containsToken(value, "TAB") ||
    value.includes("TABLET") ||
    value.includes("EXHIBICIONES TAB")
  );
}

function isWearablePrincipal(value: string) {
  return containsToken(value, "WEA") || value.includes("WEARABLE");
}

export function classifySalesProduct(
  product: ProductClassificationInput,
): SalesProductGroup {
  const sku = normalize(product.sku);
  const name = normalize(product.name ?? product.nombre);
  const primary = normalize(
    product.primaryCategory ??
      product.categoria_principal ??
      product.category ??
      product.categoria,
  );
  const secondary = normalize(product.saleCategory ?? product.categoria_venta);
  const family = normalize(product.family ?? product.familia);
  const variant = normalize(product.variant ?? product.variante);
  const structured = [secondary, family, variant].join(" ");

  // Láminas se identifica por clasificación estructurada. "Case Galaxy A57"
  // no entra aquí aunque contenga un modelo de celular.
  if (
    primary.includes("MARCAS PROPIAS") &&
    (secondary.includes("LAMINA") || family.includes("LAMINA"))
  ) {
    return "LAMINAS";
  }

  if (secondary.includes("LAMINA") || family.includes("LAMINA")) {
    return "LAMINAS";
  }

  // Los accesorios se resuelven antes de mirar nombres Galaxy A/S/Z.
  // Esto evita clasificar CASE GALAXY A57 como HHP Serie A.
  if (isAccessoryPrincipal(primary)) {
    if (
      secondary.includes("WEARABLE") ||
      isWearablePrincipal(secondary) ||
      sku.startsWith("WEA") ||
      name.startsWith("WEA ") ||
      name.includes("GALAXY BUDS") ||
      containsToken(name, "BUDS")
    ) {
      return "WEA";
    }

    return "ACCESORIOS";
  }

  if (isWearablePrincipal(primary)) {
    return "WEA";
  }

  if (isTabletPrincipal(primary)) {
    return "TABLETS";
  }

  if (isHhpPrincipal(primary)) {
    const modelText = [family, variant, name].join(" ");

    if (/\bGALAXY\s+A\d/.test(modelText)) return "HHP_SERIE_A";
    if (/\bGALAXY\s+S\d/.test(modelText)) return "HHP_SERIE_S";
    if (/\bGALAXY\s+Z\b/.test(modelText)) return "HHP_SERIE_Z";

    return "OTROS";
  }

  // Fallback únicamente cuando no existe una categoría principal útil.
  if (!primary) {
    const fallback = [structured, name, sku].join(" ");

    if (/\bGALAXY\s+TAB\b/.test(fallback)) return "TABLETS";
    if (
      sku.startsWith("WEA") ||
      fallback.includes("GALAXY BUDS") ||
      containsToken(fallback, "BUDS") ||
      fallback.includes("GALAXY WATCH")
    ) {
      return "WEA";
    }
    if (/\bGALAXY\s+A\d/.test(fallback)) return "HHP_SERIE_A";
    if (/\bGALAXY\s+S\d/.test(fallback)) return "HHP_SERIE_S";
    if (/\bGALAXY\s+Z\b/.test(fallback)) return "HHP_SERIE_Z";
  }

  return "OTROS";
}

export function isLaminaProduct(product: ProductClassificationInput) {
  return classifySalesProduct(product) === "LAMINAS";
}

export function isScPlusProduct(product: ProductClassificationInput) {
  const value = [
    product.primaryCategory ?? product.categoria_principal,
    product.category ?? product.categoria,
    product.saleCategory ?? product.categoria_venta,
    product.family ?? product.familia,
    product.variant ?? product.variante,
    product.name ?? product.nombre,
  ]
    .map(normalize)
    .join(" ");

  return (
    value.includes("SC+") ||
    value.includes("SC PLUS") ||
    value.includes("SAMSUNG CARE")
  );
}
