import { InventoryUploadView } from "@/features/inventario/components/upload-view";
import { loadInventorySnapshots } from "@/features/inventario/server/loaders";

export default async function InventoryUploadPage() {
  const snapshots = await loadInventorySnapshots();
  return <InventoryUploadView history={snapshots} />;
}
