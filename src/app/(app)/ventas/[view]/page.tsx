import { notFound } from "next/navigation";
import { SalesView } from "@/features/ventas/components/sales-view";

export default async function SalesViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;

  if (view !== "analisis") {
    notFound();
  }

  return <SalesView view="analisis" />;
}
