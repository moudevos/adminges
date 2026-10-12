import { notFound } from "next/navigation";
import { ToolsView } from "@/features/herramientas/components/tools-view";

const views = new Set(["specs", "gancheras", "preciador"]);

export default async function ToolsViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.has(view)) notFound();
  return <ToolsView view={view} />;
}
