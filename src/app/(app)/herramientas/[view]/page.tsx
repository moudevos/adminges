import { notFound } from "next/navigation";
import { ModuleContent } from "@/components/dashboard/module-content";

const views = new Set(["specs", "gancheras", "preciador"]);

export default async function ToolsViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;

  if (!views.has(view)) {
    notFound();
  }

  return <ModuleContent activeModule="herramientas" activeView={view} />;
}
