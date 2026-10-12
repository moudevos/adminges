import { notFound } from "next/navigation";
import { SalesView } from "@/features/ventas/components/sales-view";

const views = new Set(["agregar", "historial", "analisis"]);

export default async function SalesViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.has(view)) notFound();
  return <SalesView view={view} />;
}
