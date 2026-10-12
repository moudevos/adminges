import { InventoryManagement } from "@/components/dashboard/inventory-management";
import { loadInventoryAnalysis } from "@/lib/dashboard/loaders";

export default async function InventoryAnalysisPage() {
  const { stock, movements } = await loadInventoryAnalysis();

  return (
    <InventoryManagement
      activeView="analisis"
      stock={stock}
      movements={movements}
      snapshots={[]}
    />
  );
}
