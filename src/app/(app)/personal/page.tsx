import { PersonalManagement } from "@/components/dashboard/personal-management";
import { loadPersonalData } from "@/lib/dashboard/loaders";

export default async function PersonalPage() {
  const { personas, puestos } = await loadPersonalData();

  return <PersonalManagement personas={personas} puestos={puestos} />;
}
