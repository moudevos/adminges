import { adminData } from "@/features/administracion/server/loaders";
import { UsersManagement } from "@/features/administracion/components/users-management";
export const dynamic="force-dynamic"; export default async function Page(){const d=await adminData();return <UsersManagement profiles={d.profiles} personas={d.personas}/>}
