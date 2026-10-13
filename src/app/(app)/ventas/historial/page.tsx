import { SalesHistoryTable } from "@/features/ventas/components/sales-history-table";
import type {
  SalesHistoryFilters,
  SalesHistoryStatusFilter,
} from "@/features/ventas/domain/types";
import {
  daysAgoDateString,
  loadSalesHistory,
  peruDateString,
} from "@/features/ventas/server/loaders";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function status(value: string | undefined): SalesHistoryStatusFilter {
  return value === "confirmada" || value === "anulada" ? value : "todos";
}

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const dynamic = "force-dynamic";

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const filters: SalesHistoryFilters = {
    from: validDate(first(params.desde)) ?? daysAgoDateString(30),
    to: validDate(first(params.hasta)) ?? peruDateString(),
    status: status(first(params.estado)),
    promoterId: first(params.promotor) ?? "",
    category: first(params.categoria) ?? "",
    type: first(params.tipo) ?? "",
    paymentMethod: first(params.pago) ?? "",
    search: first(params.q) ?? "",
    page: pageNumber(first(params.pagina)),
  };

  const data = await loadSalesHistory(filters);
  return <SalesHistoryTable data={data} />;
}
