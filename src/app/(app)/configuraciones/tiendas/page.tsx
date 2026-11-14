import { adminData } from "@/features/administracion/server/loaders";
import { StoreManagement } from "@/features/administracion/components/store-management";
export const dynamic="force-dynamic"; export default async function Page(){return <StoreManagement data={await adminData()}/>}
