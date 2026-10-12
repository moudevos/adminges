"use client";

import {
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faMagnifyingGlass,
  faSort,
  faSortDown,
  faSortUp,
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
import type { InventoryStockRow } from "@/lib/inventory/types";

const columnHelper = createColumnHelper<InventoryStockRow>();

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueSorted(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

function locationLabel(row: InventoryStockRow) {
  if (!row.almacen) return row.ubicacion || "—";

  if (row.almacen === "KIOSKO MALL IQUITOS - KIO37") {
    return row.ubicacion || row.almacen;
  }

  return "Tránsito · " + row.almacen;
}

function SortIcon({
  direction,
}: {
  direction: false | "asc" | "desc";
}) {
  if (direction === "asc") {
    return <FontAwesomeIcon icon={faSortUp} className="text-[10px]" />;
  }

  if (direction === "desc") {
    return <FontAwesomeIcon icon={faSortDown} className="text-[10px]" />;
  }

  return <FontAwesomeIcon icon={faSort} className="text-[10px] text-slate-300" />;
}

export function InventoryStockTable({
  rows,
}: {
  rows: InventoryStockRow[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [showZero, setShowZero] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nombre", desc: false },
  ]);

  const categories = useMemo(
    () => uniqueSorted(rows.map((row) => row.categoriaPrincipal || row.categoria)),
    [rows],
  );
  const subcategories = useMemo(
    () =>
      uniqueSorted(
        rows
          .filter(
            (row) =>
              !category ||
              (row.categoriaPrincipal || row.categoria) === category,
          )
          .map((row) => row.categoriaVenta),
      ),
    [category, rows],
  );
  const warehouses = useMemo(
    () => uniqueSorted(rows.map((row) => row.almacen)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = normalize(search);

    return rows.filter((row) => {
      if (!showZero && row.cantidadFisica <= 0) return false;
      if (
        category &&
        (row.categoriaPrincipal || row.categoria || "") !== category
      ) {
        return false;
      }
      if (subcategory && (row.categoriaVenta || "") !== subcategory) {
        return false;
      }
      if (warehouse && (row.almacen || "") !== warehouse) {
        return false;
      }

      if (!query) return true;

      const searchable = normalize(
        [
          row.nombre,
          row.sku,
          ...row.serials,
        ].join(" "),
      );

      return searchable.includes(query);
    });
  }, [category, rows, search, showZero, subcategory, warehouse]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("sku", {
        header: "SKU",
        cell: (info) => (
          <span className="font-mono text-xs font-semibold text-slate-600">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("nombre", {
        header: "Producto",
        cell: (info) => (
          <div className="min-w-[240px]">
            <p className="font-medium text-slate-900">{info.getValue()}</p>
            {info.row.original.seriesCount > 0 ? (
              <p className="mt-0.5 text-[11px] text-slate-400">
                {info.row.original.seriesCount}{" "}
                {info.row.original.seriesCount === 1 ? "serie" : "series"}
              </p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor(
        (row) => row.categoriaPrincipal || row.categoria || "—",
        {
          id: "categoria",
          header: "Categoría",
        },
      ),
      columnHelper.accessor((row) => row.categoriaVenta || "—", {
        id: "subcategoria",
        header: "Subcategoría",
      }),
      columnHelper.accessor((row) => row.almacen || "—", {
        id: "almacen",
        header: "Almacén",
        cell: (info) => (
          <div className="min-w-[190px]">
            <p className="text-slate-700">{info.getValue()}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {locationLabel(info.row.original)}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("cantidadFisica", {
        header: "Cantidad",
        cell: (info) => (
          <div className="text-right">
            <p className="font-semibold text-slate-900">{info.getValue()}</p>
            {info.row.original.stockActual > 0 ? (
              <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
                {info.row.original.stockActual} disponible
              </p>
            ) : null}
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
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  function clearDependentCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSubcategory("");
    table.setPageIndex(0);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.5fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(190px,0.9fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Buscar por nombre, SKU o IMEI</span>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.setPageIndex(0);
            }}
            placeholder="Buscar por nombre, SKU o IMEI"
            className="control-input pl-9"
          />
        </label>

        <FilterSelect
          label="Categoría"
          value={category}
          onChange={clearDependentCategory}
          options={categories}
        />

        <FilterSelect
          label="Subcategoría"
          value={subcategory}
          onChange={(value) => {
            setSubcategory(value);
            table.setPageIndex(0);
          }}
          options={subcategories}
        />

        <FilterSelect
          label="Almacén"
          value={warehouse}
          onChange={(value) => {
            setWarehouse(value);
            table.setPageIndex(0);
          }}
          options={warehouses}
        />

        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50">
          <input
            type="checkbox"
            checked={showZero}
            onChange={(event) => {
              setShowZero(event.target.checked);
              table.setPageIndex(0);
            }}
            className="size-4 rounded border-slate-300 accent-indigo-600"
          />
          <span className="whitespace-nowrap">Visualizar en 0</span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.035em] text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortable = header.column.getCanSort();

                  return (
                    <th
                      key={header.id}
                      className={
                        "border-b border-slate-200 px-4 py-3 " +
                        (header.column.id === "cantidadFisica"
                          ? "text-right"
                          : "")
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={
                            "inline-flex items-center gap-2 transition hover:text-slate-900 " +
                            (header.column.id === "cantidadFisica"
                              ? "ml-auto"
                              : "")
                          }
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <SortIcon direction={sorted} />
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
                className="transition hover:bg-slate-50/80"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={
                      "border-b border-slate-100 px-4 py-3.5 text-slate-600 " +
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
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  No hay resultados para los filtros seleccionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {filteredRows.length}{" "}
          {filteredRows.length === 1 ? "registro" : "registros"}
        </span>

        <div className="flex items-center gap-2">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
    </section>
  );
}

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
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="control-input appearance-none pr-8"
      >
        <option value="">{label}: Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FontAwesomeIcon
        icon={faChevronDown}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
      />
    </label>
  );
}
