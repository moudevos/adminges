import { InventoryMovementsView } from "@/features/inventario/components/movements-view";
import { searchInventoryMovements } from "@/features/inventario/server/movements";

export default async function InventoryMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim() ?? "";
  const response = query ? await searchInventoryMovements(query) : null;

  return <InventoryMovementsView query={query} response={response} />;
}
