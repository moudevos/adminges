"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import type {
  ManualInventoryCategory,
  ManualInventoryData,
} from "@/features/inventario/server/manual-inventory";
import "./manual-inventory-print.css";

const CATEGORIES: Array<{ key: ManualInventoryCategory; title: string }> = [
  { key: "HHP", title: "HHP" },
  { key: "TAB", title: "TAB" },
  { key: "ACC", title: "ACC" },
  { key: "LAMINAS", title: "LAMINAS" },
];

export function ManualInventorySheet({
  data,
}: {
  data: ManualInventoryData;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [printScale, setPrintScale] = useState(1);

  useLayoutEffect(() => {
    function fitOnePage() {
      const viewport = viewportRef.current;
      const grid = gridRef.current;
      if (!viewport || !grid) return;

      // Medir siempre a tamaño completo para no acumular reducciones.
      grid.style.width = "100%";
      grid.style.transform = "none";

      const height = grid.scrollHeight;
      const available = viewport.clientHeight;
      if (!height || !available) return;

      // Se usa escalado uniforme: nunca se omiten SKUs por paginación.
      const scale = Math.max(
        0.05,
        Math.min(1, (available - 2) / height),
      );
      grid.style.width = (100 / scale).toFixed(4) + "%";
      grid.style.transform = "scale(" + scale + ")";
      setPrintScale(scale);
    }

    fitOnePage();
    window.addEventListener("resize", fitOnePage);
    window.addEventListener("beforeprint", fitOnePage);
    document.fonts.ready.then(fitOnePage);
    return () => {
      window.removeEventListener("resize", fitOnePage);
      window.removeEventListener("beforeprint", fitOnePage);
    };
  }, [data]);

  const dateParts = data.date.split("-");
  const dateLabel =
    dateParts.length === 3
      ? dateParts[2] + "/" + dateParts[1] + "/" + dateParts[0]
      : data.date;

  return (
    <main className="manual-inventory-app">
      <div className="manual-inventory-toolbar">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Inventario manual · A4 horizontal
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {data.totalSkus} productos · {data.totalUnits} unidades · 4 columnas
          </p>
          {printScale < 0.6 ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              El inventario es extenso: se reducirá el texto para mantener una sola hoja A4.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventario/cargar"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Volver
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <article className="manual-inventory-sheet" aria-label="Inventario manual en A4">
        <header className="manual-sheet-header">
          <div>
            <p className="manual-sheet-kicker">CONTROL FÍSICO · CONTEO MANUAL</p>
            <h2>INVENTARIO MANUAL — KIOSKO MALL IQUITOS</h2>
            <p className="manual-sheet-subtitle">{data.warehouse}</p>
          </div>
          <div className="manual-sheet-date">
            <span>FECHA</span>
            <strong>{dateLabel}</strong>
            <small>{data.totalSkus} SKU · {data.totalUnits} und.</small>
          </div>
        </header>

        <div className="manual-sheet-viewport" ref={viewportRef}>
          <div className="manual-sheet-grid" ref={gridRef}>
            {CATEGORIES.map(({ key, title }) => {
              const items = data.groups[key];
              const total = items.reduce((sum, item) => sum + item.expected, 0);

              return (
                <section key={key} className="manual-sheet-group" aria-label={title}>
                  <div className="manual-sheet-group-title">
                    <strong>{title}</strong>
                    <span>{items.length} SKU · {total} und.</span>
                  </div>
                  <table className="manual-sheet-table">
                    <colgroup>
                      <col />
                      <col className="manual-sheet-quantity-column" />
                      <col className="manual-sheet-quantity-column" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">PRODUCTO / SKU</th>
                        <th scope="col" title="Cantidad disponible en sistema">SIS.</th>
                        <th scope="col" title="Conteo físico">FÍS.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.sku}>
                          <td>
                            <span className="manual-sheet-name">{item.name}</span>
                            <span className="manual-sheet-sku">
                              {item.sku}
                              {item.locations.length > 0
                                ? " · " + item.locations.join(", ")
                                : ""}
                            </span>
                          </td>
                          <td className="manual-sheet-number">{item.expected}</td>
                          <td><span className="manual-sheet-blank" aria-hidden="true" /></td>
                        </tr>
                      ))}
                      {items.length === 0 ? (
                        <tr><td colSpan={3} className="manual-sheet-empty">Sin unidades disponibles</td></tr>
                      ) : null}
                      <tr className="manual-sheet-extra">
                        <td>Otros / diferencias: __________</td>
                        <td>—</td>
                        <td><span className="manual-sheet-blank" aria-hidden="true" /></td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="manual-sheet-footer">
          <span>Conteo por SKU · Todas las ubicaciones de KIO37 · ACC incluye WEA y otros accesorios.</span>
          <span>Responsable: _____________________ &nbsp;&nbsp; Firma: _____________________</span>
        </footer>
      </article>
    </main>
  );
}
