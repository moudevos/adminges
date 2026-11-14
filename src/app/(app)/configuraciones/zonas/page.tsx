import { ZonesManagement } from "@/features/administracion/components/zones-management";
import { loadZonesManagementData } from "@/features/administracion/server/zones-loaders";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
 return <ZonesManagement data={await loadZonesManagementData()} />;
}
