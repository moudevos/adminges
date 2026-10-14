import "server-only";

import type {
  ManualInventoryCategory,
  ManualInventoryData,
} from "@/features/inventario/server/manual-inventory";

export type ManualPdfOrientation = "portrait" | "landscape";

const CATEGORIES: Array<{ key: ManualInventoryCategory; label: string }> = [
  { key: "HHP", label: "HHP" },
  { key: "TAB", label: "TAB" },
  { key: "ACC", label: "ACC" },
  { key: "LAMINAS", label: "LÁMINAS" },
];

// Fuentes estándar PDF /WinAnsi: no se requieren librerías ni fuentes externas.
function pdfLiteral(value: string) {
  const replacements: Record<string, string> = {
    "–": "-", "—": "-", "“": '"', "”": '"',
    "‘": "'", "’": "'", "•": "-", "€": "EUR",
  };

  return "(" + Array.from(value.replace(/[\r\n\t]+/g, " ")).map((char) => {
    const normalized = replacements[char] ?? char;
    return Array.from(normalized).map((part) => {
      const code = part.charCodeAt(0);
      if (part === "(" || part === ")" || part === "\\") return "\\" + part;
      if (code >= 32 && code <= 126) return part;
      if (code >= 160 && code <= 255) return "\\" + code.toString(8).padStart(3, "0");
      return "?";
    }).join("");
  }).join("") + ")";
}

function point(value: number) {
  return Math.round(value * 100) / 100;
}

function fitSize(value: string, preferred: number, maxWidth: number) {
  // Ancho conservador en Helvetica, reduciendo para no cortar SKU/descripción.
  if (!value.length) return preferred;
  const estimatedWidth = [...value].reduce((sum, char) => {
    if ("il.:,|!' ".includes(char)) return sum + 0.29;
    if ("WM@%".includes(char)) return sum + 0.87;
    return sum + 0.54;
  }, 0);
  return Math.min(preferred, maxWidth / Math.max(estimatedWidth, 1));
}

/**
 * Crea un PDF vectorial con UNA página A4; el tamaño de fuente se ajusta
 * al grupo más largo y al ancho disponible. No se recortan SKU ni filas.
 */
export function generateManualInventoryPdf(
  data: ManualInventoryData,
  orientation: ManualPdfOrientation,
): { bytes: Uint8Array; maxRows: number; minFontSize: number } {
  const width = orientation === "landscape" ? 841.89 : 595.28;
  const height = orientation === "landscape" ? 595.28 : 841.89;
  const margin = 11;
  const gap = 3.2;
  const groupWidth = (width - margin * 2 - gap * 3) / 4;
  const headerH = 17;
  const footerY = 18;
  const headerY = height - margin;
  const bodyTop = headerY - headerH;
  const bottomY = footerY + 7;
  const availableH = bodyTop - bottomY;
  const maxRows = Math.max(
    1,
    ...CATEGORIES.map(({ key }) => data.groups[key].length),
  );
  const rowH = Math.min(11, availableH / maxRows);
  const visibleRows = Math.max(maxRows, Math.floor(availableH / Math.max(rowH, 1)));
  const commands: string[] = [];
  let minFontSize = 99;

  function add(command: string) { commands.push(command); }
  function stroke(x1: number, y1: number, x2: number, y2: number, shade = 0.72) {
    add(`${point(shade)} G 0.3 w ${point(x1)} ${point(y1)} m ${point(x2)} ${point(y2)} l S`);
  }
  function fillRect(x: number, y: number, w: number, h: number, gray = 0.94) {
    add(`${gray} g ${point(x)} ${point(y)} ${point(w)} ${point(h)} re f`);
  }
  function text(
    value: string, x: number, baseline: number, size: number, bold = false,
    color = 0.16,
  ) {
    if (!value) return;
    minFontSize = Math.min(minFontSize, size);
    add(`${point(color)} g BT /${bold ? "F2" : "F1"} ${point(size)} Tf 1 0 0 1 ${point(x)} ${point(baseline)} Tm ${pdfLiteral(value)} Tj ET`);
  }

  // Encabezados compactos y grilla ligera: 4 categorías x (producto / stock / OK).
  CATEGORIES.forEach(({ key, label }, index) => {
    const x = margin + index * (groupWidth + gap);
    const stockW = orientation === "landscape" ? 22 : 19;
    const okW = 14;
    const productW = groupWidth - stockW - okW;
    const skuItems = data.groups[key];

    fillRect(x, bodyTop, groupWidth, headerH);
    text("Producto (" + label + ")", x + 2.5, bodyTop + 5.4,
      fitSize("Producto (" + label + ")", 7.8, productW - 3), true);
    text("Stock", x + productW + 1.5, bodyTop + 5.4, 6.2, true);
    text("OK", x + productW + stockW + 2, bodyTop + 5.4, 6.4, true);
    stroke(x, headerY, x + groupWidth, headerY, 0.38);
    stroke(x, bodyTop, x + groupWidth, bodyTop, 0.38);
    stroke(x, bodyTop, x, bodyTop - visibleRows * rowH, 0.45);
    stroke(x + groupWidth, bodyTop, x + groupWidth, bodyTop - visibleRows * rowH, 0.45);
    stroke(x + productW, headerY, x + productW, bodyTop - visibleRows * rowH, 0.57);
    stroke(x + productW + stockW, headerY, x + productW + stockW,
      bodyTop - visibleRows * rowH, 0.57);

    for (let row = 0; row < visibleRows; row++) {
      const top = bodyTop - row * rowH;
      const bottom = top - rowH;
      stroke(x, bottom, x + groupWidth, bottom, 0.78);
      const item = skuItems[row];
      if (!item) continue;

      const description = item.sku + " - " + item.name;
      const fontSize = fitSize(description,
        Math.min(7.1, Math.max(1.5, rowH - 1.5)), productW - 4.5);
      const baseline = bottom + (rowH - fontSize) / 2 + 0.65;
      text(description, x + 2.5, baseline, fontSize);
      const stockLabel = String(item.expected);
      const stockFont = fitSize(stockLabel, Math.min(7.5, rowH - 1.1), stockW - 3);
      text(stockLabel, x + productW + (stockW - stockLabel.length * stockFont * 0.55) / 2,
        bottom + (rowH - stockFont) / 2 + 0.6, stockFont, true);

      // Columna OK queda deliberadamente vacía para marcar a mano.
    }
  });

  // Metadatos y firmas en UNA SOLA LÍNEA al pie, sin título voluminoso.
  stroke(margin, footerY + 6, width - margin, footerY + 6, 0.45);
  const [year, month, day] = data.date.split("-");
  const footer =
    "FECHA: " + day + "/" + month + "/" + year +
    "   |   TIENDA: " + data.warehouse +
    "   |   ALMACÉN: " + data.location +
    "   |   SKU: " + data.totalSkus +
    "   |   RESPONSABLE: __________   FIRMA: __________";
  text(footer, margin + 1, footerY - 2, fitSize(footer, 7.2, width - margin * 2 - 2));

  const stream = commands.join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    pdf += offsets[index].toString().padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return {
    bytes: new Uint8Array(Buffer.from(pdf, "ascii")),
    maxRows,
    minFontSize,
  };
}
