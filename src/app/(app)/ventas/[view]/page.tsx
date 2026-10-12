import { notFound } from "next/navigation";
import { ModuleContent } from "@/components/dashboard/module-content";

const views = new Set(["agregar", "historial", "analisis"]);

export default async function SalesViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;

  if (!views.has(view)) {
    notFound();
  }

  return <ModuleContent activeModule="ventas" activeView={view} />;
}
