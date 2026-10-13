import { SalesRegistrationView } from "@/features/ventas/components/sales-registration-view";
import { loadSalesRegistration } from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function SalesRegistrationPage() {
  const data = await loadSalesRegistration();
  return <SalesRegistrationView data={data} />;
}
