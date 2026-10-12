import { InventoryMovementsView } from "@/features/inventario/components/movements-view";
import type { InventoryMovementSearchMode } from "@/features/inventario/domain/types";
import { searchInventoryMovements } from "@/features/inventario/server/movements";

export default async function InventoryMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string | string[];
    q?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawType = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const mode: InventoryMovementSearchMode =
    rawType === "imei" ? "imei" : "sku";

  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim() ?? "";
  const response = query
    ? await searchInventoryMovements({ mode, query })
    : null;

  return (
    <InventoryMovementsView
      mode={mode}
      query={query}
      response={response}
    />
  );
}
