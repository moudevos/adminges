import { InventoryAnalysisView } from "@/features/inventario/components/analysis-view";
import { loadInventoryAnalysis } from "@/features/inventario/server/loaders";

export default async function InventoryAnalysisPage() {
  const { stock, movements } = await loadInventoryAnalysis();
  return <InventoryAnalysisView stock={stock} movements={movements} />;
}
