"use client";

import {
  faBarcode,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCopy,
  faEye,
  faMagnifyingGlass,
  faSort,
  faSortDown,
  faSortUp,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { InventoryStockRow } from "@/features/inventario/domain/types";

const columnHelper = createColumnHelper<InventoryStockRow>();

/* ---------- Utilidades ---------- */

const categoryOf = (row: InventoryStockRow) =>
  row.categoriaPrincipal || row.categoria || "";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueSorted(values: Array<string | null>) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}

/* Paletas pastel con borde. Las clases van completas para que Tailwind las detecte. */
const CATEGORY_TONES = [
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-teal-200 bg-teal-50 text-teal-700",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-orange-200 bg-orange-50 text-orange-700",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
];

const WAREHOUSE_TONES = [
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-indigo-200 bg-indigo-50 text-indigo-700",
  "border-slate-200 bg-slate-50 text-slate-600",
];

/* Color estable por texto (sin azar, para no romper la hidratación). */
function toneFor(value: string, tones: string[]) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return tones[hash % tones.length];
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  const icon =
    direction === "asc" ? faSortUp : direction === "desc" ? faSortDown : faSort;
  return (
    <FontAwesomeIcon
      icon={icon}
      className={
        "text-[9px] " + (direction ? "text-indigo-600" : "text-slate-300")
      }
    />
  );
}

const inputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50";

/* ---------- Tabla ---------- */

export function InventoryStockTable({ rows }: { rows: InventoryStockRow[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [logicalWarehouse, setLogicalWarehouse] = useState("");
  const [showZero, setShowZero] = useState(false);
  const [selectedRow, setSelectedRow] = useState<InventoryStockRow | null>(
    null,
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nombre", desc: false },
  ]);

  const categories = useMemo(
    () => uniqueSorted(rows.map(categoryOf)),
    [rows],
  );

  const subcategories = useMemo(
    () =>
      uniqueSorted(
        rows
          .filter((row) => !category || categoryOf(row) === category)
          .map((row) => row.categoriaVenta),
      ),
    [category, rows],
  );

  const logicalWarehouses = useMemo(
    () => uniqueSorted(rows.map((row) => row.ubicacion)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = normalize(search);

    return rows.filter((row) => {
      if (!showZero && row.cantidadFisica <= 0) return false;
      if (category && categoryOf(row) !== category) return false;
      if (subcategory && (row.categoriaVenta || "") !== subcategory)
        return false;
      if (logicalWarehouse && (row.ubicacion || "") !== logicalWarehouse)
        return false;
      if (!query) return true;

      return normalize([row.nombre, row.sku, ...row.serials].join(" ")).includes(
        query,
      );
    });
  }, [category, logicalWarehouse, rows, search, showZero, subcategory]);

  const hasFilters = Boolean(
    search || category || subcategory || logicalWarehouse,
  );

  function clearFilters() {
    setSearch("");
    setCategory("");
    setSubcategory("");
    setLogicalWarehouse("");
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("sku", {
        header: "SKU",
        cell: (info) => (
          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("nombre", {
        header: "Producto",
        cell: (info) => {
          const { seriesCount } = info.row.original;
          return (
            <div className="min-w-[220px]">
              <p className="font-medium leading-5 text-slate-900">
                {info.getValue()}
              </p>
              {seriesCount > 0 ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                  <FontAwesomeIcon icon={faBarcode} className="text-[9px]" />
                  {seriesCount} {seriesCount === 1 ? "serie" : "series"}
                </span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => categoryOf(row) || "—", {
        id: "categoria",
        header: "Categoría",
        cell: (info) => {
          const sub = info.row.original.categoriaVenta;
          const value = info.getValue();
          return (
            <div className="flex flex-col items-start gap-1">
              <span
                className={
                  "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium " +
                  toneFor(value, CATEGORY_TONES)
                }
              >
                {value}
              </span>
              {sub ? (
                <span className="text-[11px] text-slate-400">{sub}</span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.ubicacion || "—", {
        id: "ubicacion",
        header: "Almacén",
        cell: (info) => (
          <span
            className={
              "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium " +
              toneFor(info.getValue(), WAREHOUSE_TONES)
            }
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("cantidadFisica", {
        header: "Cantidad",
        cell: (info) => {
          const item = info.row.original;
          const diff = item.cantidadDisponible !== item.cantidadFisica;
          const empty = info.getValue() <= 0;

          return (
            <div className="flex flex-col items-end gap-1">
              <span
                className={
                  "inline-flex min-w-9 justify-center rounded-lg border px-2 py-0.5 text-sm font-semibold tabular-nums " +
                  (empty
                    ? "border-slate-200 bg-slate-50 text-slate-400"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700")
                }
              >
                {info.getValue()}
              </span>
              {diff ? (
                <span className="text-[11px] tabular-nums text-slate-400">
                  {item.cantidadDisponible} disp.
                </span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "acciones",
        header: "",
        enableSorting: false,
        cell: (info) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedRow(info.row.original)}
              className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
              aria-label={"Ver series de " + info.row.original.sku}
              title="Ver series"
            >
              <FontAwesomeIcon icon={faEye} className="text-xs" />
            </button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const total = filteredRows.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/50 p-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Buscar por producto, SKU o IMEI</span>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto, SKU o IMEI"
            className={inputBase + " pl-9 pr-3"}
          />
        </label>

        <FilterSelect
          label="Categoría"
          value={category}
          onChange={(v) => {
            setCategory(v);
            setSubcategory("");
          }}
          options={categories}
        />
        <FilterSelect
          label="Subcategoría"
          value={subcategory}
          onChange={setSubcategory}
          options={subcategories}
        />
        <FilterSelect
          label="Almacén"
          value={logicalWarehouse}
          onChange={setLogicalWarehouse}
          options={logicalWarehouses}
        />

        <button
          type="button"
          role="switch"
          aria-checked={showZero}
          onClick={() => setShowZero((v) => !v)}
          className={
            "flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition " +
            (showZero
              ? "border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")
          }
        >
          <span
            className={
              "relative h-4 w-7 rounded-full transition " +
              (showZero ? "bg-indigo-500" : "bg-slate-200")
            }
          >
            <span
              className={
                "absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-all " +
                (showZero ? "left-3.5" : "left-0.5")
              }
            />
          </span>
          Sin stock
        </button>

        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-transparent px-2.5 text-xs font-medium text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
            Limpiar
          </button>
        ) : null}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-slate-200 bg-slate-50/70"
              >
                {headerGroup.headers.map((header) => {
                  const right = header.column.id === "cantidadFisica";
                  const sortable = header.column.getCanSort();

                  return (
                    <th
                      key={header.id}
                      className={
                        "px-4 py-2.5 text-xs font-medium text-slate-500 " +
                        (right ? "text-right" : "")
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={
                            "inline-flex items-center gap-1.5 transition hover:text-slate-900 " +
                            (right ? "ml-auto" : "")
                          }
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.original.rowKey}
                className="border-b border-slate-100 transition last:border-b-0 hover:bg-indigo-50/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={
                      "px-4 py-3 align-middle " +
                      (cell.column.id === "cantidadFisica" ? "text-right" : "")
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="grid size-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-300">
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </span>
                    <p className="text-sm text-slate-400">Sin resultados</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pie */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-500">
        <span className="tabular-nums">
          {from}–{to} de {total}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500"
            aria-label="Página anterior"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
          </button>
          <span className="min-w-14 text-center tabular-nums">
            {pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500"
            aria-label="Página siguiente"
          >
            <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
          </button>
        </div>
      </div>

      {/* Modal de series */}
      <Modal
        open={Boolean(selectedRow)}
        title={selectedRow?.nombre ?? "Series"}
        description={
          selectedRow
            ? selectedRow.sku + " · " + (selectedRow.ubicacion || "—")
            : undefined
        }
        onClose={() => setSelectedRow(null)}
        maxWidthClassName="max-w-md"
      >
        {selectedRow ? (
          <SeriesPanel key={selectedRow.rowKey} row={selectedRow} />
        ) : null}
      </Modal>
    </section>
  );
}

/* ---------- Contenido del modal ---------- */

function SeriesPanel({ row }: { row: InventoryStockRow }) {
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const visibleSerials = useMemo(() => {
    const query = normalize(filter);
    if (!query) return row.serials;
    return row.serials.filter((serial) => normalize(serial).includes(query));
  }, [filter, row.serials]);

  const diff = row.cantidadFisica - row.serials.length;
  const hasSerials = row.serials.length > 0;

  const stats = [
    {
      label: "Físico",
      value: row.cantidadFisica,
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
    },
    {
      label: "Disponible",
      value: row.cantidadDisponible,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Series",
      value: row.serials.length,
      tone: "border-violet-200 bg-violet-50 text-violet-700",
    },
  ];

  async function copy(serial: string) {
    try {
      await navigator.clipboard.writeText(serial);
      setCopied(serial);
      setTimeout(() => setCopied((c) => (c === serial ? null : c)), 1200);
    } catch {
      // el portapapeles puede no estar disponible; se ignora
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={"rounded-xl border px-3 py-2.5 " + stat.tone}
          >
            <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-[11px] opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {hasSerials && diff !== 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {diff > 0
            ? `Faltan ${diff} ${diff === 1 ? "serie" : "series"} por registrar.`
            : `Hay ${-diff} ${-diff === 1 ? "serie" : "series"} de más.`}
        </div>
      ) : null}

      {hasSerials ? (
        <div className="space-y-2">
          {row.serials.length > 8 ? (
            <label className="relative block">
              <span className="sr-only">Buscar serie</span>
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"
              />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar serie"
                className={inputBase + " pl-9 pr-3"}
              />
            </label>
          ) : null}

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200">
            {visibleSerials.map((serial, index) => {
              const isCopied = copied === serial;

              return (
                <button
                  key={serial}
                  type="button"
                  onClick={() => copy(serial)}
                  title="Copiar"
                  className="group flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-indigo-50/40"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-md border border-slate-200 bg-slate-50 text-[10px] tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                  <span className="flex-1 font-mono text-xs font-medium text-slate-700">
                    {serial}
                  </span>
                  <FontAwesomeIcon
                    icon={isCopied ? faCheck : faCopy}
                    className={
                      "text-[11px] transition " +
                      (isCopied
                        ? "text-emerald-500"
                        : "text-slate-300 opacity-0 group-hover:opacity-100")
                    }
                  />
                </button>
              );
            })}

            {visibleSerials.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Sin coincidencias
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-300">
            <FontAwesomeIcon icon={faBarcode} />
          </span>
          <p className="text-sm text-slate-400">
            Este producto no maneja serie o IMEI en esta ubicación.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Filtro desplegable ---------- */

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const active = Boolean(value);

  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          "h-10 appearance-none rounded-xl border pl-3.5 pr-9 text-sm outline-none transition focus:ring-4 focus:ring-indigo-50 " +
          (active
            ? "border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")
        }
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FontAwesomeIcon
        icon={faChevronDown}
        className={
          "pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] " +
          (active ? "text-indigo-400" : "text-slate-400")
        }
      />
    </label>
  );
}