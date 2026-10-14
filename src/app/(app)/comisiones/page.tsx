import { CommissionsView } from "@/features/inteligencia/components/commissions-view";
import { loadCommercialIntelligence } from "@/features/inteligencia/server/loaders";
import type { ForecastModel } from "@/features/inteligencia/domain/projection";

export const dynamic = "force-dynamic";

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string; modelo?: string }>;
}) {
  const params = await searchParams;
  const model: ForecastModel = params.modelo === "lineal" ? "lineal" : "plano";
  return <CommissionsView data={await loadCommercialIntelligence(params.ciclo, model)} />;
}
