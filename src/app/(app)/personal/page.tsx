import { PersonalManagement } from "@/features/personal/components/personal-management";
import { loadPersonalData } from "@/features/personal/server/loaders";

export default async function PersonalPage() {
  const { personas, puestos } = await loadPersonalData();
  return <PersonalManagement personas={personas} puestos={puestos} />;
}
