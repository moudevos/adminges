import { ManualInventorySheet } from "@/features/inventario/components/manual-inventory-sheet";
import { loadManualInventory } from "@/features/inventario/server/manual-inventory";

export const dynamic = "force-dynamic";

export default async function ManualInventoryPage() {
  const data = await loadManualInventory();
  return <ManualInventorySheet data={data} />;
}
