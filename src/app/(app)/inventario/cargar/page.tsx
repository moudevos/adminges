import { InventoryUploadView } from "@/features/inventario/components/upload-view";
import { loadInventorySnapshots } from "@/features/inventario/server/loaders";
import { loadManualInventoryLocations } from "@/features/inventario/server/manual-inventory";

export default async function InventoryUploadPage() {
  const [snapshots, locations] = await Promise.all([
    loadInventorySnapshots(),
    loadManualInventoryLocations(),
  ]);
  return <InventoryUploadView history={snapshots} locations={locations} />;
}
