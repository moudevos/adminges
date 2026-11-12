import { adminData } from "@/features/administracion/server/loaders";
import { CatalogManagement } from "@/features/administracion/components/catalog-management";
export const dynamic="force-dynamic"; export default async function Page(){const d=await adminData();return <CatalogManagement type="puesto" rows={d.puestos}/>}
