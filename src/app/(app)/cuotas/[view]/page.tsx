import { notFound } from "next/navigation";
import { QuotasView } from "@/features/cuotas/components/quotas-view";

const views = new Set([
  "diaria",
  "mensual",
  "seguimiento-mensual",
  "seguimiento-diario",
]);

export default async function QuotasViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.has(view)) notFound();
  return <QuotasView view={view} />;
}
