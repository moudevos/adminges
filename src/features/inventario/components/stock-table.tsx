"use client";

import {
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faEye,
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
import { Modal } from "@/components/ui/modal";
import type { InventoryStockRow } from "@/features/inventario/domain/types";

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

function SortIcon({
  direction,
}: {
  direction: false | "asc" | "desc";
}) {
  if (direction === "asc") {
    return <FontAwesomeIcon icon={faSortUp} className="text-[9px]" />;
  }

  if (direction === "desc") {
    return <FontAwesomeIcon icon={faSortDown} className="text-[9px]" />;
  }

  return (
    <FontAwesomeIcon
      icon={faSort}
      className="text-[9px] text-slate-300"
    />
  );
}

export function InventoryStockTable({
  rows,
}: {
  rows: InventoryStockRow[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [logicalWarehouse, setLogicalWarehouse] = useState("");
  const [showZero, setShowZero] = useState(false);
  const [selectedRow, setSelectedRow] = useState<InventoryStockRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nombre", desc: false },
  ]);

  const categories = useMemo(
    () =>
      uniqueSorted(
        rows.map((row) => row.categoriaPrincipal || row.categoria),
      ),
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

  const logicalWarehouses = useMemo(
    () => uniqueSorted(rows.map((row) => row.ubicacion)),
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

      if (
        logicalWarehouse &&
        (row.ubicacion || "") !== logicalWarehouse
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = normalize(
        [row.nombre, row.sku, ...row.serials].join(" "),
      );

      return searchable.includes(query);
    });
  }, [
    category,
    logicalWarehouse,
    rows,
    search,
    showZero,
    subcategory,
  ]);

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
            <p className="font-medium leading-5 text-slate-900">
              {info.getValue()}
            </p>
            {info.row.original.seriesCount > 0 ? (
              <span className="mt-1 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {info.row.original.seriesCount}{" "}
                {info.row.original.seriesCount === 1 ? "serie" : "series"}
              </span>
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
      columnHelper.accessor((row) => row.ubicacion || "—", {
        id: "ubicacion",
        header: "Almacén lógico",
        cell: (info) => (
          <span className="font-medium text-slate-700">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("cantidadFisica", {
        header: "Cantidad",
        cell: (info) => {
          const item = info.row.original;
          const showAvailable =
            item.cantidadDisponible !== item.cantidadFisica;

          return (
            <div className="text-right">
              <p className="font-semibold tabular-nums text-slate-900">
                {info.getValue()}
              </p>
              {showAvailable ? (
                <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                  {item.cantidadDisponible} disponible
                </p>
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <FontAwesomeIcon icon={faEye} className="text-[10px]" />
              Ver
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
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSubcategory("");
    table.setPageIndex(0);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid gap-2 border-b border-slate-100 bg-white p-2.5 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.45fr)_minmax(145px,0.65fr)_minmax(145px,0.65fr)_minmax(150px,0.7fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Buscar por nombre, SKU o IMEI</span>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.setPageIndex(0);
            }}
            placeholder="Buscar nombre, SKU o IMEI"
            className="control-input h-10 pl-9 text-sm"
          />
        </label>

        <FilterSelect
          label="Categoría"
          value={category}
          onChange={changeCategory}
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
          label="Almacén lógico"
          value={logicalWarehouse}
          onChange={(value) => {
            setLogicalWarehouse(value);
            table.setPageIndex(0);
          }}
          options={logicalWarehouses}
        />

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50">
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
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortable = header.column.getCanSort();

                  return (
                    <th
                      key={header.id}
                      className={
                        "border-b border-slate-200 px-4 py-2.5 " +
                        (header.column.id === "cantidadFisica" ||
                        header.column.id === "acciones"
                          ? "text-right"
                          : "")
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={
                            "inline-flex items-center gap-1.5 transition hover:text-slate-900 " +
                            (header.column.id === "cantidadFisica" ||
                            header.column.id === "acciones"
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
                className="transition hover:bg-slate-50/60"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={
                      "border-b border-slate-100 px-4 py-3 text-slate-600 " +
                      (cell.column.id === "cantidadFisica" ||
                      cell.column.id === "acciones"
                        ? "text-right"
                        : "")
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

      <div className="flex min-h-12 flex-col gap-2 px-4 py-2.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="tabular-nums">
          {filteredRows.length}{" "}
          {filteredRows.length === 1 ? "registro" : "registros"}
        </span>

        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Página anterior"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Página siguiente"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>

      <Modal
        open={Boolean(selectedRow)}
        title={selectedRow?.sku ?? "Series"}
        description={selectedRow?.nombre}
        onClose={() => setSelectedRow(null)}
        maxWidthClassName="max-w-lg"
      >
        {selectedRow ? (
          selectedRow.serials.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                <div>
                  <p className="text-slate-400">Almacén lógico</p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {selectedRow.ubicacion || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Cantidad esperada</p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-700">
                    {selectedRow.cantidadFisica}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Series</p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-700">
                    {selectedRow.serials.length}
                  </p>
                </div>
              </div>

              {selectedRow.cantidadFisica !== selectedRow.serials.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  El snapshot indica {selectedRow.cantidadFisica} unidades, pero
                  existen {selectedRow.serials.length} series asociadas.
                </div>
              ) : null}

              <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200">
                {selectedRow.serials.map((serial, index) => (
                  <div
                    key={serial}
                    className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                  >
                    <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-slate-300">
                      {index + 1}
                    </span>
                    <span className="font-mono text-xs font-medium text-slate-700">
                      {serial}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Este producto no maneja serie o IMEI en esta ubicación.
            </div>
          )
        ) : null}
      </Modal>
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
        className="control-input h-10 appearance-none pr-8 text-sm"
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
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400"
      />
    </label>
  );
}
