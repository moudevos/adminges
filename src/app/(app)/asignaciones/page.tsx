import { adminData } from "@/features/administracion/server/loaders";
import { Assignments } from "@/features/administracion/components/assignments";
export const dynamic="force-dynamic"; export default async function Page(){return <Assignments data={await adminData()}/>}
